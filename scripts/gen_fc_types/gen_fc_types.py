#!/usr/bin/env python3

'''**********************************************************************
    Copyright (C) 2024  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************'''

from os import path
import argparse
import re

# JavaScript-specific constant overrides
# These values differ from C server for client-side practical reasons
JS_MAX_NUM_PLAYERS = 30  # C server supports 500, but client uses 30 as practical limit
JS_MAX_LEN_CITYNAME = 50  # C server allows 120, but client uses 50 for compatibility
JS_FC_INFINITY = 1000 * 1000 * 1000  # Not defined in C headers, client-specific constant

parser = argparse.ArgumentParser(
    description='Generate fc_types_gen.js from freeciv C sources')
parser.add_argument('-f', '--freeciv', required=True, help='path to (original) freeciv project')
parser.add_argument('-o', '--outdir', default='.', help='path to webapp output directory')
args = parser.parse_args()

webapp_dir = args.outdir
freeciv_dir = args.freeciv

common_dir = path.join(freeciv_dir, "common")
utility_dir = path.join(freeciv_dir, "utility")

# Data structures to hold extracted constants
simple_defines = []  # Simple #define constants
specenum_constants = {}  # SPECENUM-based enums

# Regex patterns
define_re = re.compile(r'^\s*#define\s+([A-Z_][A-Z0-9_]*)\s+(\d+)\s*(?:/\*.*\*/)?$')
define_expr_re = re.compile(r'^\s*#define\s+([A-Z_][A-Z0-9_]*)\s+\((.+?)\)\s*(?:/\*.*\*/)?$')
specenum_name_re = re.compile(r'^\s*#define\s+SPECENUM_NAME\s+(\w+)\s*$')
specenum_value_re = re.compile(r'^\s*#define\s+SPECENUM_VALUE(\d+)\s+([A-Z_][A-Z0-9_]*)\s*$')
specenum_count_re = re.compile(r'^\s*#define\s+SPECENUM_COUNT\s+([A-Z_][A-Z0-9_]*)\s*$')
include_specenum_re = re.compile(r'^\s*#include\s+"specenum_gen\.h"\s*$')

in_comment = False


def remove_comments(line):
    """Remove C-style comments from a line"""
    global in_comment
    if in_comment:
        found = line.find("*/", 0)
        if found == -1:
            return ""
        else:
            in_comment = False
            line = line[found + 2:]
    
    while True:
        found = line.find("/*", 0)
        if found != -1:
            end = line.find("*/", found + 2)
            if end != -1:
                line = line[:found] + line[end + 2:]
            else:
                in_comment = True
                return line[:found]
        else:
            break
    
    return line


def parse_specenum(file_path, extract_names=None):
    """Parse a file for SPECENUM definitions.
    
    Args:
        file_path: Path to the C header file
        extract_names: Optional list of enum names to extract (None = extract all)
    
    Returns:
        Dictionary mapping enum names to their constants
    """
    global in_comment
    in_comment = False
    
    enums = {}
    current_enum_name = None
    current_enum_values = []
    current_enum_count = None
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = remove_comments(line)
            
            # Check for SPECENUM_NAME
            match = specenum_name_re.match(line)
            if match:
                # Save previous enum if any
                if current_enum_name and (extract_names is None or current_enum_name in extract_names):
                    enums[current_enum_name] = {
                        'values': current_enum_values,
                        'count': current_enum_count
                    }
                
                # Start new enum
                current_enum_name = match.group(1)
                current_enum_values = []
                current_enum_count = None
                continue
            
            # Check for SPECENUM_VALUE
            match = specenum_value_re.match(line)
            if match and current_enum_name:
                index = int(match.group(1))
                name = match.group(2)
                # Ensure list is long enough
                while len(current_enum_values) <= index:
                    current_enum_values.append(None)
                current_enum_values[index] = name
                continue
            
            # Check for SPECENUM_COUNT
            match = specenum_count_re.match(line)
            if match and current_enum_name:
                current_enum_count = match.group(1)
                continue
            
            # Check for include specenum_gen.h (end of enum)
            if include_specenum_re.match(line) and current_enum_name:
                if extract_names is None or current_enum_name in extract_names:
                    enums[current_enum_name] = {
                        'values': current_enum_values,
                        'count': current_enum_count
                    }
                current_enum_name = None
                current_enum_values = []
                current_enum_count = None
    
    return enums


