# Freeciv Server for v86 Integration Guide

This guide explains how to build and integrate the Freeciv C server into a v86 buildroot environment.

## Overview

[v86](https://github.com/copy/v86) is an x86 emulator written in JavaScript that runs in the browser. It can run a Linux system using a custom buildroot-based root filesystem.

This integration allows Freeciv server to run entirely in the browser via v86, enabling:
- Browser-based Freeciv server hosting
- No server-side infrastructure needed
- Self-contained gaming experience

## Building the Static Binary

### Prerequisites

```bash
# Install build dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y \
    gcc-multilib \
    g++-multilib \
    meson \
    ninja-build \
    pkg-config \
    libc6-dev-i386

# For cross-compilation (recommended)
sudo apt-get install -y \
    gcc-i686-linux-gnu \
    g++-i686-linux-gnu
```

### Build Command

```bash
cd freeciv
./build_freeciv_v86.sh
```

The script will:
1. Configure Freeciv for static x86 build
2. Disable unnecessary features (audio, NLS, GUI clients)
3. Enable freeciv-web server variant with JSON protocol
4. Build a fully static binary
5. Output to `freeciv-v86/bin/freeciv-web-server`

## Integration with v86-buildroot

### Step 1: Clone v86 and v86-buildroot

```bash
# Clone v86 emulator
git clone https://github.com/copy/v86.git

# Clone v86-buildroot (if you don't have it)
# Note: v86-buildroot might be a separate repository or in v86/tools/
cd v86
# Check for buildroot tools in the v86 repository
```

### Step 2: Prepare the Overlay Directory

The overlay directory contains files that will be added to the rootfs.

```bash
# Create overlay directory structure
mkdir -p v86-buildroot/overlay/usr/local/bin
mkdir -p v86-buildroot/overlay/usr/local/share/freeciv
mkdir -p v86-buildroot/overlay/etc/init.d
```

### Step 3: Copy Freeciv Binary

```bash
# Copy the static Freeciv server binary
cp freeciv-v86/bin/freeciv-web-server v86-buildroot/overlay/usr/local/bin/
chmod +x v86-buildroot/overlay/usr/local/bin/freeciv-web-server

# Copy data files if needed
cp -r freeciv-v86/share/freeciv/* v86-buildroot/overlay/usr/local/share/freeciv/
```

### Step 4: Add websockify Support

Websockify is needed to bridge WebSocket connections to TCP sockets.

```bash
# Clone websockify
git clone https://github.com/novnc/websockify.git

# Install Python (if not in buildroot already)
# Add to v86-buildroot configuration to include Python3

# Copy websockify
mkdir -p v86-buildroot/overlay/usr/local/lib/python3.x/site-packages/
cp -r websockify/websockify v86-buildroot/overlay/usr/local/lib/python3.x/site-packages/

# Copy websockify executable
cp websockify/run v86-buildroot/overlay/usr/local/bin/websockify
chmod +x v86-buildroot/overlay/usr/local/bin/websockify
```

### Step 5: Create Init Script (Optional)

Create an init script to start Freeciv server automatically:

```bash
cat > v86-buildroot/overlay/etc/init.d/S99freeciv << 'EOF'
#!/bin/sh

case "$1" in
    start)
        echo "Starting Freeciv server..."
        /usr/local/bin/freeciv-web-server -p 5556 &
        
        echo "Starting websockify..."
        /usr/local/bin/websockify 0.0.0.0:5000 localhost:5556 &
        ;;
    stop)
        echo "Stopping Freeciv server..."
        killall freeciv-web-server
        killall websockify
        ;;
    restart)
        $0 stop
        sleep 1
        $0 start
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
        ;;
esac

exit 0
EOF

chmod +x v86-buildroot/overlay/etc/init.d/S99freeciv
```

### Step 6: Rebuild the Root Filesystem

```bash
cd v86-buildroot
make clean
make
```

This will generate a new `rootfs.cpio` file containing:
- Freeciv server binary
- Freeciv data files
- websockify
- Startup scripts

### Step 7: Use with v86

```javascript
// Example v86 configuration
var emulator = new V86Starter({
    wasm_path: "v86.wasm",
    memory_size: 256 * 1024 * 1024, // 256MB
    vga_memory_size: 8 * 1024 * 1024, // 8MB
    
    // Boot from the buildroot image
    bzimage: {
        url: "bzImage",
    },
    initrd: {
        url: "rootfs.cpio", // Your custom rootfs with Freeciv
    },
    
    // Network configuration
    network_relay_url: "wss://relay.widgetry.org/",
    
    autostart: true,
});
```

## Configuration Details

### Static Build Rationale

The build uses static linking because:
- v86 buildroot has minimal shared libraries
- Static binaries are self-contained and portable
- Reduces runtime dependencies
- Simplifies deployment

### Disabled Features

To minimize binary size and dependencies:
- **NLS (Native Language Support)**: Disabled - reduces size
- **Audio**: Disabled - not needed for server
- **GUI Clients**: Disabled - only server needed
- **Readline**: Disabled - may not be available statically
- **Ruledit**: Disabled - not needed in browser

### Enabled Features

- **freeciv-web server**: Server variant optimized for web
- **JSON protocol**: Required for web client communication
- **CLI modpack installer**: Minimal modpack support

## Networking

When running in v86:

1. **Freeciv Server** listens on port 5556 (internal)
2. **websockify** bridges port 5000 (WebSocket) to 5556 (TCP)
3. **Web Client** connects via WebSocket to port 5000
4. **v86 Network Stack** routes to external network via relay

```
[Web Browser]
    ↓ WebSocket (ws://localhost:5000)
[websockify in v86]
    ↓ TCP (localhost:5556)
[Freeciv Server in v86]
```

## Troubleshooting

### Binary Too Large

If the binary is too large for v86:

```bash
# Strip debug symbols
strip freeciv-v86/bin/freeciv-web-server

# Use size optimization
# Edit build_freeciv_v86.sh and change:
# -Doptimization=2 to -Doptimization=s
```

### Dynamic Library Errors

If `ldd` shows dynamic dependencies:

```bash
# Check what's linked
ldd freeciv-v86/bin/freeciv-web-server

# Install static libraries
sudo apt-get install libc6-dev-i386

# Rebuild with musl for guaranteed static
# (requires musl-gcc)
```

### Python/websockify Issues

If websockify doesn't work:
- Ensure Python3 is included in buildroot config
- Check websockify dependencies are met
- Consider using a lighter WebSocket proxy

## Alternative Approaches

### Using Node.js websockify

Instead of Python websockify:

```bash
npm install -g websockify
# Copy node_modules and binary to overlay
```

### Pre-built v86 Images

Some v86 distributions include networking tools. Check:
- https://github.com/copy/v86/tree/master/images
- https://github.com/copy/v86/blob/master/docs/networking.md

## References

- v86 Project: https://github.com/copy/v86
- v86 Networking: https://github.com/copy/v86/blob/master/docs/networking.md
- websockify: https://github.com/novnc/websockify
- Freeciv: https://www.freeciv.org/

## Testing

To test the binary before v86 integration:

```bash
# Run directly (if on x86/x86_64 Linux)
./freeciv-v86/bin/freeciv-web-server --help

# Check if static
ldd ./freeciv-v86/bin/freeciv-web-server

# Test with websockify locally
websockify 5000 localhost:5556 &
./freeciv-v86/bin/freeciv-web-server -p 5556
```

## Size Optimization Tips

1. **Strip symbols**: `strip --strip-all binary`
2. **Compress with UPX**: `upx --best binary` (if compatible with v86)
3. **Minimize data files**: Only include essential rulesets
4. **Use musl libc**: Smaller than glibc for static builds

## License

The Freeciv server is licensed under GPLv2+. See the main repository LICENSE file for details.
