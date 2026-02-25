# FC Types Generator

This script generates `fc_types.js` from the Freeciv C server source code, automatically extracting constants and eliminating hardcoded values.

## Purpose

This generator automatically extracts constants from the C source and generates the JavaScript file, reducing maintenance overhead and ensuring constants stay in sync with the C server code.

## What it extracts

The generator automatically extracts the following from Freeciv C headers:

### From utility/shared.h:
- **FC_INFINITY** - Large constant for unreachable conditions
- **fc_tristate enum** (TRI_NO, TRI_YES, TRI_MAYBE)

### From common/fc_types.h:
- **Simple #define constants**:
  - MAX_NUM_ITEMS, MAX_NUM_ADVANCES, MAX_NUM_UNITS, MAX_NUM_BUILDINGS
  - MAX_EXTRA_TYPES, MAX_LEN_NAME, IDENTITY_NUMBER_ZERO

- **ALL SPECENUM-based enums**, including:
  - Unit activities (ACTIVITY_*)
  - Action results (ACTRES_*)
  - Action sub-results (ACT_SUB_RES_*)
  - Action decisions (ACT_DEC_*)
  - Universal types (VUT_*)
  - Output types (O_*)
  - GUI types (GUI_*)
  - Vision layers (V_MAIN, V_INVIS, V_SUBSURFACE)
  - Extra causes (EC_IRRIGATION, EC_MINE, EC_ROAD, etc.)
  - Extra removal causes (ERM_PILLAGE, ERM_CLEANPOLLUTION, etc.)
  - Barbarian types (NOT_A_BARBARIAN, LAND_BARBARIAN, etc.)
  - Capital types (CAPITAL_NOT, CAPITAL_PRIMARY, CAPITAL_SECONDARY)
  - And 30+ other enums automatically

### From common/actions.h:
- Actions enum (ACTION_*)

### From common/actres.h:
- Action target kinds (ATK_*)
- Action sub-target kinds (ASTK_*)

### From common/requirements.h:
- Requirement ranges (REQ_RANGE_*)

### From common/worklist.h:
- MAX_LEN_WORKLIST

### From common/player.h:
- MAX_AI_LOVE

## Usage

The script is called automatically by `scripts/sync-js-hand.sh` during the build process.

Manual usage:
```bash
python3 scripts/gen_fc_types/gen_fc_types.py \
    -f /path/to/freeciv/source \
    -o /path/to/freeciv-web/src/main/webapp
```

## Client-Side Overrides

Some constants have different values in JavaScript for practical/compatibility reasons:

- **MAX_NUM_PLAYERS**: JavaScript uses 30 as a practical client limit (C server defines 500)
- **MAX_LEN_CITYNAME**: JavaScript uses 50 for compatibility (C server allows 120)

These overrides are defined at the top of gen_fc_types.py and clearly documented in the generated output.

## Maintenance

The script now automatically extracts ALL SPECENUM enums from fc_types.h, so adding new enums to the C code will automatically include them in the JavaScript output.

If you need to:
1. **Add a new simple #define**: Add it to the `simple_define_names` list in gen_fc_types.py
2. **Extract from a new header file**: Add a new `parse_simple_defines()` or `parse_specenum()` call
3. **Add a non-SPECENUM enum**: Use `parse_simple_enum()` like done for fc_tristate

Then regenerate by running sync-js-hand.sh or running the generator directly.

## Changes from Previous Version

- **Eliminated hardcoded constants**: Previously ~70 lines of hardcoded JavaScript constants (lines 388-455) have been replaced with automatic extraction from C headers
- **Extracts ALL SPECENUMs**: No longer limited to a specific list - automatically finds and exports all SPECENUM enums
- **Added utility/shared.h parsing**: Now extracts FC_INFINITY and fc_tristate enum
- **Better documentation**: Generated file now lists all source headers used
