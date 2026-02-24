Freeciv C server 
----------------

This directory contains the patched Freeciv C server for Freeciv-web.

## Directory Structure

- `freeciv/` - Patched Freeciv C server (ready to build)
- `freeciv-git-2026-02-24/` - Unpatched upstream Freeciv source
- `patch/freeciv_web.patch` - Patch file with web-specific modifications
- `prepare_freeciv.sh` - Build script that compiles the Freeciv C server
- `version.txt` - Version information and capability strings
- `FREECIV-UPDATE.md` - Documentation for updating to newer Freeciv versions

## Building

Run `prepare_freeciv.sh` to build the Freeciv C server:

```bash
bash ./prepare_freeciv.sh
```

This will create a `build/` directory and compile the server using Meson and Ninja.

## Version Information

Current version: Freeciv 3.3.90-dev (2026-02-24)

See `FREECIV-UPDATE.md` for details on the update process and patch contents.

