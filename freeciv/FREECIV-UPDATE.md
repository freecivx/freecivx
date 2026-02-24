# Freeciv C Server Update Process

## Overview

This document describes the process of updating the Freeciv C server used in Freeciv-web to a newer version from the upstream Freeciv project.

## Update Information

- **Previous Version**: Freeciv 3.2.90-dev (commit 9dab02c, dated 2023-Apr-22)
- **New Version**: Freeciv 3.3.90-dev (dated 2026-Feb-24)
- **Update Date**: 2026-02-24

## Directory Structure

- `freeciv/freeciv-git-2026-02-24/` - Latest upstream Freeciv C server (unpatched)
- `freeciv/freeciv/` - Patched Freeciv C server for Freeciv-web
- `freeciv/patch/freeciv_web.patch` - Patch file containing all web-specific modifications
- `freeciv/prepare_freeciv.sh` - Build script
- `freeciv/version.txt` - Version information and capability strings

## Critical Patches for Freeciv-web

The freeciv_web.patch contains several categories of changes essential for web functionality:

### 1. Build System Changes
- **Files**: `meson.build`, `meson_options.txt`, `Makefile.am`
- **Purpose**: Configure build for freeciv-web server variant
- **Key Changes**:
  - Server option with 'freeciv-web' choice
  - Disabled client compilation
  - JSON protocol enabled
  - Static library linking
  - Removed unnecessary build targets

### 2. Web Protocol Extensions
- **Files**: `common/networking/packets.def`, `common/networking/packets.c`, `common/networking/packets_json.h`
- **Purpose**: Add web-specific network packets
- **Key Additions**:
  - `PACKET_WEB_GOTO_PATH_REQ` / `PACKET_WEB_GOTO_PATH` - Path visualization
  - `PACKET_WEB_INFO_TEXT_REQ` / `PACKET_WEB_INFO_TEXT_MESSAGE` - Tile/unit info display

### 3. Featured Text Format
- **Files**: `common/featured_text.c`
- **Purpose**: Convert server text formatting to HTML-compatible format
- **Key Changes**:
  - Changed markup brackets from `[...]` to `<...>`
  - Renamed color tags: `c` → `font`, `fg` → `color`
  - City/unit links converted to HTML `<a>` tags with onclick handlers
  - Modified color scheme for better web display (white backgrounds)

### 4. Map Data Enhancements
- **Files**: `common/tile.h`, `common/map.h`
- **Purpose**: Add height information for 3D terrain visualization
- **Key Changes**:
  - Added height field to tile data structure
  - Increased MAX_MAP_SIZE to 150 for larger maps

### 5. Authentication System
- **Files**: `server/auth.c`
- **Purpose**: Web-specific password authentication
- **Key Changes**:
  - Server password authentication for game access
  - Modified authentication flow for web environment

### 6. Save System Modifications
- **Files**: `server/commands.c`, `server/stdinhand.c`, `server/settings.c`, `server/savegame/savegame3.c`
- **Purpose**: Per-user save directories and web-specific save handling
- **Key Changes**:
  - Save command accessible at CTRL level (not just ADMIN)
  - User-based save directory support
  - Web-specific save path handling

### 7. Meta-server Reporting
- **Files**: `server/meta.c`, `server/meta.h`
- **Purpose**: Adjust meta-server behavior for web deployment
- **Key Changes**:
  - META_FORCE flag for mandatory reporting
  - Adjusted reporting intervals

### 8. Game Data & Rulesets
- **Files**: `data/classic/*.ruleset`, `data/civ2civ3/*.ruleset`, etc.
- **Purpose**: Web-specific game balance and features
- **Key Additions**:
  - New building: Windmill
  - New unit: Zeppelin
  - New resource: Cattle
  - Additional nations and flags
  - Adjusted map sizes and game parameters

### 9. Code Quality & Bug Fixes
- **Files**: Various
- **Purpose**: Stability improvements
- **Key Changes**:
  - Null pointer checks
  - CMA parameter loading fixes
  - Cargo iteration improvements
  - Memory management fixes

## Update Process

### 1. Preparation

```bash
cd freeciv/
# The new version is in freeciv-git-2026-02-24/
# The current patched version is in freeciv/
# The existing patch is in patch/freeciv_web.patch
```

### 2. Identify Changes

Compare the old and new upstream versions to understand what has changed:

```bash
# Check version differences
diff -u freeciv/fc_version freeciv-git-2026-02-24/fc_version

# Identify structural changes in key files
diff -u freeciv/meson.build freeciv-git-2026-02-24/meson.build
diff -u freeciv/common/networking/packets.def freeciv-git-2026-02-24/common/networking/packets.def
```

### 3. Review Existing Patch

Analyze which hunks from the existing patch:
- Already exist in the new version (accepted upstream)
- Can be applied automatically
- Need manual updating due to code changes
- Are no longer relevant

### 4. Apply and Update Patch

The process involves:

1. Start with a fresh copy of the new upstream version
2. Attempt to apply the existing patch:
   ```bash
   cd freeciv-git-2026-02-24
   patch -p1 < ../patch/freeciv_web.patch
   ```
3. For failed hunks, manually review and apply changes:
   - Check if the change is still needed
   - Find the equivalent location in the new code
   - Apply the change manually or adjust the patch
4. Test compilation after each major change

### 5. Generate Updated Patch

Once all changes are applied:

```bash
# From freeciv/ directory
diff -Naru freeciv-git-2026-02-24 freeciv > patch/freeciv_web.patch
```

### 6. Update Build Scripts

Update references to use the new version:

- `freeciv/prepare_freeciv.sh` - Change build source directory
- `scripts/install/install.sh` - Update sync-js-hand.sh call
- `freeciv/version.txt` - Update version metadata

### 7. Update Version Metadata

Update `version.txt` with new commit information:

```bash
# In freeciv/freeciv-git-2026-02-24/, find the commit hash
git log -1 --format="%H"

# Update FCREV in version.txt
# Update ORIGCAPSTR with new version string from fc_version
# Keep WEBCAPSTR stable for compatibility
```

### 8. Test Build

```bash
cd freeciv/
bash prepare_freeciv.sh
cd build
ninja install
```

### 9. Verify Derived Files

After successful build, regenerate JavaScript handlers:

```bash
cd scripts/
bash sync-js-hand.sh \
  -f /path/to/freeciv/freeciv \
  -i ~/freeciv \
  -o /path/to/freeciv-web/src/derived/webapp \
  -d /path/to/webapps/data
```

## Common Issues and Solutions

### Issue: Patch Hunks Fail

**Solution**: 
1. Examine the failed hunk context
2. Search for the equivalent code in the new version
3. Apply changes manually
4. Consider if the change is still necessary

### Issue: Build Errors

**Solution**:
1. Check if new dependencies are required
2. Verify meson options are correctly set
3. Review compiler errors for API changes
4. Update patch to match new APIs

### Issue: Protocol Changes

**Solution**:
1. Check if packet definitions have changed format
2. Update packet handlers to match new structure
3. Ensure JSON protocol compatibility
4. Test with actual game connections

### Issue: Compilation Errors After Patch

**Solution**:
1. Check for renamed functions or files
2. Update includes if headers moved
3. Verify data types match
4. Check for deprecated APIs

## Testing Checklist

After updating:

- [ ] Freeciv C server builds successfully
- [ ] prepare_freeciv.sh completes without errors
- [ ] sync-js-hand.sh generates JavaScript files
- [ ] Server starts and accepts connections
- [ ] Web client can connect and play
- [ ] Save/load functionality works
- [ ] Chat and text formatting displays correctly
- [ ] Map rendering includes height data
- [ ] Custom rulesets load properly
- [ ] Authentication system functions

## Rollback Procedure

If the update causes issues:

1. Restore the previous freeciv directory:
   ```bash
   cd freeciv/
   rm -rf freeciv
   mv freeciv-old-backup freeciv
   ```

2. Revert prepare_freeciv.sh changes

3. Rebuild with the old version:
   ```bash
   bash prepare_freeciv.sh
   ```

## References

- Upstream Freeciv: https://github.com/freeciv/freeciv
- Freeciv-web patches: https://github.com/freecivworld/freecivworld/tree/main/freeciv/patch
- Meson build system: https://mesonbuild.com/

## Notes

- The WEBCAPSTR in version.txt should remain stable to maintain compatibility
- Not all upstream changes need to be in the patch (only web-specific modifications)
- Always test the full build process after updating
- Keep the patch file well-organized and documented
- Some features may be accepted upstream over time, reducing patch complexity

## Maintenance

Regular updates are recommended to:
- Get bug fixes from upstream
- Access new features
- Reduce patch divergence
- Improve security

Suggested update frequency: Every 3-6 months, or when critical fixes are available.
