
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
 - Boot sequence defined in BOOT_COMMANDS array
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
    memory_size: 32 * 1024 * 1024,  // 32 MB
    bios: { url: "/v86/seabios.bin" },
    vga_bios: { url: "/v86/vgabios.bin" },
    cdrom: { url: "/v86/linux3.iso" },
    cmdline: "console=ttyS0",        // Use serial console for terminal
    autostart: true,
    
    // 9p filesystem configuration (optional - for host-guest file sharing)
    // To enable file sharing, uncomment and configure:
    // filesystem: {
    //     basefs: {
    //         url: "/v86/fs.json"
    //     },
    //     baseurl: "/v86/"
    // }
    filesystem: {},
};

// Boot initialization commands
// These commands are sent to the Linux shell after boot completes
// Each command is sent separately to avoid long command line issues
const BOOT_COMMANDS = [
    // Check if /proc is already mounted (it usually is during init)
    // If not, mount it silently (errors suppressed with || true)
    "mountpoint -q /proc || mount -t proc proc /proc 2>&1 >/dev/null || true",
    
    // Create working directory for user operations
    "mkdir -p /tmp/work 2>&1 >/dev/null || true",
    
    // Set working directory (use full path to avoid cd issues)
    "cd /tmp/work 2>&1 >/dev/null || true",
    
    // Set up environment variables for Freeciv server
    "export PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin",
    
    // Create helpful aliases for Freeciv server management
    "alias ll='ls -lah'",
    "alias ..='cd ..'",
    
    // Create a help command for common operations
    "alias help='echo -e \"\\033[1;33mFreeciv Server Commands:\\033[0m\" && echo \"  freeciv-server - Start Freeciv server\" && echo \"  ps - List running processes\" && echo \"  free - Show memory usage\" && echo \"  df - Show disk usage\" && echo \"  ll - List files (long format)\" && echo \"'\"",
    
    // Check if Freeciv server binary exists and display status
    "if command -v freeciv-server >/dev/null 2>&1; then echo -e '\\033[1;32m[OK]\\033[0m Freeciv server found'; else echo -e '\\033[1;33m[Warning]\\033[0m Freeciv server not found in PATH'; fi",
    
    // Display system information
    "echo -e '\\033[1;32m[System]\\033[0m Linux environment ready'",
    "echo -e '\\033[1;34m[Info]\\033[0m Working directory: /tmp/work'",
    "echo -e '\\033[1;34m[Info]\\033[0m Type \"help\" for available commands'",
    "echo ''",
];

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
 * Commands are sent individually to avoid shell escaping issues
 */
function initializeLinuxEnvironment(emulator, term) {
    term.writeln(`${COLORS.BLUE}[System]${COLORS.RESET} Initializing environment...`);
    
    // Send each command separately with a newline
    // This prevents the shell from displaying the entire command sequence
    // and avoids issues with special characters being HTML-encoded
    BOOT_COMMANDS.forEach(cmd => {
        emulator.serial0_send(cmd + '\n');
    });
    
    // Log configuration for debugging
    console.log("[v86] Boot sequence initialized");
    console.log("[v86] Commands sent: " + BOOT_COMMANDS.length);
    console.log("[v86] Memory: " + (V86_CONFIG.memory_size / 1024 / 1024) + " MB");
    console.log("[v86] Boot media: " + V86_CONFIG.cdrom.url);
}