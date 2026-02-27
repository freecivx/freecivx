# Quick Start: Building Freeciv for v86

This is a quick reference guide for building Freeciv C server for v86.

## Prerequisites

```bash
# Ubuntu/Debian
sudo apt-get install -y gcc-multilib g++-multilib meson ninja-build pkg-config libc6-dev-i386

# For cross-compilation (optional but recommended)
sudo apt-get install -y gcc-i686-linux-gnu g++-i686-linux-gnu
```

## Build

```bash
cd freeciv
./build_freeciv_v86.sh
```

**Output:** `freeciv-v86/bin/freeciv-web-server` (static x86 binary)

## Quick Integration with v86-buildroot

```bash
# 1. Copy binary
cp freeciv-v86/bin/freeciv-web-server /path/to/v86-buildroot/overlay/usr/local/bin/

# 2. Copy data files
cp -r freeciv-v86/share/freeciv /path/to/v86-buildroot/overlay/usr/local/share/

# 3. Add websockify (for WebSocket support)
git clone https://github.com/novnc/websockify.git
mkdir -p /path/to/v86-buildroot/overlay/usr/local/lib/python3.x/site-packages/
cp -r websockify/websockify /path/to/v86-buildroot/overlay/usr/local/lib/python3.x/site-packages/
cp websockify/run /path/to/v86-buildroot/overlay/usr/local/bin/websockify
chmod +x /path/to/v86-buildroot/overlay/usr/local/bin/websockify

# 4. Rebuild rootfs.cpio
cd /path/to/v86-buildroot
make
```

## More Information

- **V86_INTEGRATION.md**: Complete integration guide with detailed steps
- **build_freeciv_v86.sh**: Build script with inline documentation
- **v86 Project**: https://github.com/copy/v86

## Troubleshooting

**Binary not static?**
```bash
ldd freeciv-v86/bin/freeciv-web-server
# Should show "not a dynamic executable"
```

**Binary too large?**
```bash
strip freeciv-v86/bin/freeciv-web-server
# or rebuild with -Doptimization=s for size optimization
```

**Missing dependencies?**
- Check that all build dependencies are installed
- For cross-compilation, ensure i686 toolchain is available
- Review build output for missing libraries
