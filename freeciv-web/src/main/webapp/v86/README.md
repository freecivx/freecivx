# v86 Files for FreecivWorld

This directory contains the v86 emulator files and Linux environment for running
Freeciv C server in the browser.

## Current Files

- **bzImage** - Linux kernel (32-bit x86)
- **rootfs.cpio** - Root filesystem with BusyBox utilities
- **v86.wasm** - v86 emulator WebAssembly binary
- **libv86.js** - v86 emulator JavaScript library
- **seabios.bin** - x86 BIOS
- **vgabios.bin** - VGA BIOS
- **xterm.js** - Terminal emulator library

## Building Custom rootfs.cpio with Freeciv

To rebuild rootfs.cpio with Freeciv C server and websockify-c:

1. See build instructions: `/freeciv/freeciv-v86-README.md`
2. Or use the automated scripts in `/freeciv/`:
   - `compile_freeciv_v86.sh` - Build Freeciv server
   - `compile_websockify_c_v86.sh` - Build websockify-c
   - `integrate_v86_buildroot.sh` - Integrate with v86-buildroot

3. Copy built files here:
   ```bash
   cp /path/to/v86-buildroot/build/v86/images/bzImage .
   cp /path/to/v86-buildroot/build/v86/images/rootfs.cpio .
   ```

## Network Setup

For WebSocket networking between browser and v86 Linux, see:
- `/javascript/server-xterm-v86.js` - Network configuration
- `/doc/v86-embedded-linux.md` - Complete networking guide

## References

- v86-buildroot: https://github.com/chschnell/v86-buildroot
- v86 emulator: https://github.com/copy/v86
- v86 BIOS files: https://github.com/copy/v86/tree/master/bios
- websockify-c: https://github.com/mittorn/websockify-c
