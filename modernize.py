#!/usr/bin/env python3
"""
Script to modernize JavaScript files to ES6+ syntax.
Handles: var -> const/let, arrow functions, template literals, etc.
"""

import re
import sys
from pathlib import Path


def modernize_js(content):
    """Apply ES6+ modernizations to JavaScript content."""
    original = content
    lines = content.split('\n')
    
    # Add 'use strict' if not present at the top (after comments/copyright)
    has_strict = False
    first_code_line = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*') or not stripped:
            continue
        if 'use strict' in stripped:
            has_strict = True
        first_code_line = i
        break
    
    if not has_strict and first_code_line > 0:
        # Insert 'use strict' after copyright header
        lines.insert(first_code_line, "'use strict';")
        lines.insert(first_code_line + 1, '')
    
    content = '\n'.join(lines)
    
    # Convert var to const/let (simple cases - variables that are assigned once)
    # This is a conservative approach - only convert obvious const cases
    content = re.sub(
        r'\bvar\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([^;]+;)',
        lambda m: f"const {m.group(1)} = {m.group(2)}",
        content
    )
    
    # Convert remaining var to let
    content = re.sub(r'\bvar\b', 'let', content)
    
    # Convert simple string concatenation to template literals
    # Pattern: "string" + variable + "string"
    def convert_concat(match):
        expr = match.group(0)
        # Skip if already a template literal or complex
        if '`' in expr or '${' in expr:
            return expr
        
        # Simple pattern: convert "text" + var + "text" to `text${var}text`
        parts = re.split(r'\s*\+\s*', expr)
        if len(parts) <= 1:
            return expr
        
        result_parts = []
        for part in parts:
            part = part.strip()
            if part.startswith('"') and part.endswith('"'):
                result_parts.append(part[1:-1])
            elif part.startswith("'") and part.endswith("'"):
                result_parts.append(part[1:-1])
            else:
                result_parts.append('${' + part + '}')
        
        # Merge consecutive string parts
        merged = []
        temp_str = ""
        for part in result_parts:
            if part.startswith('${'):
                if temp_str:
                    merged.append(temp_str)
                    temp_str = ""
                merged.append(part)
            else:
                temp_str += part
        if temp_str:
            merged.append(temp_str)
        
        return '`' + ''.join(merged) + '`'
    
    # Convert simple function expressions to arrow functions
    # function(args) { return expr; } -> (args) => expr
    content = re.sub(
        r'\bfunction\s*\(([^)]*)\)\s*{\s*return\s+([^;]+);\s*}',
        r'(\1) => \2',
        content
    )
    
    # Convert callback functions to arrow functions
    # .map(function(x) { ... }) -> .map((x) => { ... })
    content = re.sub(
        r'(\.(?:map|filter|forEach|reduce|find|findIndex|some|every|sort))\s*\(\s*function\s*\(([^)]*)\)\s*{',
        r'\1((\2) => {',
        content
    )
    
    # Convert setTimeout/setInterval callbacks
    content = re.sub(
        r'(setTimeout|setInterval)\s*\(\s*function\s*\(\s*\)\s*{',
        r'\1(() => {',
        content
    )
    
    return content


def process_file(filepath):
    """Process a single JavaScript file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        # Skip empty files
        if not original_content.strip():
            return False
        
        modernized = modernize_js(original_content)
        
        # Only write if changed
        if modernized != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(modernized)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}", file=sys.stderr)
        return False


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: modernize.py <file1.js> [file2.js ...]")
        sys.exit(1)
    
    modified_count = 0
    for filepath in sys.argv[1:]:
        if process_file(filepath):
            modified_count += 1
            print(f"Modified: {filepath}")
    
    print(f"\nTotal files modified: {modified_count}/{len(sys.argv)-1}")
