# Freeciv Web Patch

This directory contains the patch file that modifies the upstream Freeciv server to work with the Freeciv-web client.

## Files

- `freeciv_web.patch` - Current patch for Freeciv (361 lines, updated 2026-02-24)
- `freeciv_web.patch.old` - Previous patch version (2781 lines, kept for reference)

## Applying the Patch

To apply the patch to a fresh Freeciv source tree:

```bash
cd freeciv-git-2026-02-24
patch -p1 < ../patch/freeciv_web.patch
```

## What the Patch Does

The patch makes the following critical modifications:

1. **Network Protocol**: Changes capability string and adds web-specific packets
2. **Text Formatting**: Adapts featured text for HTML rendering
3. **Authentication**: Adds server password support for private games
4. **Meta-server**: Adjusts reporting intervals and player counting
5. **Build System**: Removes client build (freeciv-web has its own)
6. **Data Structures**: Adds height field for 3D rendering
7. **Save System**: Relaxes save command restrictions

## Maintenance

When updating to a new Freeciv version:

1. Copy the new upstream version to a new directory
2. Create a copy for patching: `cp -r freeciv-upstream freeciv-new-patched`
3. Review the existing patch and manually apply critical changes
4. Generate new patch: `diff -Naru freeciv-upstream freeciv-new-patched > patch/freeciv_web.patch`
5. Test patch application on a fresh copy
6. Verify all web-specific features work

## See Also

- `../PATCH_UPDATE_SUMMARY.md` - Detailed summary of the latest update
- `../PATCH_COMPARISON.txt` - Comparison between old and new patches
