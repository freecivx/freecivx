
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
 - Utility functions exposed globally (v86_*) for debugging and scripting
 - Help system built into the emulated environment
 
 UTILITY FUNCTIONS:
 - v86_send_command(cmd): Send a command to the Linux shell
 - v86_start_freeciv_server(options): Start the Freeciv server
 - v86_get_status(): Get emulator status information
 - v86_clear_terminal(): Clear the terminal display
 - v86_restart(): Restart the emulator (loses state)
 
 USAGE:
 The emulator is automatically initialized when the game starts.
 Access the terminal through the game UI or use the utility functions
 from the browser console for debugging.
 
 Example:
   v86_send_command("ls -la");
   v86_start_freeciv_server({ port: 5556 });
   console.log(v86_get_status());
 
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
const BOOT_COMMANDS = [
    // Check if /proc is already mounted (it usually is during init)
    // If not, mount it silently (2>/dev/null suppresses errors)
    "mountpoint -q /proc || mount -t proc proc /proc 2>/dev/null",
    
    // Create working directories
    "mkdir -p /tmp/work /tmp/freeciv 2>/dev/null",
    
    // Set working directory
    "cd /tmp/work",
    
    // Create a help command if it doesn't exist
    `cat > /usr/local/bin/help << 'HELP_EOF'
#!/bin/sh
echo "FreecivWorld v86 Linux Environment - Available Commands:"
echo ""
echo "System Information:"
echo "  uname -a          - Show system information"
echo "  free              - Display memory usage"
echo "  df -h             - Show disk space"
echo "  ps                - List running processes"
echo ""
echo "File Operations:"
echo "  ls [path]         - List directory contents"
echo "  cd [path]         - Change directory"
echo "  pwd               - Print working directory"
echo "  cat [file]        - Display file contents"
echo "  mkdir [dir]       - Create directory"
echo ""
echo "Freeciv Server:"
echo "  freeciv-server    - Start Freeciv C server (if available)"
echo "  civserver         - Alternative Freeciv server command"
echo ""
echo "Network (if configured):"
echo "  ifconfig          - Show network interfaces"
echo "  ping [host]       - Test connectivity"
echo ""
echo "Working directories:"
echo "  /tmp/work         - Current working directory"
echo "  /tmp/freeciv      - Freeciv server directory"
echo ""
echo "Type 'help' anytime to see this message again."
HELP_EOF`,
    
    // Make help executable
    "chmod +x /usr/local/bin/help 2>/dev/null",
    
    // Create aliases for convenience
    "alias ll='ls -la'",
    "alias h='help'",
    
    // Display system information with ANSI color codes
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
            term.writeln(`${COLORS.BLUE}[Info]${COLORS.RESET} Boot messages from Linux kernel will appear below...`);
            term.writeln('');
            
            // Wait for Linux to boot before sending initialization commands
            // Adjust timeout if needed based on boot speed
            setTimeout(() => {
                initializeLinuxEnvironment(emulator, term);
            }, 5000);
        }
    });
    
    // 6. Log emulator events for debugging
    if (console && console.log) {
        emulator.add_listener("download-progress", function(e) {
            if (e.file_name && e.loaded !== undefined && e.total !== undefined) {
                const percent = Math.round((e.loaded / e.total) * 100);
                console.log(`[v86] Downloading ${e.file_name}: ${percent}%`);
            }
        });
        
        emulator.add_listener("download-error", function(e) {
            console.error(`[v86] Download error:`, e);
            term.writeln(`${COLORS.RED}[Error]${COLORS.RESET} Failed to download: ${e.file_name}`);
        });
    }
    
    // Store emulator reference globally for debugging
    window.v86_emulator = emulator;
    window.v86_terminal = term;
    
    // Log initialization complete
    console.log("[v86] Initialization complete");
    console.log("[v86] Use v86_send_command('command') to send commands");
    console.log("[v86] Use v86_get_status() to check emulator status");
}

/**
 * Initialize the Linux environment after boot
 * Sends configuration commands to set up the working environment
 */
function initializeLinuxEnvironment(emulator, term) {
    term.writeln(`${COLORS.BLUE}[System]${COLORS.RESET} Initializing environment...`);
    
    // Join boot commands with AND operator for sequential execution
    // Use || true to continue even if a command fails
    const bootSequence = BOOT_COMMANDS
        .map(cmd => `(${cmd}) || true`)
        .join(' && ') + '\n';
    
    // Send boot sequence to the serial console
    emulator.serial0_send(bootSequence);
    
    // Log configuration for debugging
    console.log("[v86] Boot sequence initialized");
    console.log("[v86] Memory: " + (V86_CONFIG.memory_size / 1024 / 1024) + " MB");
    console.log("[v86] Boot media: " + V86_CONFIG.cdrom.url);
}

/**
 * Utility Functions for v86 Emulator Control
 * These functions provide a convenient API for interacting with the emulator
 */

/**
 * Send a command to the Linux shell
 * @param {string} command - The command to execute
 * @example
 * v86_send_command("ls -la");
 * v86_send_command("cd /tmp && pwd");
 */
function v86_send_command(command) {
    if (window.v86_emulator) {
        window.v86_emulator.serial0_send(command + '\n');
        console.log("[v86] Command sent: " + command);
    } else {
        console.error("[v86] Emulator not initialized");
    }
}

/**
 * Start the Freeciv server in the emulated environment
 * @param {Object} options - Server configuration options
 * @example
 * v86_start_freeciv_server({ port: 5556 });
 */
function v86_start_freeciv_server(options = {}) {
    const port = options.port || 5556;
    const command = `cd /tmp/freeciv && freeciv-server -p ${port}`;
    
    if (window.v86_terminal) {
        window.v86_terminal.writeln(`${COLORS.GREEN}[System]${COLORS.RESET} Starting Freeciv server on port ${port}...`);
    }
    
    v86_send_command(command);
}

/**
 * Get the emulator status and configuration
 * @returns {Object} Status information about the emulator
 */
function v86_get_status() {
    if (!window.v86_emulator) {
        return { initialized: false };
    }
    
    return {
        initialized: true,
        memory_mb: V86_CONFIG.memory_size / 1024 / 1024,
        boot_media: V86_CONFIG.cdrom.url,
        running: window.v86_emulator.is_running && window.v86_emulator.is_running()
    };
}

/**
 * Clear the terminal display
 */
function v86_clear_terminal() {
    if (window.v86_terminal) {
        window.v86_terminal.clear();
        console.log("[v86] Terminal cleared");
    }
}

/**
 * Restart the v86 emulator
 * Warning: This will lose all state in the emulated system
 */
function v86_restart() {
    if (window.v86_emulator) {
        console.log("[v86] Restarting emulator...");
        if (window.v86_terminal) {
            window.v86_terminal.writeln(`${COLORS.YELLOW}[System]${COLORS.RESET} Restarting emulator...`);
        }
        window.v86_emulator.restart();
    }
}

// Expose utility functions globally for debugging and scripting
window.v86_send_command = v86_send_command;
window.v86_start_freeciv_server = v86_start_freeciv_server;
window.v86_get_status = v86_get_status;
window.v86_clear_terminal = v86_clear_terminal;
window.v86_restart = v86_restart;