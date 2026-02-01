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
 * 
 * ## Server-to-Client Communication Pattern
 * 
 * The JavaScript server communicates with the client by calling packet handlers
 * directly. This simulates the network packet handling that would normally occur
 * with a remote server.
 * 
 * ### Sending Chat Messages to Client
 * 
 * To send a chat message from the server to the client:
 * 
 * ```javascript
 * server_send_chat_message("Your message here", E_CHAT_MSG);
 * ```
 * 
 * This calls the client's handle_chat_msg() function with a properly formatted
 * packet, displaying the message in the game chat.
 * 
 * ### Available Event Types
 * 
 * Common event types (defined in fc_events.js):
 * - E_CHAT_MSG (95) - General chat messages
 * - E_CONNECTION (98) - Connection-related messages
 * - E_LOG_ERROR (100) - Error messages
 * - See fc_events.js for complete list
 * 
 * ### Example Usage
 * 
 * ```javascript
 * // Send welcome message when game starts
 * server_send_chat_message("Welcome to the Freeciv JS server!", E_CHAT_MSG);
 * 
 * // Send system notification
 * server_send_chat_message("Game state initialized", E_CONNECTION);
 * ```
 */

/**************************************************************************
 * Send a chat message from server to client
 * 
 * This function sends a message to the client by calling handle_chat_msg()
 * directly. This is the standard pattern for server-to-client communication
 * in the JavaScript server implementation.
 * 
 * @param {string} message - The message text to send
 * @param {number} event - Event type constant (e.g., E_CHAT_MSG, E_CONNECTION)
 * @param {Object} options - Optional parameters
 * @param {number} options.conn_id - Connection ID (default: null for server messages)
 * @param {number} options.tile - Tile ID for location-specific messages (default: null)
 **************************************************************************/
function server_send_chat_message(message, event, options) {
  options = options || {};
  
  // Create a packet matching the format expected by handle_chat_msg()
  var packet = {
    'message': message,
    'conn_id': options.conn_id || null,
    'event': event || E_CHAT_MSG,
    'tile': options.tile || null
  };
  
  console.log("[Server] Sending chat message: " + message);
  
  // Call the client's packet handler directly
  handle_chat_msg(packet);
}

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

  // Initialize ruleset data, needs to be early.
  console.log("[Server] Creating ruleset");
  server_create_ruleset();

  // Initialize map
  console.log("[Server] Creating map");
  server_create_map(options.mapWidth, options.mapHeight);

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