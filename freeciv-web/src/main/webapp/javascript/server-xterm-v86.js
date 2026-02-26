
/**************************************************************************
 FreecivWorld v86 Emulator Integration
 
 This file initializes the v86 x86 emulator with a Linux environment
 for running Freeciv C server and providing a terminal interface.
 
 ARCHITECTURE:
 - v86: x86 emulator running in WebAssembly
 - xterm.js: Terminal UI for user interaction
 - linux3.iso: Custom Linux ISO with Freeciv server
 - Serial bridge: Connects v86 serial output to xterm.js display
 
 CONFIGURATION:
 - Memory: 32 MB RAM for the emulated system
 - Boot: linux3.iso via CD-ROM emulation
 - Console: Serial console (ttyS0) for terminal access
 - Filesystem: Optional 9p for host-guest file sharing (currently disabled)
 
 MAINTAINABILITY:
 - All configuration in V86_CONFIG object
 - Color codes centralized in COLORS object
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
    const bootSequence = "uname -a \n";
    
    // Send boot sequence to the serial console
    emulator.serial0_send(bootSequence);
    
    // Log configuration for debugging
    console.log("[v86] Boot sequence initialized");
    console.log("[v86] Memory: " + (V86_CONFIG.memory_size / 1024 / 1024) + " MB");
}