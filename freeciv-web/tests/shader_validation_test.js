/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2024  The Freeciv-web project

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

***********************************************************************/

/**
 * Shader Validation Test Suite
 * 
 * This test suite validates that hexagonal and square shaders:
 * - Have consistent structure
 * - Contain all required uniforms
 * - Have matching vertex shaders (they should be identical)
 * - Have appropriate differences in fragment shaders
 * - Are syntactically correct GLSL
 */

const fs = require('fs');
const path = require('path');

// Paths to shader files
const SHADER_BASE = path.join(__dirname, '../src/main/webapp/javascript/webgl');
const HEXAGON_VERTEX = path.join(SHADER_BASE, 'shaders_hexagonal/terrain_vertex_shader.glsl');
const HEXAGON_FRAGMENT = path.join(SHADER_BASE, 'shaders_hexagonal/terrain_fragment_shader.glsl');
const SQUARE_VERTEX = path.join(SHADER_BASE, 'shaders_square/terrain_vertex_shader.glsl');
const SQUARE_FRAGMENT = path.join(SHADER_BASE, 'shaders_square/terrain_fragment_shader.glsl');

/**
 * Parse GLSL shader and extract uniforms, attributes, varyings
 */
function parseGLSL(shaderCode) {
  const uniforms = [];
  const attributes = [];
  const varyings = [];
  
  // Extract uniforms
  const uniformRegex = /uniform\s+(\w+)\s+(\w+);/g;
  let match;
  while ((match = uniformRegex.exec(shaderCode)) !== null) {
    uniforms.push({ type: match[1], name: match[2] });
  }
  
  // Extract attributes (in/out keywords in GLSL 3.0+)
  const inRegex = /in\s+(\w+)\s+(\w+);/g;
  while ((match = inRegex.exec(shaderCode)) !== null) {
    attributes.push({ type: match[1], name: match[2] });
  }
  
  // Extract varyings (out in vertex, in in fragment)
  const outRegex = /out\s+(\w+)\s+(\w+);/g;
  while ((match = outRegex.exec(shaderCode)) !== null) {
    varyings.push({ type: match[1], name: match[2] });
  }
  
  return { uniforms, attributes, varyings };
}

/**
 * Test that vertex shaders are identical
 */
function testVertexShadersIdentical() {
  console.log("=== Testing Vertex Shaders Identical ===");
  
  const hexVertex = fs.readFileSync(HEXAGON_VERTEX, 'utf8');
  const squareVertex = fs.readFileSync(SQUARE_VERTEX, 'utf8');
  
  if (hexVertex === squareVertex) {
    console.log("✓ Vertex shaders are identical");
    return true;
  } else {
    console.log("✗ FAIL: Vertex shaders differ");
    console.log("  Hexagon vertex shader and square vertex shader should be identical.");
    return false;
  }
}

/**
 * Test that required uniforms are present
 */
function testRequiredUniforms() {
  console.log("\n=== Testing Required Uniforms ===");
  
  const requiredUniforms = [
    'maptiles',
    'borders',
    'roadsmap',
    'roadsprites',
    'railroadsprites',
    'arctic_farmland_irrigation_tundra',
    'grassland',
    'coast',
    'desert',
    'ocean',
    'plains',
    'hills',
    'mountains',
    'swamp',
    'map_x_size',
    'map_y_size',
    'mouse_x',
    'mouse_y',
    'selected_x',
    'selected_y',
    'borders_visible'
  ];
  
  const hexFragment = fs.readFileSync(HEXAGON_FRAGMENT, 'utf8');
  const squareFragment = fs.readFileSync(SQUARE_FRAGMENT, 'utf8');
  
  const hexParsed = parseGLSL(hexFragment);
  const squareParsed = parseGLSL(squareFragment);
  
  let hexPassed = true;
  let squarePassed = true;
  
  console.log("Checking hexagon fragment shader uniforms:");
  for (const uniform of requiredUniforms) {
    const found = hexParsed.uniforms.some(u => u.name === uniform);
    if (found) {
      console.log(`  ✓ ${uniform}`);
    } else {
      console.log(`  ✗ MISSING: ${uniform}`);
      hexPassed = false;
    }
  }
  
  console.log("\nChecking square fragment shader uniforms:");
  for (const uniform of requiredUniforms) {
    const found = squareParsed.uniforms.some(u => u.name === uniform);
    if (found) {
      console.log(`  ✓ ${uniform}`);
    } else {
      console.log(`  ✗ MISSING: ${uniform}`);
      squarePassed = false;
    }
  }
  
  const allPassed = hexPassed && squarePassed;
  if (allPassed) {
    console.log("\n✓ All required uniforms present in both shaders");
  } else {
    console.log("\n✗ FAIL: Some required uniforms missing");
  }
  
  return allPassed;
}

