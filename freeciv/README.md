Freeciv C server 
----------------

This is the forked Freeciv C server.

## Build Scripts

**prepare_freeciv.sh** - A script which will checkout Freeciv from Git, then patch apply the patches and finally configure and compile the Freeciv C server.

**build_freeciv_v86.sh** - Builds Freeciv C server as a static x86 executable for v86 buildroot. The v86 project (https://github.com/copy/v86) is an x86 emulator that runs in the browser. This script creates a fully static binary suitable for running in the v86 environment.

Output directory: `freeciv-v86/`

See the script comments for detailed instructions on integrating the compiled binary with v86-buildroot and including websockify support.

## Files

**version.txt** - Contains the Git revision of Freeciv to check out from Git.

