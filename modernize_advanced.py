#!/usr/bin/env python3
"""
Advanced JavaScript modernization script for ES6+ features.
Handles template literals, arrow functions, and more complex patterns.
"""

import re
import sys
from pathlib import Path


def modernize_template_literals(content):
    """Convert string concatenations to template literals."""
    # Template literal conversion is complex and error-prone
    # Skip for now to avoid breaking code
    return content


def modernize_arrow_functions(content):
    """Convert more function expressions to arrow functions."""
    
    # setTimeout/setInterval with function
    content = re.sub(
        r'\b(setTimeout|setInterval)\s*\(\s*function\s*\(\s*\)\s*\{',
        r'\1(() => {',
        content
    )
    
    # Array methods
    array_methods = ['map', 'filter', 'forEach', 'reduce', 'find', 'findIndex', 
                     'some', 'every', 'sort', 'findLast', 'findLastIndex']
    for method in array_methods:
        # .method(function(param) {
        content = re.sub(
            rf'\.{method}\s*\(\s*function\s*\(([^)]*)\)\s*\{{',
            rf'.{method}((\1) => {{',
            content
        )
    
    # addEventListener and similar
    content = re.sub(
        r'\.(addEventListener|on)\s*\(\s*([^,]+),\s*function\s*\(([^)]*)\)\s*\{',
        r'.\1(\2, (\3) => {',
        content
    )
    
    # Simple function expressions assigned to variables
    # let x = function(args) { return expr; } -> let x = (args) => expr
    content = re.sub(
        r'(const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*function\s*\(([^)]*)\)\s*\{\s*return\s+([^;]+);\s*\}',
        r'\1 \2 = (\3) => \4',
        content
    )
    
    return content


def modernize_object_shorthand(content):
    """Use object shorthand notation."""
    # {foo: foo} -> {foo}
    content = re.sub(
        r'\{([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\1\s*\}',
        r'{\1}',
        content
    )
    content = re.sub(
        r',\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\1\s*([,}])',
        r', \1\2',
        content
    )
    
    return content


def modernize_default_params(content):
    """Convert undefined checks to default parameters."""
    # function foo(param) { param = param || default; } -> function foo(param = default) {}
    # This is complex and risky, so we'll skip for now
    return content


def process_file(filepath):
    """Process a single JavaScript file with advanced modernizations."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        if not original_content.strip():
            return False
        
        content = original_content
        
        # Apply modernizations
        content = modernize_template_literals(content)
        content = modernize_arrow_functions(content)
        content = modernize_object_shorthand(content)
        
        # Only write if changed
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
        print("Usage: modernize_advanced.py <file1.js> [file2.js ...]")
        sys.exit(1)
    
    modified_count = 0
    for filepath in sys.argv[1:]:
        if process_file(filepath):
            modified_count += 1
            print(f"Modified: {filepath}")
    
    print(f"\nTotal files modified: {modified_count}/{len(sys.argv)-1}")
