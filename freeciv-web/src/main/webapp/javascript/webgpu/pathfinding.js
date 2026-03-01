/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. http://www.FreecivWorld.net/
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
 * Client-side pathfinding using Dijkstra's Algorithm.
 *
 * Used for goto-path visualisation on square maps.  The result is a
 * direction list compatible with the server goto_path format so it can
 * be handed directly to the rendering code in goto_square.js.
 *
 * Improvements over the previous BFS implementation:
 *  - Diagonal moves carry a higher cost (√2) than cardinal moves (1),
 *    producing more natural-looking paths.
 *  - Ocean tiles are strongly penalised rather than hard-skipped, so
 *    an all-land route is always preferred but a path across water is
 *    still returned when no land route exists within the search limit.
 */

// Maximum number of tiles that Dijkstra's search may settle before giving up.
var GOTO_MAX_DIJKSTRA_TILES = 2000;

// Estimated moves per turn – used only to compute the turn-count annotation.
var GOTO_AVG_MOVES_PER_TURN = 3;

// Movement costs
var GOTO_COST_CARDINAL  = 1.0;    // straight (N/E/S/W) move
var GOTO_COST_DIAGONAL  = 1.414;  // diagonal move  (≈ √2)
var GOTO_COST_OCEAN     = 50.0;   // extra penalty applied to ocean tiles

/**
 * Minimal binary min-heap used as the priority queue for Dijkstra's.
 * Each element is {cost, tile}.
 */
function PriorityQueue() {
    this._heap = [];
}

PriorityQueue.prototype.push = function(cost, tile) {
    this._heap.push({cost: cost, tile: tile});
    this._bubbleUp(this._heap.length - 1);
};

PriorityQueue.prototype.pop = function() {
    var top = this._heap[0];
    var last = this._heap.pop();
    if (this._heap.length > 0) {
        this._heap[0] = last;
        this._siftDown(0);
    }
    return top;
};

PriorityQueue.prototype.isEmpty = function() {
    return this._heap.length === 0;
};

PriorityQueue.prototype._bubbleUp = function(i) {
    while (i > 0) {
        var parent = (i - 1) >> 1;
        if (this._heap[parent].cost <= this._heap[i].cost) break;
        var tmp = this._heap[parent];
        this._heap[parent] = this._heap[i];
        this._heap[i] = tmp;
        i = parent;
    }
};

PriorityQueue.prototype._siftDown = function(i) {
    var n = this._heap.length;
    while (true) {
        var left  = 2 * i + 1;
        var right = 2 * i + 2;
        var smallest = i;
        if (left < n && this._heap[left].cost < this._heap[smallest].cost) {
            smallest = left;
        }
        if (right < n && this._heap[right].cost < this._heap[smallest].cost) {
            smallest = right;
        }
        if (smallest === i) break;
        var tmp = this._heap[smallest];
        this._heap[smallest] = this._heap[i];
        this._heap[i] = tmp;
        i = smallest;
    }
};

/****************************************************************************
 Compute a client-side goto path using Dijkstra's algorithm.

 Diagonal moves are weighted at √2; ocean tiles receive an extra penalty of
 GOTO_COST_OCEAN so that all-land routes are always preferred, but a path
 that crosses water is still returned when no land route can be found within
 GOTO_MAX_DIJKSTRA_TILES settled tiles.

 Returns a path object compatible with the server goto_path format:
   { unit_id, dest, length, dir[], turns }
 or null if no path is found.

 @param {Object} punit     - The unit to move
 @param {Object} dest_tile - The destination tile
 @returns {Object|null}
 ****************************************************************************/
function compute_client_goto_path(punit, dest_tile) {
    var start_tile = index_to_tile(punit['tile']);
    if (start_tile == null || dest_tile == null) return null;
    if (start_tile['index'] == dest_tile['index']) return null;

    /* Dijkstra's search state keyed by tile index. */
    var dist    = {};   // best known cost to reach each tile
    var visited = {};   /* settled[idx] = {parent_idx, dir} once a tile is settled */
    var settled = 0;

    dist[start_tile['index']] = 0;
    visited[start_tile['index']] = {parent_idx: -1, dir: -1};

    var pq = new PriorityQueue();
    pq.push(0, start_tile);

    var found = false;

    while (!pq.isEmpty() && settled < GOTO_MAX_DIJKSTRA_TILES) {
        var entry   = pq.pop();
        var current = entry.tile;
        var curCost = entry.cost;

        /* Skip stale entries (a shorter path was already found). */
        if (curCost > dist[current['index']]) continue;

        settled++;

        if (current['index'] == dest_tile['index']) {
            found = true;
            break;
        }

        for (var dir = 0; dir < DIR8_LAST; dir++) {
            if (!is_valid_dir(dir)) continue;
            var next_tile = mapstep(current, dir);
            if (next_tile == null) continue;

            /* Base movement cost: diagonal moves are slightly more expensive.
               In the DIR8 encoding used by Freeciv, odd-numbered directions
               (1, 3, 5, 7) are diagonal and even-numbered ones (0, 2, 4, 6)
               are cardinal (N/E/S/W). */
            var isDiagonal = (dir % 2 !== 0);
            var step_cost = isDiagonal ? GOTO_COST_DIAGONAL : GOTO_COST_CARDINAL;

            /* Ocean tiles are heavily penalised to encourage land routes.
               The destination is exempt so we can always reach it. */
            if (is_ocean_tile(next_tile) && next_tile['index'] != dest_tile['index']) {
                step_cost += GOTO_COST_OCEAN;
            }

            var new_cost = dist[current['index']] + step_cost;

            if (dist[next_tile['index']] === undefined || new_cost < dist[next_tile['index']]) {
                dist[next_tile['index']]    = new_cost;
                visited[next_tile['index']] = {parent_idx: current['index'], dir: dir};
                pq.push(new_cost, next_tile);
            }
        }
    }

    if (!found) return null;

    /* Reconstruct the direction list by walking back through visited. */
    var dirs = [];
    var cur_idx = dest_tile['index'];
    while (visited[cur_idx] && visited[cur_idx]['parent_idx'] != -1) {
        dirs.unshift(visited[cur_idx]['dir']);
        cur_idx = visited[cur_idx]['parent_idx'];
    }
    if (dirs.length == 0) return null;

    return {
        'unit_id': punit['id'],
        'dest'   : dest_tile['index'],
        'length' : dirs.length,
        'dir'    : dirs,
        'turns'  : Math.max(1, Math.ceil(dirs.length / GOTO_AVG_MOVES_PER_TURN))
    };
}
