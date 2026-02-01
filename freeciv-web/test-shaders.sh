#!/bin/bash
# Test script for hexagonal shaders and geometry
# This script runs the shader validation and hexagon geometry tests

set -e  # Exit on error

echo "==================================================="
echo "  Running Hexagonal Shader Test Suite"
echo "==================================================="
echo ""

cd "$(dirname "$0")"

# Run shader validation tests
echo "Running shader validation tests..."
node tests/shader_validation_test.js
echo ""

# Run hexagon geometry tests
echo "Running hexagon geometry tests..."
node tests/hexagon_test.js
echo ""

# Run improved hexagon tests
echo "Running improved hexagon coordinate tests..."
node tests/hexagon_improved_test.js
echo ""

echo "==================================================="
echo "  All Hexagonal Shader Tests Passed!"
echo "==================================================="