/**
 * Test that fragment shaders have expected differences
 */
function testFragmentShaderDifferences() {
  console.log("\n=== Testing Fragment Shader Differences ===");
  
  const hexFragment = fs.readFileSync(HEXAGON_FRAGMENT, 'utf8');
  const squareFragment = fs.readFileSync(SQUARE_FRAGMENT, 'utf8');
  
  // Square shader should have grid rendering code
  const squareHasGrid = squareFragment.includes('fract((vPosition.x + 502.0) / 35.71)');
  
  // Hexagon shader should NOT have grid rendering code
  const hexHasGrid = hexFragment.includes('fract((vPosition.x + 502.0) / 35.71)');
  
  // Hexagon shader should have explanatory comments
  const hexHasComments = hexFragment.includes('hexagonal tiles') || 
                         hexFragment.includes('Hexagonal tiles');
  
  let passed = true;
  
  if (squareHasGrid) {
    console.log("✓ Square shader contains grid rendering code");
  } else {
    console.log("✗ FAIL: Square shader missing grid rendering code");
    passed = false;
  }
  
  if (!hexHasGrid) {
    console.log("✓ Hexagon shader does NOT contain grid rendering code");
  } else {
    console.log("✗ FAIL: Hexagon shader should not contain grid rendering code");
    passed = false;
  }
  
  if (hexHasComments) {
    console.log("✓ Hexagon shader contains explanatory comments");
  } else {
    console.log("✗ FAIL: Hexagon shader missing explanatory comments");
    passed = false;
  }
  
  return passed;
}

/**
 * Test basic GLSL syntax validity
 */
