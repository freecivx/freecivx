# v86 Embedded Linux Documentation

## Overview

FreecivWorld uses the [v86](https://github.com/copy/v86) x86 emulator to run a Linux environment directly in the web browser. This enables running the Freeciv C server and providing a terminal interface for debugging and server management without requiring a backend server.

## Architecture

```
┌─────────────────────────────────────────┐
│         Web Browser                     │
│  ┌───────────────────────────────────┐  │
│  │   xterm.js Terminal UI            │  │
│  └───────────┬───────────────────────┘  │
│              │ Serial I/O               │
│  ┌───────────▼───────────────────────┐  │
│  │   v86 Emulator (WebAssembly)      │  │
│  │   ┌───────────────────────────┐   │  │
│  │   │ Linux (linux3.iso)        │   │  │
│  │   │  - BusyBox shell          │   │  │
│  │   │  - Freeciv C server       │   │  │
│  │   │  - System utilities       │   │  │
│  │   └───────────────────────────┘   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Components

### 1. v86 Emulator
- **File**: `/v86/v86.wasm` (2.0 MB)
- **Library**: `/v86/libv86.js` (329 KB)
- **Purpose**: WebAssembly-based x86 emulator
- **Configuration**: `server-xterm-v86.js`

### 2. BIOS Files
- **SeaBIOS**: `/v86/seabios.bin` (128 KB) - x86 BIOS implementation
- **VGA BIOS**: `/v86/vgabios.bin` (36 KB) - Video BIOS for graphics

### 3. Linux ISO
- **File**: `/v86/linux3.iso` (8.3 MB)
- **Contents**: Custom Linux system with:
  - Linux kernel (configured for v86)
  - BusyBox utilities
  - Freeciv C server binaries
  - Init scripts
- **Boot**: Via CD-ROM emulation
- **Console**: Serial console (ttyS0)

### 4. Terminal Interface
- **File**: `/v86/xterm.js` (478 KB)
- **Purpose**: Terminal emulator for user interaction
- **Features**: 
  - Text rendering
  - Keyboard input handling
  - ANSI escape sequences support

### 5. Integration Code
- **File**: `/javascript/server-xterm-v86.js`
- **Purpose**: Bridges v86 emulator with xterm.js terminal
- **Functions**:
  - `init_xterm()`: Initialize and configure the emulator
  - `initializeLinuxEnvironment()`: Set up the Linux environment after boot

## Configuration

### V86 Emulator Settings

```javascript
const V86_CONFIG = {
    wasm_path: "/v86/v86.wasm",
    memory_size: 32 * 1024 * 1024,     // 32 MB RAM
    bios: { url: "/v86/seabios.bin" },
    vga_bios: { url: "/v86/vgabios.bin" },
    cdrom: { url: "/v86/linux3.iso" },
    cmdline: "console=ttyS0",           // Serial console
    autostart: true,
    filesystem: {},                     // No 9p sharing by default
};
```

### Memory Configuration
- **Default**: 32 MB
- **Recommended range**: 32-128 MB
- **Note**: More memory allows running larger Freeciv games but increases browser memory usage

### Boot Process

1. **Emulator initialization** (0-2 seconds)
   - Load WASM module
   - Initialize virtual hardware
   - Load BIOS

2. **Linux boot** (2-7 seconds)
   - BIOS POST
   - Boot from linux3.iso
   - Kernel initialization
   - Init scripts execution

3. **Environment setup** (7-10 seconds)
   - Mount filesystems
   - Set up working directory
   - Display ready message

## Boot Commands

The system executes these commands after Linux boots:

```bash
# Check/mount proc filesystem (if not already mounted)
mountpoint -q /proc || mount -t proc proc /proc 2>/dev/null

# Create working directory
mkdir -p /tmp/work

# Set working directory
cd /tmp/work

# Display ready messages
echo '[System] Linux environment ready'
echo '[Info] Working directory: /tmp/work'
```

## File Sharing (9p Filesystem)

The 9p protocol allows sharing files between the host (web browser) and guest (Linux). Currently disabled by default.

### To Enable 9p File Sharing:

1. Create a filesystem JSON definition (`fs.json`)
2. Update V86_CONFIG:
```javascript
filesystem: {
    basefs: {
        url: "/v86/fs.json"
    },
    baseurl: "/v86/"
}
```

3. Update boot commands to mount 9p:
```javascript
"mount -t 9p host9p /tmp/mnt",
"cd /tmp/mnt"
```

### 9p Filesystem JSON Format

```json
{
    "fstype": "9p",
    "files": {
        "example.txt": {
            "data": "Hello from host!"
        }
    }
}
```

## Building rootfs.cpio with Freeciv Server

### Current Status
The system now uses `rootfs.cpio` (initramfs) instead of `linux3.iso`. This is loaded with `bzImage` kernel.

### Building Freeciv Server for v86

A build script is provided to compile the Freeciv C server as a static x86 executable:

```bash
cd freeciv
./compile_freeciv_v86.sh
```

This script:
- Compiles Freeciv as a statically-linked 32-bit x86 binary
- Outputs to `freeciv/freeciv-v86/` directory
- Configures for minimal size and v86 compatibility

See `freeciv/freeciv-v86-README.md` for detailed documentation.

### Requirements for Custom rootfs.cpio

To rebuild or modify rootfs.cpio using v86-buildroot, you need:

1. **Linux kernel** (bzImage) compiled with:
   - `CONFIG_SERIAL_8250=y` (serial console support)
   - `CONFIG_SERIAL_8250_CONSOLE=y`
   - `CONFIG_9P_FS=y` (optional, for 9p filesystem)
   - `CONFIG_NET_9P=y` (optional, for 9p network)

2. **BusyBox** or similar for basic utilities:
   - Shell (ash/sh)
   - Core utilities (ls, cd, mkdir, etc.)
   - mount, umount
   - System utilities

3. **Init system**:
   - Simple init script that starts a shell on ttyS0
   - Or systemd/sysvinit configured for serial console

4. **Freeciv server**:
   - Use `compile_freeciv_v86.sh` to build static binaries
   - Copy to buildroot overlay: `board/v86/rootfs_overlay/usr/local/`
   - Include required configuration files

5. **Websockify** (optional, for WebSocket tunneling):
   - Add Python 3 to buildroot configuration
   - Include websockify script in rootfs overlay

### Building with v86-buildroot

Recommended approach using v86-buildroot:

```bash
# Clone v86-buildroot
git clone https://github.com/chschnell/v86-buildroot
cd v86-buildroot

# Bootstrap and configure
make bootstrap
make buildroot-defconfig

# Copy Freeciv binaries to overlay
cp -r /path/to/freecivworld/freeciv/freeciv-v86/* board/v86/rootfs_overlay/usr/local/

# (Optional) Add websockify
git clone https://github.com/novnc/websockify
cp websockify/websockify board/v86/rootfs_overlay/usr/local/bin/
chmod +x board/v86/rootfs_overlay/usr/local/bin/websockify

# Build everything
make all

# Output files will be in build/v86/images/:
# - bzImage (kernel)
# - rootfs.cpio (root filesystem)
```

### Deploying to FreecivWorld

After building, copy the files to the web application:

```bash
cp build/v86/images/bzImage /path/to/freecivworld/freeciv-web/src/main/webapp/v86/
cp build/v86/images/rootfs.cpio /path/to/freecivworld/freeciv-web/src/main/webapp/v86/
```

### Alternative: Using Buildroot directly

If not using v86-buildroot:

1. Get Buildroot and configure for x86 with initramfs
2. Copy Freeciv files to overlay directory
3. Build with `make`
4. Extract `rootfs.cpio` from output

### Recommended Tools
- **v86-buildroot**: https://github.com/chschnell/v86-buildroot - Customized for v86
- **Buildroot**: https://buildroot.org/ - Automated embedded Linux build system
- **Docker**: For reproducible builds

## Debugging

### Browser Console
All v86 events are logged to the browser console:
```javascript
console.log("[v86] Boot sequence initialized");
console.log("[v86] Memory: 32 MB");
```

### Global Variables
For debugging, the emulator and terminal are exposed:
```javascript
window.v86_emulator  // v86 emulator instance
window.v86_terminal  // xterm.js terminal instance
```

### Emulator Control
```javascript
// Send command to Linux
window.v86_emulator.serial0_send("ls -la\n");

// Restart emulator
window.v86_emulator.restart();

// Stop emulator
window.v86_emulator.stop();
```

### Common Issues

#### 1. Mount Errors on Boot
**Symptom**: "mount: mounting proc on /proc failed: Device or resource busy"
**Cause**: /proc is already mounted by init
**Solution**: Use `mountpoint -q /proc || mount ...` to check first

#### 2. 9p Mount Failure
**Symptom**: "mount: mounting host9p on /mnt failed: No such file or directory"
**Cause**: No 9p filesystem configured in V86_CONFIG
**Solution**: Either configure 9p filesystem or remove mount command

#### 3. Slow Boot
**Symptom**: Takes more than 10 seconds to boot
**Cause**: Limited emulator performance or large ISO
**Solution**: Increase boot timeout or optimize linux3.iso

#### 4. Terminal Not Responding
**Symptom**: Can't type in terminal
**Cause**: Serial bridge not initialized or boot not complete
**Solution**: Check browser console for errors, ensure emulator-ready event fired

## Performance Considerations

### Memory Usage
- **v86 emulator**: ~50 MB (WebAssembly runtime)
- **Emulated RAM**: 32 MB (configurable)
- **ISO buffering**: 8.3 MB
- **Total**: ~90 MB browser memory

### CPU Usage
- **Boot**: High CPU usage (2-7 seconds)
- **Idle**: Low CPU usage (<5%)
- **Active**: Depends on workload (10-30%)

### Network
- **Initial load**: Downloads ~11 MB (WASM + ISO + libraries)
- **Runtime**: No network activity (unless 9p filesystem used)

## Integration with FreecivWorld

The v86 emulator is initialized in the main game client:

1. **client_main.js** calls `init_xterm()` after game starts
2. **Terminal UI** can be shown/hidden as needed
3. **Server management** through terminal commands
4. **Debugging** capability for development

## Future Improvements

1. **Document ISO build process**
   - Create build scripts
   - Document kernel configuration
   - Automate ISO creation

2. **Optimize boot time**
   - Minimize kernel size
   - Use initramfs instead of ISO
   - Pre-configure system

3. **Add file sharing**
   - Implement 9p filesystem properly
   - Allow uploading files from browser
   - Download files from emulator

4. **Improve maintainability**
   - Version control for ISO
   - Automated testing
   - CI/CD integration

5. **Enhanced features**
   - Multiple terminal tabs
   - Save/restore sessions
   - Screen recording
   - Copy/paste support

## References

- **v86 Project**: https://github.com/copy/v86
- **v86 Documentation**: https://github.com/copy/v86/blob/master/Readme.md
- **xterm.js**: https://xtermjs.org/
- **9p Protocol**: https://9p.io/
- **BusyBox**: https://busybox.net/
- **Buildroot**: https://buildroot.org/

## License

The v86 emulator and this integration are subject to their respective licenses:
- v86: Simplified BSD License
- xterm.js: MIT License
- FreecivWorld: AGPL License