def parse_simple_defines(file_path, define_names):
    """Parse simple #define constants from a C header file.
    
    Args:
        file_path: Path to the C header file
        define_names: List of define names to extract
    
    Returns:
        Dictionary mapping define names to their values (can be int or string expression)
    """
    global in_comment
    in_comment = False
    
    defines = {}
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = remove_comments(line)
            
            # Check for simple #define with numeric value
            match = define_re.match(line)
            if match:
                name = match.group(1)
                value = match.group(2)
                if name in define_names:
                    defines[name] = int(value)
                continue
            
            # Check for #define with expression in parentheses
            match = define_expr_re.match(line)
            if match:
                name = match.group(1)
                expr = match.group(2).strip()
                if name in define_names:
                    # Try to evaluate simple expressions
                    try:
                        defines[name] = eval(expr.replace(' ', ''))
                    except:
                        # If evaluation fails, store as string
                        defines[name] = expr
    
    return defines


def parse_simple_enum(file_path, enum_name):
    """Parse a simple C enum (not SPECENUM) from a header file.
    
    Args:
        file_path: Path to the C header file
        enum_name: Name of the enum to extract
    
    Returns:
        Dictionary with 'values' list of enum constant names in order
    """
    global in_comment
    in_comment = False
    
    # Match both multi-line and single-line enum definitions
    enum_re = re.compile(rf'^\s*enum\s+{enum_name}\s*{{')
    enum_single_line_re = re.compile(rf'^\s*enum\s+{enum_name}\s*{{\s*(.+?)\s*}};')
    enum_value_re = re.compile(r'^\s*([A-Z_][A-Z0-9_]*)\s*(?:=\s*(\d+))?\s*,?\s*(?:/\*.*\*/)?$')
    
    enum_values = []
    in_enum = False
    next_value = 0
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = remove_comments(line)
            
            # Check for single-line enum definition first
            match = enum_single_line_re.search(line)
            if match:
                # Parse all values in the single line
                values_str = match.group(1)
                for value_str in values_str.split(','):
                    value_str = value_str.strip()
                    if not value_str:
                        continue
                    # Extract just the name (ignore explicit values for simplicity)
                    name_match = re.match(r'([A-Z_][A-Z0-9_]*)', value_str)
                    if name_match:
                        name = name_match.group(1)
                        enum_values.append(name)
                return {'values': enum_values, 'count': None}
            
            # Check if we're starting a multi-line enum
            if enum_re.search(line):
                in_enum = True
                continue
            
            if in_enum:
                # Check for end of enum
                if '}' in line:
                    break
                
                # Check for enum value
                match = enum_value_re.match(line)
                if match:
                    name = match.group(1)
                    explicit_value = match.group(2)
                    if explicit_value:
                        value = int(explicit_value)
                        next_value = value + 1
                    else:
                        value = next_value
                        next_value += 1
                    
                    # Ensure list is long enough
                    while len(enum_values) <= value:
                        enum_values.append(None)
                    enum_values[value] = name
    
    return {'values': enum_values, 'count': None}


# Extract simple #define constants from fc_types.h
print(f"Parsing {path.join(common_dir, 'fc_types.h')} for simple defines...")
simple_define_names = [
    'MAX_NUM_ITEMS',
    'MAX_NUM_ADVANCES',
    'MAX_NUM_UNITS',
    'MAX_NUM_BUILDINGS',
    'MAX_EXTRA_TYPES',
    'MAX_LEN_NAME',
    'IDENTITY_NUMBER_ZERO',
]

fc_types_defines = parse_simple_defines(
    path.join(common_dir, 'fc_types.h'),
    simple_define_names
)

# Extract MAX_NUM_PLAYERS (computed value)
# In C: MAX_NUM_PLAYERS = MAX_NUM_PLAYER_SLOTS - MAX_NUM_BARBARIANS = 512 - 12 = 500
# But JavaScript uses a lower value as a client-side practical limitation
# This value is defined at the top of this script as JS_MAX_NUM_PLAYERS

# Extract from worklist.h
worklist_defines = parse_simple_defines(
    path.join(common_dir, 'worklist.h'),
    ['MAX_LEN_WORKLIST']
)

# Extract from player.h
player_defines = parse_simple_defines(
    path.join(common_dir, 'player.h'),
    ['MAX_AI_LOVE']
)

