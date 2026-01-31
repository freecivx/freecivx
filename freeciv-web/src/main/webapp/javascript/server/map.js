/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2026  The Freeciv-web project

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
 * Map management for the JavaScript server
 * 
 * This module provides a simple interface for map creation.
 * The actual map generation is handled by generator.js.
 */

/**************************************************************************
 * Create a game map with terrain
 * 
 * This is a wrapper function that delegates to the map generator.
 * 
 * @param {number} width - Map width in tiles (default: 40)
 * @param {number} height - Map height in tiles (default: 30)
 * @param {Object} options - Optional generation parameters
 * @returns {Object} The created map
 **************************************************************************/
function server_create_map(width, height, options) {
  console.log("[Server Map] Delegating to map generator");
  return generator_create_map(width, height, options);
}