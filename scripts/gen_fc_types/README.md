# FC Types Generator

This script generates `fc_types.js` from the Freeciv C server source code, eliminating the need to manually maintain hardcoded constants.

## Purpose

Previously, JavaScript constants in `fc_types.js` were manually maintained copies of C constants defined in the Freeciv server. This created maintenance overhead and risk of constants getting out of sync when the C code changed.

This generator automatically extracts constants from the C source and generates the JavaScript file.

## What it extracts

The generator extracts the following from Freeciv C common headers:

- **Simple #define constants** from `fc_types.h`:
  - MAX_NUM_ITEMS, MAX_NUM_ADVANCES, MAX_NUM_UNITS, MAX_NUM_BUILDINGS
  - MAX_EXTRA_TYPES, MAX_LEN_NAME, MAX_LEN_CITYNAME

- **SPECENUM-based enums**:
  - Unit activities (ACTIVITY_*) from `fc_types.h`
  - Action results (ACTRES_*) from `fc_types.h`
  - Actions (ACTION_*) from `actions.h`
  - Action target kinds (ATK_*) from `actres.h`
  - Action sub-target kinds (ASTK_*) from `actres.h`
  - Universal types (VUT_*) from `fc_types.h`
  - Output types (O_*) from `fc_types.h`
  - GUI types (GUI_*) from `fc_types.h`
  - Requirement ranges (REQ_RANGE_*) from `requirements.h` (if available)
  - Action decision (ACT_DEC_*) from `fc_types.h`
  - Action sub-result (ACT_SUB_RES_*) from `fc_types.h`
  - Vision layer (V_*) from `fc_types.h`
  - Extra causes (EC_*) from `fc_types.h`
  - Extra removal causes (ERM_*) from `fc_types.h`
  - Barbarian types (NOT_A_BARBARIAN, LAND_BARBARIAN, etc.) from `fc_types.h`
  - Capital types (CAPITAL_*) from `fc_types.h`

- **Regular C enums**:
  - Requirement problem types (RPT_*) from `fc_types.h`

- **Other constants**:
  - MAX_LEN_WORKLIST from `worklist.h`
  - MAX_AI_LOVE from `player.h`

## Usage

The script is called automatically by `scripts/sync-js-hand.sh` during the build process.

Manual usage:
```bash
python3 scripts/gen_fc_types/gen_fc_types.py \
    -f /path/to/freeciv/source \
    -o /path/to/freeciv-web/src/main/webapp
```

## Notes

- **MAX_NUM_PLAYERS**: The C server defines this as 500 (MAX_NUM_PLAYER_SLOTS - MAX_NUM_BARBARIANS), but the JavaScript client uses 30 as a practical limit. This is intentional.

- **MAX_LEN_CITYNAME**: The C server allows 120 characters, but JavaScript uses 50 for compatibility reasons.

- **FC_INFINITY**: This constant doesn't appear in the C headers but is needed in JavaScript, so it's hardcoded in the generator as `(1000 * 1000 * 1000)`.

- **ACTION_RECYCLE_UNIT**: An alias is provided for backward compatibility. This maps to ACTION_DISBAND_UNIT_RECOVER to match the server-side naming.

## Maintenance

If new constants are added to the C server that should be available in JavaScript:

1. If it's a simple #define, add it to the `simple_define_names` list in the generator
2. If it's a SPECENUM enum, add the enum name to the appropriate `parse_specenum()` call
3. If it's from a new header file, add a new `parse_simple_defines()` or `parse_specenum()` call

Then regenerate by running sync-js-hand.sh or running the generator directly.
