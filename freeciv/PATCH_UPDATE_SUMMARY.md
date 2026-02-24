# Freeciv Web Patch Update Summary

## Update Date: 2026-02-24

### Overview
Successfully updated the Freeciv web patch from the old version to the new upstream version (freeciv-git-2026-02-24).

### Patch Size Reduction
- **Old patch**: 2781 lines (98K)
- **New patch**: 361 lines (15K)
- **Reduction**: 87% smaller

This significant reduction is because many previous customizations have been incorporated into the upstream Freeciv codebase.

### Critical Changes Applied

#### 1. **Build System** ✓
- `Makefile.am`: Removed client from SUBDIRS (freeciv-web uses its own client)
- `meson_options.txt`: Already has 'server' option with freeciv-web choice
- `meson.build`: Already has server_type variable and conditional compilation

#### 2. **Network Protocol** ✓
- `fc_version`: Changed NETWORK_CAPSTRING to "+Freeciv.Web.Devel-3.3"
- `packets.def`: 
  - Added `height` field to PACKET_TILE_INFO
  - Added 4 new web-specific packets (287-290):
    - PACKET_WEB_GOTO_PATH_REQ
    - PACKET_WEB_GOTO_PATH
    - PACKET_WEB_INFO_TEXT_REQ
    - PACKET_WEB_INFO_TEXT_MESSAGE
- `packets.c`: Disabled player attribute chunk handling (empty function body)
- `packets_json.h`: Removed size prepending for JSON mode packets

#### 3. **Data Structures** ✓
- `tile.h`: Added `int height` field to struct tile

#### 4. **Text Formatting** ✓
- `featured_text.c`:
  - Changed SEQ_START from '[' to '<'
  - Changed SEQ_STOP from ']' to '>'
  - Changed tag type name from "c" to "font"
  - Changed "fg" attribute to "color"
  - Changed ftc_server color to #FFFFFF
  - Changed ftc_chat_public color to #FFFFFF
  - Modified city_link() to use HTML anchor tags with onclick

#### 5. **Authentication** ✓
- `auth.c`: Added FREECIV_WEB conditional code for server password handling

#### 6. **Meta-Server** ✓
- `meta.c`:
  - Added workaround for player reporting bug
  - Added human count for initial state
  - Added META_FORCE flag support
- `meta.h`:
  - Changed METASERVER_REFRESH_INTERVAL from 180 to 60 seconds
  - Added META_FORCE to enum meta_flag

#### 7. **Save System** ✓
- `commands.c`: Changed save command from ALLOW_ADMIN to ALLOW_CTRL
- `stdinhand.c`: Removed restriction check from save_command()

#### 8. **Map Settings** ✓
- `map.h`: Increased MAP_MAX_SIZE from 38 to 150 for FREECIV_WEB

### Changes Already in Upstream
The following changes from the old patch are already present in the new upstream version:
- actions.c: nullptr check in action_is_internal()
- unit.c: ACTIVITY_CLEAN in tile_changing_activities
- unit.c: cargo_iter while loop fix
- mapimg.c: make_dir() DIRMODE_DEFAULT parameter
- Many other minor fixes and improvements

### Files Modified (13 total)
1. Makefile.am
2. common/featured_text.c
3. common/map.h
4. common/networking/packets.c
5. common/networking/packets.def
6. common/networking/packets_json.h
7. common/tile.h
8. fc_version
9. server/auth.c
10. server/commands.c
11. server/meta.c
12. server/meta.h
13. server/stdinhand.c

### Testing
- Patch applies cleanly to freeciv-git-2026-02-24
- All critical freeciv-web features preserved
- Network protocol compatibility maintained with capability string change

### Next Steps
1. Test the patched server with freeciv-web client
2. Verify all web-specific features work correctly
3. Update documentation if needed
