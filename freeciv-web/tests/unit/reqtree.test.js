/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Unit tests for tech tree algorithm
***********************************************************************/

const { test, expect } = require('@playwright/test');

test.beforeEach(() => {
  // Mock global variables and functions needed by reqtree.js
  global.techs = {};
  global.reqtree = {};
  global.reqtree_xwidth = 330;
  global.reqtree_ywidth = 80;
  global.level_counts = {};
  global.max_techs_per_level = 12;

  // Load the reqtree.js file
  const fs = require('fs');
  const path = require('path');
  const reqtreeCode = fs.readFileSync(
    path.join(__dirname, '../../src/main/webapp/javascript/reqtree.js'),
    'utf8'
  );
  
  // Execute the code in global scope
  const vm = require('vm');
  vm.runInThisContext(reqtreeCode);
});

test('Tech tree algorithm assigns correct levels for simple chain', () => {
  // Setup: Tech1 -> Tech2 -> Tech3
  global.techs = {
    1: { id: 1, name: 'Tech1', req: [0, 0] },
    2: { id: 2, name: 'Tech2', req: [1, 0] },
    3: { id: 3, name: 'Tech3', req: [2, 0] }
  };

  generate_req_tree();

  // Verify horizontal levels (should be 0, 1, 2)
  expect(global.techs[1].xlevel).toBe(0);
  expect(global.techs[2].xlevel).toBe(1);
  expect(global.techs[3].xlevel).toBe(2);

  // Verify positions were created
  expect(global.reqtree[1]).toBeDefined();
  expect(global.reqtree[2]).toBeDefined();
  expect(global.reqtree[3]).toBeDefined();
});

test('Tech tree algorithm handles multiple prerequisites correctly', () => {
  // Setup: Tech1 and Tech2 both required for Tech3
  global.techs = {
    1: { id: 1, name: 'Tech1', req: [0, 0] },
    2: { id: 2, name: 'Tech2', req: [0, 0] },
    3: { id: 3, name: 'Tech3', req: [1, 2] }
  };

  generate_req_tree();

  // Both prerequisites should be at level 0
  expect(global.techs[1].xlevel).toBe(0);
  expect(global.techs[2].xlevel).toBe(0);
  
  // Tech with two prerequisites should be at level 1 (max(0, 0) + 1)
  expect(global.techs[3].xlevel).toBe(1);
});

test('Tech tree algorithm positions tech at max prerequisite level', () => {
  // Setup: Tech1 -> Tech2 -> Tech4
  //        Tech1 -> Tech3 -> Tech4
  global.techs = {
    1: { id: 1, name: 'Tech1', req: [0, 0] },
    2: { id: 2, name: 'Tech2', req: [1, 0] },
    3: { id: 3, name: 'Tech3', req: [1, 0] },
    4: { id: 4, name: 'Tech4', req: [2, 3] }
  };

  generate_req_tree();

  // Tech1 should be at level 0
  expect(global.techs[1].xlevel).toBe(0);
  
  // Tech2 and Tech3 should be at level 1
  expect(global.techs[2].xlevel).toBe(1);
  expect(global.techs[3].xlevel).toBe(1);
  
  // Tech4 should be at level 2 (max(1, 1) + 1)
  expect(global.techs[4].xlevel).toBe(2);
});

test('Tech tree algorithm sorts techs vertically by prerequisite position', () => {
  // Setup: Multiple techs at same level should be sorted
  global.techs = {
    1: { id: 1, name: 'Tech1', req: [0, 0] },
    2: { id: 2, name: 'Tech2', req: [0, 0] },
    3: { id: 3, name: 'Tech3', req: [1, 0] }, // Should be near Tech1
    4: { id: 4, name: 'Tech4', req: [2, 0] }  // Should be near Tech2
  };

  generate_req_tree();

  // Verify all techs have vertical positions assigned
  expect(global.techs[1].ylevel).toBeGreaterThanOrEqual(0);
  expect(global.techs[2].ylevel).toBeGreaterThanOrEqual(0);
  expect(global.techs[3].ylevel).toBeGreaterThanOrEqual(0);
  expect(global.techs[4].ylevel).toBeGreaterThanOrEqual(0);
  
  // Techs should have different vertical positions if at same horizontal level
  if (global.techs[1].xlevel === global.techs[2].xlevel) {
    expect(global.techs[1].ylevel).not.toBe(global.techs[2].ylevel);
  }
});