# Note: MAX_LEN_CITYNAME is 120 in C but 50 in JS - this might be intentional
# Let's extract it but note the discrepancy
cityname_defines = parse_simple_defines(
    path.join(common_dir, 'fc_types.h'),
    ['MAX_LEN_CITYNAME']
)

# Extract ALL SPECENUM enums from fc_types.h (not just a select few)
print(f"Parsing {path.join(common_dir, 'fc_types.h')} for all SPECENUMs...")
fc_types_enums = parse_specenum(
    path.join(common_dir, 'fc_types.h'),
    extract_names=None  # Extract all enums
)

# Extract action enums from actions.h
print(f"Parsing {path.join(common_dir, 'actions.h')} for action enums...")
actions_enums = parse_specenum(
    path.join(common_dir, 'actions.h'),
    extract_names=['gen_action']
)

# Extract action target enums from actres.h
print(f"Parsing {path.join(common_dir, 'actres.h')} for action target enums...")
actres_enums = parse_specenum(
    path.join(common_dir, 'actres.h'),
    extract_names=['action_target_kind', 'action_sub_target_kind']
)

# Extract requirement range from requirements.h if it exists
print(f"Parsing {path.join(common_dir, 'requirements.h')} for requirement enums...")
try:
    requirements_enums = parse_specenum(
        path.join(common_dir, 'requirements.h'),
        extract_names=['req_range']
    )
except FileNotFoundError:
    requirements_enums = {}

# Parse additional simple defines
print(f"Parsing additional constants...")

# Extract FC_INFINITY from utility/shared.h
utility_defines = parse_simple_defines(
    path.join(utility_dir, 'shared.h'),
    ['FC_INFINITY']
)

# Parse fc_tristate enum from utility/shared.h
print(f"Parsing {path.join(utility_dir, 'shared.h')} for fc_tristate enum...")
try:
    fc_tristate_enum = parse_simple_enum(
        path.join(utility_dir, 'shared.h'),
        'fc_tristate'
    )
except Exception as e:
    print(f"Warning: Could not parse fc_tristate enum: {e}")
    fc_tristate_enum = {'values': [], 'count': None}

# Parse req_problem_type enum from fc_types.h
print(f"Parsing {path.join(common_dir, 'fc_types.h')} for req_problem_type enum...")
try:
    req_problem_type_enum = parse_simple_enum(
        path.join(common_dir, 'fc_types.h'),
        'req_problem_type'
    )
except Exception as e:
    print(f"Warning: Could not parse req_problem_type enum: {e}")
    req_problem_type_enum = {'values': [], 'count': None}

