
/**************************************************************************
 FreecivWorld v86 Emulator Integration
 
 This file initializes the v86 x86 emulator with a Linux environment
 for running Freeciv C server and providing a terminal interface.
 
 ARCHITECTURE:
 - v86: x86 emulator running in WebAssembly
 - xterm.js: Terminal UI for user interaction
 - bzImage + rootfs.cpio: Custom Linux with Freeciv server
 - Serial bridge: Connects v86 serial output to xterm.js display
 
 NETWORKING SETUP:
 The following describes how to enable WebSocket communication between
 the JavaScript client in the browser and the Freeciv server inside v86:
 
 1. WEBSOCKIFY INSIDE V86 LINUX:
    - websockify-c is compiled and included in rootfs.cpio
    - It acts as a WebSocket-to-TCP proxy inside the v86 Linux
    - Run inside v86: websockify 8080 localhost:5556
    - This listens on port 8080 for WebSocket connections
    - Forwards traffic to Freeciv server on localhost:5556
 
 2. V86 PORT FORWARDING:
    - v86 emulator can forward ports from the emulated Linux to the browser
    - Configure in V86_CONFIG.network_adapter with port_forward option
    - Example: port_forward: [{guest: 8080, host: 8080}]
    - This makes the guest's port 8080 accessible as localhost:8080 in browser
 
 3. JAVASCRIPT WEBSOCKET CLIENT:
    - Browser JavaScript can connect to the forwarded port
    - Example: new WebSocket("ws://localhost:8080/")
    - This reaches websockify inside v86, which forwards to Freeciv server
 
 COMPLETE SETUP STEPS:
 
 A. Inside v86 Linux (via terminal or startup script):
    # Start Freeciv server on port 5556
    /usr/local/bin/freeciv-web --port 5556 &
    
    # Start websockify-c to proxy WebSocket → Freeciv
    /usr/local/bin/websockify 8080 localhost:5556 &
 
 B. In v86 configuration (this file):
    Add to V86_CONFIG:
    network_adapter: {
        type: "ws",
        port_forward: [
            {guest: 8080, host: 8080}  // Forward websockify port
        ]
    }
 
 C. In FreecivWorld JavaScript client:
    // Connect to Freeciv server via WebSocket
    var ws = new WebSocket("ws://localhost:8080/");
    ws.onopen = function() {
        console.log("Connected to Freeciv server in v86");
        // Send/receive Freeciv protocol messages
    };
 
 NETWORK FLOW DIAGRAM:
 
 Browser (FreecivWorld JS)
    ↓ WebSocket
 ws://localhost:8080/
    ↓ [v86 port forward]
 v86 Linux: localhost:8080 (websockify-c)
    ↓ TCP
 v86 Linux: localhost:5556 (freeciv-web server)
 
 CONFIGURATION:
 - Memory: 256 MB RAM for the emulated system
 - Boot: bzImage kernel + rootfs.cpio initramfs
 - Console: Serial console (ttyS0) for terminal access
 
 MAINTAINABILITY:
 - All configuration in V86_CONFIG object
 - Color codes centralized in COLORS object
 - Network setup can be enabled by uncommenting network_adapter config
**************************************************************************/

// Terminal color codes for status messages
const COLORS = {
    GREEN: '\x1B[1;32m',   // Success/ready messages
    BLUE: '\x1B[1;34m',    // Info messages
    YELLOW: '\x1B[1;33m',  // Warning messages
    RED: '\x1B[1;31m',     // Error messages
    RESET: '\x1B[0m'       // Reset to default
};

// v86 emulator configuration
const V86_CONFIG = {
    wasm_path: "/v86/v86.wasm",
    memory_size: 256 * 1024 * 1024,
    bios: { url: "/v86/seabios.bin" },
    vga_bios: { url: "/v86/vgabios.bin" },
    bzimage: { url: "/v86/bzImage" },
    initrd: { url: "/v86/rootfs.cpio" },
    autostart: true,
    // Use 'arguments' to pass boot parameters to the kernel
    arguments: [
        "console=ttyS0", // Output to the v86 terminal
        "root=/dev/ram0", // Tell Linux the OS is in RAM
        "rw"             // Mount filesystem as Read/Write

    ],
    // NETWORK CONFIGURATION (currently disabled):
    // Uncomment and configure the following to enable WebSocket networking
    // between the browser and Freeciv server inside v86 Linux.
    //
    // network_adapter: {
    //     type: "ws",  // WebSocket-based networking
    //     port_forward: [
    //         {guest: 8080, host: 8080}  // Forward websockify port from v86 to browser
    //     ]
    // },
    //
    // With this configuration:
    // 1. Start websockify inside v86: websockify 8080 localhost:5556
    // 2. Start Freeciv server inside v86: freeciv-web --port 5556
    // 3. Connect from browser: new WebSocket("ws://localhost:8080/")
    // See header comments above for complete networking setup documentation.
};


function init_xterm() {
    // 1. Initialize xterm.js terminal
    const term = new Terminal({
        cursorBlink: true,
        fontFamily: 'monospace',
        fontSize: 14,
        theme: {
            background: '#000000',
            foreground: '#ffffff'
        }
    });
    term.open(document.getElementById('terminal'));
    
    // Optional: Add VGA canvas element if it doesn't exist
    let vgaCanvas = document.getElementById("vga");
    if (!vgaCanvas) {
        console.log("Note: No VGA canvas element found, running in text-only mode");
    }
    
    // 2. Initialize v86 emulator
    const config = Object.assign({}, V86_CONFIG);
    if (vgaCanvas) {
        config.vga_canvas = vgaCanvas;
    }
    const emulator = new V86(config);

    // 3. Bridge: v86 serial output -> xterm.js display
    emulator.add_listener("serial0-output-byte", function(byte) {
        term.write(String.fromCharCode(byte));
    });

    // 4. Bridge: xterm.js user input -> v86 serial input
    term.onData(data => {
        emulator.serial0_send(data);
    });

    // 5. Handle emulator ready event
    let bootInitialized = false;
    emulator.add_listener("emulator-ready", function() {
        if (!bootInitialized) {
            bootInitialized = true;
            term.writeln(`${COLORS.GREEN}[System]${COLORS.RESET} v86 Emulator Ready. Booting Linux...`);
            term.writeln(`${COLORS.BLUE}[Info]${COLORS.RESET} Please wait for boot to complete (5-10 seconds)`);
            
            // Wait for Linux to boot before sending initialization commands
            // Adjust timeout if needed based on boot speed
            setTimeout(() => {
                initializeLinuxEnvironment(emulator, term);
            }, 5000);
        }
    });
    
    // Store emulator reference globally for debugging
    window.v86_emulator = emulator;
    window.v86_terminal = term;
}

/**
 * Initialize the Linux environment after boot
 * Sends configuration commands to set up the working environment
 */
function initializeLinuxEnvironment(emulator, term) {
    term.writeln(`${COLORS.BLUE}[System]${COLORS.RESET} Initializing environment...`);
    
    // Join boot commands with AND operator for sequential execution
    // Use || true to continue even if a command fails
    const bootSequence = "\n\n uname -a \n";
    
    // Send boot sequence to the serial console
    emulator.serial0_send(bootSequence);
    
    // Log configuration for debugging
    console.log("[v86] Boot sequence initialized");
    console.log("[v86] Memory: " + (V86_CONFIG.memory_size / 1024 / 1024) + " MB");
}