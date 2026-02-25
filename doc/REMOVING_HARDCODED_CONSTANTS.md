# Removing Hardcoded Constants from JavaScript

## Problem

Previously, JavaScript constants in Freeciv-web were manually copied from the Freeciv C server code. This created several issues:

1. **Maintenance burden**: When constants changed in the C server, they had to be manually updated in JavaScript
2. **Risk of desynchronization**: It was easy for JavaScript constants to get out of sync with the C server
3. **No single source of truth**: The same constant was defined in multiple places

## Solution

We created an automated generation system that extracts constants from the C server and generates JavaScript files. This approach:

1. **Eliminates manual duplication**: Constants are extracted automatically from C source
2. **Ensures synchronization**: JavaScript constants are always in sync with the C server
3. **Reduces errors**: Automated extraction eliminates transcription errors
4. **Makes updates easier**: When C constants change, just regenerate the JavaScript

## Implementation

### Generator Script

The core of the solution is `scripts/gen_fc_types/gen_fc_types.py`, which:

1. Parses C header files from the Freeciv server
2. Extracts `#define` constants and `SPECENUM` enums
3. Generates `fc_types.js` with all the constants

### Integration with Build Process

The generator is integrated into `scripts/sync-js-hand.sh`, which is called during the build process. This ensures that JavaScript constants are automatically regenerated whenever the build syncs from the C server.

### Files Modified

- **Created**: `scripts/gen_fc_types/gen_fc_types.py` - The generator script
- **Created**: `scripts/gen_fc_types/README.md` - Documentation for the generator
- **Modified**: `scripts/sync-js-hand.sh` - Now calls the generator
- **Modified**: `freeciv-web/src/main/webapp/javascript/fc_types.js` - Now generated (was hardcoded)
- **Modified**: `freeciv-web/src/main/webapp/javascript/player.js` - Removed duplicate constants
- **Modified**: `freeciv-web/src/main/webapp/javascript/city.js` - Removed duplicate constants

## Constants Extracted

The generator extracts over 300 constants from the C server, including:

- **Size limits**: MAX_NUM_ITEMS, MAX_NUM_ADVANCES, MAX_NUM_UNITS, etc.
- **Activities**: ACTIVITY_IDLE, ACTIVITY_MINE, ACTIVITY_IRRIGATE, etc.
- **Actions**: ACTION_ESTABLISH_EMBASSY, ACTION_FOUND_CITY, etc. (116 constants)
- **Action results**: ACTRES_*, ATK_*, ASTK_* (70+ constants)
- **Universal types**: VUT_NONE through VUT_COUNT (52 constants)
- **Output types**: O_FOOD, O_SHIELD, O_TRADE, etc.
- And many more...

## Special Cases

Some constants have different values in JavaScript vs C:

1. **MAX_NUM_PLAYERS**: C server supports 500, but JavaScript client uses 30 as a practical limit
2. **MAX_LEN_CITYNAME**: C allows 120 characters, JavaScript uses 50 for compatibility
3. **FC_INFINITY**: Not defined in C headers, JavaScript-specific constant

These special cases are documented at the top of `gen_fc_types.py` as named constants.

## Usage

### During Development

When developing locally and syncing from the C server:

```bash
cd /path/to/freecivworld
bash scripts/sync-js-hand.sh \
    -f freeciv/freeciv \
    -i /path/to/freeciv/install \
    -o freeciv-web/src/main/webapp \
    -d /path/to/data/dir
```

This will automatically regenerate `fc_types.js`.

### Manual Generation

To manually regenerate just the constants file:

```bash
python3 scripts/gen_fc_types/gen_fc_types.py \
    -f freeciv/freeciv \
    -o freeciv-web/src/main/webapp
```

## Future Enhancements

Potential improvements to this system:

1. **Additional constants**: Extract more constants from other C header files
2. **TypeScript definitions**: Generate TypeScript type definitions
3. **Documentation generation**: Auto-generate documentation for constants
4. **Validation**: Add checks to ensure JavaScript code uses the latest constants

## Maintenance

When new constants are added to the C server that should be available in JavaScript:

1. Edit `scripts/gen_fc_types/gen_fc_types.py`
2. Add the constant name to the appropriate list (e.g., `simple_define_names`)
3. Or add the enum name to the appropriate `parse_specenum()` call
4. Regenerate by running `sync-js-hand.sh` or the generator directly

For more details, see `scripts/gen_fc_types/README.md`.
