# Freeciv v86 Build

This directory contains the script to compile Freeciv C server as a static x86 executable for use with v86 emulator.

## Quick Start

```bash
# 1. Build Freeciv C server for v86
./compile_freeciv_v86.sh

# 2. Build websockify-c for WebSocket support
./compile_websockify_c_v86.sh

# 3. Integrate with v86-buildroot (if you have it cloned)
./integrate_v86_buildroot.sh /path/to/v86-buildroot
```

## Build Scripts

This directory contains three build scripts:

1. **compile_freeciv_v86.sh** - Builds Freeciv C server as static x86 binary
2. **compile_websockify_c_v86.sh** - Builds websockify-c for WebSocket support
3. **integrate_v86_buildroot.sh** - Copies all files to v86-buildroot overlay

## Overview

The `compile_freeciv_v86.sh` script builds a statically-linked 32-bit x86 Freeciv server that can run inside the v86 x86 emulator. This enables running Freeciv server directly in a web browser using v86's in-browser Linux environment.

## Prerequisites

Before running the build script, ensure you have:

1. **Freeciv source code** - Run `prepare_freeciv.sh` first to checkout and patch Freeciv
2. **Build tools**:
   - gcc (with 32-bit support)
   - ninja
   - meson (or Python 3 with meson module)
   - pkg-config

3. **32-bit development libraries** (for static linking):
   ```bash
   sudo apt-get install gcc-multilib g++-multilib
   sudo apt-get install zlib1g-dev:i386 libcurl4-openssl-dev:i386 libsqlite3-dev:i386
   ```

## Build Process

The script:

1. Configures Freeciv with meson for static x86 build
2. Compiles the server with `-static -m32` flags
3. Installs binaries and data files to `freeciv-v86/` directory
4. Verifies the binary is statically linked and 32-bit

## Output

Build results are placed in:
```
freeciv-v86/
├── bin/
│   └── freeciv-web      # Static 32-bit x86 server binary
└── share/
    └── freeciv/         # Game data files (rulesets, etc.)
```

## Integration with v86-buildroot

To include the compiled Freeciv server in your v86 buildroot image:

### Step 1: Copy to buildroot overlay

```bash
# Assuming you have v86-buildroot cloned
cd /path/to/v86-buildroot
cp -r freeciv-v86/* board/v86/rootfs_overlay/usr/local/
```

### Step 2: Build websockify-c

websockify-c is required for WebSocket support for network communication.
We use the C implementation instead of Python for better performance and no dependencies.

```bash
# Build websockify-c
./compile_websockify_c_v86.sh

# This will clone and build https://github.com/mittorn/websockify-c
# Output: websockify-v86/bin/websockify (statically linked, no dependencies)
```

### Step 3: Integrate with buildroot overlay

Use the integration script to copy all files to buildroot:

```bash
# Assuming you have v86-buildroot cloned
./integrate_v86_buildroot.sh /path/to/v86-buildroot

# This script will:
# 1. Copy Freeciv server binary
# 2. Copy all Freeciv data files (rulesets, nations, scenarios, etc.)
# 3. Copy websockify-c binary
# to: board/v86/rootfs_overlay/usr/local/
```

Alternatively, copy files manually:

```bash
cd /path/to/v86-buildroot
cp -r freeciv-v86/* board/v86/rootfs_overlay/usr/local/
cp websockify-v86/bin/websockify board/v86/rootfs_overlay/usr/local/bin/
```

### Step 4: Rebuild rootfs.cpio

```bash
cd /path/to/v86-buildroot
make all
```

This will create a new `rootfs.cpio` in `build/v86/images/` containing your Freeciv server.

### Step 5: Deploy to web application

```bash
# Copy the new rootfs.cpio to your FreecivWorld web app
cp build/v86/images/rootfs.cpio /path/to/freecivworld/freeciv-web/src/main/webapp/v86/
```

## v86-buildroot Structure

The typical v86-buildroot directory structure:

```
v86-buildroot/
├── board/v86/
│   ├── rootfs_overlay/       # Files to include in rootfs
│   │   └── usr/local/
│   │       ├── bin/          # Put binaries here
│   │       └── share/        # Put data files here
│   ├── linux.config          # Kernel configuration
│   └── busybox.config        # BusyBox configuration
├── build/v86/images/
│   ├── bzImage               # Linux kernel
│   └── rootfs.cpio           # Root filesystem (output)
└── Makefile
```

## Testing the Build

After building, verify the binary:

```bash
# Check file type
file freeciv-v86/bin/freeciv-web

# Should output something like:
# freeciv-web: ELF 32-bit LSB executable, Intel 80386, statically linked

# Check size
ls -lh freeciv-v86/bin/freeciv-web

# The static binary will be larger (several MB) due to included libraries
```

## Troubleshooting

### Build fails with "cannot find -lz"

Install 32-bit development libraries:
```bash
sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install zlib1g-dev:i386
```

### Binary is not statically linked

Some dependencies might not support full static linking. Check the build output for warnings about dynamic libraries.

### Build fails during configuration

Ensure you've run `prepare_freeciv.sh` first to checkout and patch the Freeciv source.

## Clean Build

To clean previous build artifacts:

```bash
./compile_freeciv_v86.sh --clean
```

## Advanced Configuration

To modify the build configuration, edit `compile_freeciv_v86.sh` and adjust the meson options:

- `-Doptimization=2` - Optimize for size (use `3` for speed)
- `-Dstrip=true` - Strip debug symbols (reduces size)
- `-Db_lto=true` - Link-time optimization (reduces size, slower build)

## References

- [v86 emulator](https://github.com/copy/v86) - x86 virtualization in JavaScript
- [v86-buildroot](https://github.com/chschnell/v86-buildroot) - Buildroot for v86
- [Buildroot manual](https://buildroot.org/downloads/manual/manual.html) - Building embedded Linux systems
- [FreecivWorld v86 documentation](../doc/v86-embedded-linux.md) - Integration details

## License

This build script is part of FreecivWorld and follows the same license (AGPL).
Freeciv itself is licensed under GPL v2+.
