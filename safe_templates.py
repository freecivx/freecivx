#!/usr/bin/env python3
"""
Safe template literal converter for simple cases only.
Only converts very obvious string concatenation patterns.
"""

import re
import sys


def safe_template_literals(content):
    """Convert only the safest string concatenations to template literals."""
    lines = content.split('\n')
    result_lines = []
    
    for line in lines:
        original = line
        
        # Skip if already has backticks
        if '`' in line:
            result_lines.append(line)
            continue
        
        # Pattern 1: console.log("text" + var)
        if 'console.log' in line or 'freelog' in line:
            line = re.sub(
                r'console\.(log|error|warn|info)\s*\(\s*"([^"]+)"\s*\+\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)',
                r'console.\1(`\2${\3}`)',
                line
            )
            line = re.sub(
                r'freelog\s*\([^,]+,\s*"([^"]+)"\s*\+\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)',
                r'freelog(\1, `\2${\3}`)',
                line
            )
        
        # Pattern 2: Simple $("#id_" + variable) jQuery selectors
        if '$(' in line or '$("#' in line or "$('#" in line:
            # $("#prefix_" + var) -> $(`#prefix_${var}`)
            line = re.sub(
                r'\$\(\s*"#([a-zA-Z_-]+)"\s*\+\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)',
                r'$(`#\1${\2}`)',
                line
            )
            # $("#prefix_" + var + "_suffix") -> $(`#prefix_${var}_suffix`)
            line = re.sub(
                r'\$\(\s*"#([a-zA-Z_-]+)"\s*\+\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\+\s*"([a-zA-Z_-]+)"\s*\)',
                r'$(`#\1${\2}\3`)',
                line
            )
        
        # Pattern 3: message = "text" + var (simple assignment)
        # Only if it's a complete statement ending with semicolon
        if ';' in line and not '[' in line and not ']' in line:
            # "text" + var;
            line = re.sub(
                r'=\s*"([^"]+)"\s*\+\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*;',
                r'= `\1${\2}`;',
                line
            )
            # var + "text";
            line = re.sub(
                r'=\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\+\s*"([^"]+)"\s*;',
                r'= `${\1}\2`;',
                line
            )
        
        result_lines.append(line)
    
    return '\n'.join(result_lines)


def process_file(filepath):
    """Process a single JavaScript file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        if not original_content.strip():
            return False
        
        content = safe_template_literals(original_content)
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}", file=sys.stderr)
        return False


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: safe_templates.py <file1.js> [file2.js ...]")
        sys.exit(1)
    
    modified_count = 0
    for filepath in sys.argv[1:]:
        if process_file(filepath):
            modified_count += 1
            print(f"Modified: {filepath}")
    
    print(f"\nTotal files modified: {modified_count}/{len(sys.argv)-1}")
