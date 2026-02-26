
/**************************************************************************
 ...
**************************************************************************/


function init_xterm() {

// 1. Initialize xterm.js (as we did before)
const term = new Terminal();
term.open(document.getElementById('terminal'));

// 2. Initialize v86
const emulator = new V86({
    wasm_path: "/v86/v86.wasm",
    memory_size: 32 * 1024 * 1024, // 32MB
    vga_canvas: document.getElementById("vga"),
    bios: { url: "/v86/seabios.bin" },
    vga_bios: { url: "/v86/vgabios.bin" },
    // Use a small linux image
    cdrom: { url: "/v86/linux.iso" },
    autostart: true,
});

// 3. THE BRIDGE: v86 -> xterm.js
emulator.add_listener("serial0-output-char", function(char) {
    term.write(char);
});

// 4. THE BRIDGE: xterm.js -> v86
term.onData(data => {
    emulator.serial0_send(data);
});

}