function testGLSLSyntax() {
  console.log("\n=== Testing GLSL Syntax ===");
  
  const shaders = [
    { name: 'Hexagon Vertex', path: HEXAGON_VERTEX },
    { name: 'Hexagon Fragment', path: HEXAGON_FRAGMENT },
    { name: 'Square Vertex', path: SQUARE_VERTEX },
    { name: 'Square Fragment', path: SQUARE_FRAGMENT }
  ];
  
  let allPassed = true;
  
  for (const shader of shaders) {
    const code = fs.readFileSync(shader.path, 'utf8');
    
    // Basic syntax checks
    const hasMain = /void\s+main\s*\(\s*\)/.test(code);
    const hasCopyright = code.includes('Copyright');
    const hasLicense = code.includes('GNU Affero General Public License');
    
    // Check for balanced braces
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    const balancedBraces = openBraces === closeBraces;
    
    // Check for balanced parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    const balancedParens = openParens === closeParens;
    
    console.log(`\n${shader.name}:`);
    
    if (hasMain) {
      console.log("  ✓ Has main() function");
    } else {
      console.log("  ✗ FAIL: Missing main() function");
      allPassed = false;
    }
    
    if (hasCopyright) {
      console.log("  ✓ Has copyright header");
    } else {
      console.log("  ✗ FAIL: Missing copyright header");
      allPassed = false;
    }
    
    if (hasLicense) {
      console.log("  ✓ Has license information");
    } else {
      console.log("  ✗ FAIL: Missing license information");
      allPassed = false;
    }
    
    if (balancedBraces) {
      console.log("  ✓ Balanced braces");
    } else {
      console.log(`  ✗ FAIL: Unbalanced braces (${openBraces} open, ${closeBraces} close)`);
      allPassed = false;
    }
    
    if (balancedParens) {
      console.log("  ✓ Balanced parentheses");
    } else {
      console.log(`  ✗ FAIL: Unbalanced parentheses (${openParens} open, ${closeParens} close)`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

/**
 * Test vertex shader structure
 */
function testVertexShaderStructure() {
  console.log("\n=== Testing Vertex Shader Structure ===");
  
  const hexVertex = fs.readFileSync(HEXAGON_VERTEX, 'utf8');
  const parsed = parseGLSL(hexVertex);
  
  // Expected inputs
  const expectedInputs = ['vertColor'];
  
  // Expected outputs
  const expectedOutputs = ['vUv', 'vNormal', 'vPosition', 'vPosition_camera', 'vColor'];
  
  let passed = true;
  
  console.log("\nInput attributes:");
  for (const expected of expectedInputs) {
    const found = parsed.attributes.some(a => a.name === expected);
    if (found) {
      console.log(`  ✓ ${expected}`);
    } else {
      console.log(`  ✗ MISSING: ${expected}`);
      passed = false;
    }
  }
  
  console.log("\nOutput varyings:");
  for (const expected of expectedOutputs) {
    const found = parsed.varyings.some(v => v.name === expected);
    if (found) {
      console.log(`  ✓ ${expected}`);
    } else {
      console.log(`  ✗ MISSING: ${expected}`);
      passed = false;
    }
  }
  
  // Check that vertex shader sets gl_Position
  if (hexVertex.includes('gl_Position')) {
    console.log("  ✓ Sets gl_Position");
  } else {
    console.log("  ✗ FAIL: Does not set gl_Position");
    passed = false;
  }
  
  return passed;
}

/**
 * Test fragment shader structure
 */
function testFragmentShaderStructure() {
  console.log("\n=== Testing Fragment Shader Structure ===");
  
  const hexFragment = fs.readFileSync(HEXAGON_FRAGMENT, 'utf8');
  const parsed = parseGLSL(hexFragment);
  
  // Expected inputs (should match vertex shader outputs)
  const expectedInputs = ['vUv', 'vNormal', 'vPosition', 'vPosition_camera', 'vColor'];
  
  // Expected output
  const expectedOutputs = ['fragColor'];
  
  let passed = true;
  
  console.log("\nInput varyings:");
  for (const expected of expectedInputs) {
    const found = parsed.attributes.some(a => a.name === expected);
    if (found) {
      console.log(`  ✓ ${expected}`);
    } else {
      console.log(`  ✗ MISSING: ${expected}`);
      passed = false;
    }
  }
  
  console.log("\nOutput:");
  for (const expected of expectedOutputs) {
    const found = parsed.varyings.some(v => v.name === expected);
    if (found) {
      console.log(`  ✓ ${expected}`);
    } else {
      console.log(`  ✗ MISSING: ${expected}`);
      passed = false;
    }
  }
  
  // Check that fragment shader sets fragColor
  if (hexFragment.includes('fragColor')) {
    console.log("  ✓ Sets fragColor");
  } else {
    console.log("  ✗ FAIL: Does not set fragColor");
    passed = false;
  }
  
  return passed;
}

/**
 * Test copyright year consistency
 */
function testCopyrightYearConsistency() {
  console.log("\n=== Testing Copyright Year Consistency ===");
  
  const shaders = [
    { name: 'Hexagon Vertex', path: HEXAGON_VERTEX },
    { name: 'Hexagon Fragment', path: HEXAGON_FRAGMENT },
    { name: 'Square Vertex', path: SQUARE_VERTEX },
    { name: 'Square Fragment', path: SQUARE_FRAGMENT }
  ];
  
  const expectedYear = '2009-2024';
  let passed = true;
  
  for (const shader of shaders) {
    const code = fs.readFileSync(shader.path, 'utf8');
    const hasCorrectYear = code.includes(`Copyright (C) ${expectedYear}`);
    
    if (hasCorrectYear) {
      console.log(`✓ ${shader.name}: ${expectedYear}`);
    } else {
      console.log(`✗ ${shader.name}: Does not have copyright year ${expectedYear}`);
      passed = false;
    }
  }
  
  return passed;
}

/**
 * Run all shader validation tests
 */
function runAllTests() {
  console.log("==================================================");
  console.log("  SHADER VALIDATION TEST SUITE");
  console.log("==================================================\n");
  
  const results = {
    vertexIdentical: testVertexShadersIdentical(),
    requiredUniforms: testRequiredUniforms(),
    fragmentDifferences: testFragmentShaderDifferences(),
    glslSyntax: testGLSLSyntax(),
    vertexStructure: testVertexShaderStructure(),
    fragmentStructure: testFragmentShaderStructure(),
    copyrightYear: testCopyrightYearConsistency()
  };
  
  console.log("\n==================================================");
  console.log("  TEST RESULTS SUMMARY");
  console.log("==================================================");
  console.log(`Vertex Shaders Identical:     ${results.vertexIdentical ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Required Uniforms:            ${results.requiredUniforms ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Fragment Shader Differences:  ${results.fragmentDifferences ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`GLSL Syntax:                  ${results.glslSyntax ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Vertex Shader Structure:      ${results.vertexStructure ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Fragment Shader Structure:    ${results.fragmentStructure ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Copyright Year Consistency:   ${results.copyrightYear ? '✓ PASSED' : '✗ FAILED'}`);
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  console.log("==================================================\n");
  
  return allPassed ? 0 : 1;
}

// Run tests if executed directly
if (require.main === module) {
  const exitCode = runAllTests();
  process.exit(exitCode);
}

// Export for use in other test suites
module.exports = {
  runAllTests,
  testVertexShadersIdentical,
  testRequiredUniforms,
  testFragmentShaderDifferences,
  testGLSLSyntax,
  testVertexShaderStructure,
  testFragmentShaderStructure,
  testCopyrightYearConsistency
};
