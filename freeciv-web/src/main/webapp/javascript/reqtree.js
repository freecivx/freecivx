/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2015  The Freeciv-web project

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


var reqtree = {};
var reqtree_xwidth = 330;
var reqtree_ywidth = 80;
var level_counts = {};
var max_techs_per_level = 12; // Increased from hardcoded 10 to allow more techs per level

/**************************************************************************
 Technology tree algorithm, assigning the position of each technology in the tree.
 Civ 6-style: Two-pass algorithm for better positioning
**************************************************************************/
function generate_req_tree() {
  reqtree = {};

  // Initialize tech properties
  for (let tech_id in techs) {
    let ptech = techs[tech_id];
    ptech['subreqs'] = [];
    ptech['xlevel'] = -1;  // Not yet assigned
    ptech['ylevel'] = -1;
    ptech['in_progress'] = false;  // For cycle detection
  }

  for (let x = 0; x < Object.keys(techs).length; x++) {
    level_counts[x] = 0;
  }

  // Build subreqs (children) for each tech
  for (let tech_id in techs) {
    let ptech = techs[tech_id];

    if (ptech['req'][0] > 0) {
      techs[ptech['req'][0]]['subreqs'].push(ptech);
    }
    if (ptech['req'][1] > 0) {
      techs[ptech['req'][1]]['subreqs'].push(ptech);
    }
  }

  // Pass 1: Assign horizontal levels (x) based on prerequisites
  // Process techs with no prerequisites first
  for (let tech_id in techs) {
    let ptech = techs[tech_id];
    if (ptech['req'][0] == 0 && ptech['req'][1] == 0) {
      reqtree_assign_xlevel(ptech);
    }
  }

  // Ensure all techs have been assigned a level
  for (let tech_id in techs) {
    let ptech = techs[tech_id];
    if (ptech['xlevel'] == -1) {
      reqtree_assign_xlevel(ptech);
    }
  }

  // Pass 2: Assign vertical positions (y) within each level
  reqtree_assign_ylevels();

  // Create final position mapping
  for (let tech_id in techs) {
    let ptech = techs[tech_id];
    reqtree[tech_id] = {'x' : 20 + ptech['xlevel'] * reqtree_xwidth,
                        'y': 20 + ptech['ylevel'] * reqtree_ywidth};
  }
}

/**************************************************************************
 Assign horizontal level (xlevel) based on maximum prerequisite level
 Civ 6-style: Places tech at max(prerequisite levels) + 1
 Includes cycle detection to prevent infinite recursion
 @param {Tech} ptech - The technology to assign the horizontal level for.
 @returns {number} The horizontal level assigned to the technology.
**************************************************************************/
function reqtree_assign_xlevel(ptech) {
  if (ptech['xlevel'] != -1) {
    // Already assigned
    return ptech['xlevel'];
  }

  // Mark as in-progress to detect cycles
  if (ptech['in_progress']) {
    console.error('Cycle detected in tech tree prerequisites for tech:', ptech['name']);
    ptech['xlevel'] = 0;
    return 0;
  }
  ptech['in_progress'] = true;

  let max_prereq_level = -1;

  // Check first prerequisite
  if (ptech['req'][0] > 0 && techs[ptech['req'][0]]) {
    let req0_level = reqtree_assign_xlevel(techs[ptech['req'][0]]);
    max_prereq_level = Math.max(max_prereq_level, req0_level);
  }

  // Check second prerequisite
  if (ptech['req'][1] > 0 && techs[ptech['req'][1]]) {
    let req1_level = reqtree_assign_xlevel(techs[ptech['req'][1]]);
    max_prereq_level = Math.max(max_prereq_level, req1_level);
  }

  // Assign level: max of prerequisites + 1, or 0 if no prerequisites
  ptech['xlevel'] = max_prereq_level + 1;

  // Handle overflow - find first available level that's not too crowded
  while (level_counts[ptech['xlevel']] >= max_techs_per_level) {
    ptech['xlevel'] += 1;
  }

  level_counts[ptech['xlevel']] = (level_counts[ptech['xlevel']] || 0) + 1;

  ptech['in_progress'] = false;
  return ptech['xlevel'];
}

/**************************************************************************
 Assign vertical positions (ylevel) for all techs
 Civ 6-style: Try to position techs near their prerequisites vertically
**************************************************************************/
function reqtree_assign_ylevels() {
  // Group techs by xlevel
  let techs_by_level = {};
  for (let tech_id in techs) {
    let ptech = techs[tech_id];
    let xlevel = ptech['xlevel'];
    if (!techs_by_level[xlevel]) {
      techs_by_level[xlevel] = [];
    }
    techs_by_level[xlevel].push(ptech);
  }

  // Sort each level's techs to optimize vertical spacing
  for (let xlevel in techs_by_level) {
    let level_techs = techs_by_level[xlevel];
    
    // Pre-calculate average Y positions for better performance
    let avg_y_map = new Map();
    for (let ptech of level_techs) {
      avg_y_map.set(ptech, get_prereq_avg_y(ptech));
    }
    
    // Sort by average Y position of prerequisites (for better visual flow)
    level_techs.sort((a, b) => {
      return avg_y_map.get(a) - avg_y_map.get(b);
    });

    // Assign Y positions
    for (let i = 0; i < level_techs.length; i++) {
      level_techs[i]['ylevel'] = i;
    }
  }
}

/**************************************************************************
 Helper: Get average Y position of a tech's prerequisites
 Used for sorting techs to minimize crossing lines
 @param {Tech} ptech - The technology to get the average prerequisite Y for.
 @returns {number} The average Y position of the technology's prerequisites.
**************************************************************************/
function get_prereq_avg_y(ptech) {
  let total_y = 0;
  let count = 0;

  if (ptech['req'][0] > 0 && techs[ptech['req'][0]]) {
    let req0 = techs[ptech['req'][0]];
    if (req0['ylevel'] != -1) {
      total_y += req0['ylevel'];
      count++;
    }
  }

  if (ptech['req'][1] > 0 && techs[ptech['req'][1]]) {
    let req1 = techs[ptech['req'][1]];
    if (req1['ylevel'] != -1) {
      total_y += req1['ylevel'];
      count++;
    }
  }

  // Return average, or a large number if no prerequisites (push to bottom)
  return count > 0 ? total_y / count : Number.MAX_SAFE_INTEGER;
}
