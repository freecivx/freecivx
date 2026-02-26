
/**************************************************************************
 ...
**************************************************************************/


function init_xterm() {
    // 1. Initialize xterm.js
    const term = new Terminal({
        cursorBlink: true,
        fontFamily: 'monospace'
    });
    term.open(document.getElementById('terminal'));

    // 2. Initialize v86 (Note the class name: V86Starter)
    const emulator = new V86Starter({
        wasm_path: "/v86/v86.wasm",
        memory_size: 32 * 1024 * 1024,
        vga_canvas: document.getElementById("vga"),
        bios: { url: "/v86/seabios.bin" },
        vga_bios: { url: "/v86/vgabios.bin" },
        cdrom: { url: "/v86/linux3.iso" },
        autostart: true,
    });

    // 3. THE BRIDGE: v86 (Output) -> xterm.js (Display)
    // Most modern builds use 'serial0-output-byte'
    emulator.add_listener("serial0-output-byte", function(byte) {
        term.write(String.fromCharCode(byte));
    });

    // 4. THE BRIDGE: xterm.js (Input) -> v86 (Input)
    // This part was missing! This lets you actually type in the terminal.
    term.onData(data => {
        emulator.serial0_send(data);
    });

    // 5. DEBUG: Let's see if the emulator is actually running
    emulator.add_listener("emulator-ready", function() {
        term.writeln("\x1B[1;32m[System]\x1B[0m v86 Emulator Ready. Booting...");
    });
}