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
 * Main server initialization and orchestration
 * 
 * This is the main entry point for the JavaScript server implementation.
 * It coordinates all server modules to create a complete game state.
 */

/**************************************************************************
 * Create a complete game using the JavaScript server
 * 
 * This function orchestrates all server modules to create a fully
 * initialized game state with map, ruleset, players, cities, and units.
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.mapWidth - Map width in tiles (default: 40)
 * @param {number} options.mapHeight - Map height in tiles (default: 30)
 * @param {number} options.numPlayers - Number of players (default: 3)
 **************************************************************************/
function server_create_game(options) {
  options = options || {};
  
  console.log("[Server] Creating game with JavaScript server");
  
  // Initialize server settings (must be first)
  console.log("[Server] Creating server settings");
  server_create_settings();
  
  // Initialize map
  console.log("[Server] Creating map");
  server_create_map(options.mapWidth, options.mapHeight);
  
  // Initialize ruleset data
  console.log("[Server] Creating ruleset");
  server_create_ruleset();
  
  // Initialize players
  console.log("[Server] Creating players");
  server_create_players(options.numPlayers);
  
  // Initialize cities
  console.log("[Server] Creating cities");
  server_create_cities();
  
  // Initialize units
  console.log("[Server] Creating units");
  server_create_units();
  
  // Set up the client connection
  console.log("[Server] Setting up client connection");
  server_setup_client_connection();
  
  console.log("[Server] Game created successfully");
}