# Generate JavaScript output
output_name = path.join(webapp_dir, 'javascript/fc_types.js')
with open(output_name, 'w') as f:
    f.write('''/****************************************
 * THIS IS A GENERATED FILE, DO NOT EDIT
 *
 * Generated from Freeciv C source files:
 *   utility/shared.h
 *   common/fc_types.h
 *   common/actions.h
 *   common/actres.h
 *   common/requirements.h
 *   common/worklist.h
 *   common/player.h
 * By scripts/gen_fc_types/gen_fc_types.py
 ****************************************/

''')
    
    # Write simple #define constants
    f.write('/* Simple constants from fc_types.h */\n')
    for name in simple_define_names:
        if name in fc_types_defines:
            f.write(f'var {name} = {fc_types_defines[name]};\n')
    
    # Add FC_INFINITY (extracted from utility/shared.h)
    if 'FC_INFINITY' in utility_defines:
        f.write(f'var FC_INFINITY = {utility_defines["FC_INFINITY"]};\n')
    else:
        # Fallback to JS override if not found
        f.write(f'var FC_INFINITY = {JS_FC_INFINITY};\n')
    
    # Add MAX_NUM_PLAYERS (client-side limit, differs from server MAX_NUM_PLAYER_SLOTS)
    f.write(f'\n/* Client-side player limit (server MAX_NUM_PLAYERS = 500) */\n')
    f.write(f'var MAX_NUM_PLAYERS = {JS_MAX_NUM_PLAYERS};\n')
    
    # Add MAX_LEN_WORKLIST from worklist.h
    if 'MAX_LEN_WORKLIST' in worklist_defines:
        f.write(f'\n/* From common/worklist.h */\n')
        f.write(f'var MAX_LEN_WORKLIST = {worklist_defines["MAX_LEN_WORKLIST"]};\n')
    
    # Add MAX_AI_LOVE from player.h
    if 'MAX_AI_LOVE' in player_defines:
        f.write(f'\n/* From common/player.h */\n')
        f.write(f'var MAX_AI_LOVE = {player_defines["MAX_AI_LOVE"]};\n')
    
    # Note about MAX_LEN_CITYNAME
    if 'MAX_LEN_CITYNAME' in cityname_defines:
        f.write(f'\n/* Note: MAX_LEN_CITYNAME is {cityname_defines["MAX_LEN_CITYNAME"]} in C,')
        f.write(f' but limited to {JS_MAX_LEN_CITYNAME} in JS for compatibility */\n')
        f.write(f'var MAX_LEN_CITYNAME = {JS_MAX_LEN_CITYNAME};\n')
    
    f.write('\n')
    
    # Helper function to write enum
    def write_enum(f, enum_name, enum_data, comment=None):
        if not enum_data or 'values' not in enum_data:
            return
        
        if comment:
            f.write(f'\n/* {comment} */\n')
        
        for i, value in enumerate(enum_data['values']):
            if value:
                f.write(f'var {value} = {i};\n')
        
        if enum_data['count']:
            f.write(f'var {enum_data["count"]} = {len(enum_data["values"])};\n')
    
    # Write fc_tristate from utility/shared.h
    if fc_tristate_enum and fc_tristate_enum['values']:
        write_enum(f, 'fc_tristate', fc_tristate_enum,
                   'fc_tristate enum from utility/shared.h')
    
    # Write req_problem_type from fc_types.h
    if req_problem_type_enum and req_problem_type_enum['values']:
        write_enum(f, 'req_problem_type', req_problem_type_enum,
                   'req_problem_type enum (RPT_*) from common/fc_types.h')
    
    # Priority order for specific enums we want to ensure are written first
    priority_enums = [
        'unit_activity',
        'action_result', 
        'action_sub_result',
        'action_decision',
        'vision_layer',
        'extra_cause',
        'extra_rmcause',
        'barbarian_type',
        'capital_type',
        'universals_n',
        'output_type_id'
    ]
    
    # Write priority enums from fc_types.h first
    for enum_name in priority_enums:
        if enum_name in fc_types_enums:
            write_enum(f, enum_name, fc_types_enums[enum_name],
                      f'{enum_name} from common/fc_types.h')
    
    # Write remaining enums from fc_types.h that weren't in priority list
    for enum_name, enum_data in sorted(fc_types_enums.items()):
        if enum_name not in priority_enums:
            write_enum(f, enum_name, enum_data,
                      f'{enum_name} from common/fc_types.h')
    
    # Write actions from actions.h
    if 'gen_action' in actions_enums:
        write_enum(f, 'gen_action', actions_enums['gen_action'],
                   'Actions (ACTION_*) from common/actions.h')
        
        # Add backward compatibility alias
        f.write('\n/* Backward compatibility aliases */\n')
        f.write('var ACTION_RECYCLE_UNIT = ACTION_DISBAND_UNIT_RECOVER; // TODO: Update code to use ACTION_DISBAND_UNIT_RECOVER\n')
    
    # Write action target enums from actres.h
    for enum_name in ['action_target_kind', 'action_sub_target_kind']:
        if enum_name in actres_enums:
            write_enum(f, enum_name, actres_enums[enum_name],
                      f'{enum_name} from common/actres.h')
    
    # Write requirement enums from requirements.h
    for enum_name, enum_data in requirements_enums.items():
        write_enum(f, enum_name, enum_data,
                  f'{enum_name} from common/requirements.h')
    
    # Add derived constants that JavaScript needs for compatibility
    f.write('''
/* Derived constants for compatibility */
var B_LAST = MAX_NUM_BUILDINGS;
var A_LAST = (MAX_NUM_ADVANCES + 1);
var U_LAST = MAX_NUM_UNITS;

/* JavaScript-specific boolean constants */
var TRUE = true;
var FALSE = false;
''')

print(f"Generated {output_name}")
print(f"  - Extracted {len(fc_types_defines)} simple defines")
print(f"  - Extracted {len(fc_types_enums)} enums from fc_types.h")
print(f"  - Extracted {len(actions_enums)} enums from actions.h")
print(f"  - Extracted {len(actres_enums)} enums from actres.h")
print(f"  - Extracted {len(requirements_enums)} enums from requirements.h")
