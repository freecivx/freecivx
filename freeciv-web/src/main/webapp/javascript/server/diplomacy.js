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
 * Diplomacy management for the JavaScript server
 * 
 * This module handles diplomatic relations between players including:
 * - Diplomatic states (war, peace, alliance, etc.)
 * - Treaties and agreements
 * - Diplomatic actions
 */

// Diplomatic state constants
var DS_NO_CONTACT = 0;
var DS_WAR = 1;
var DS_CEASEFIRE = 2;
var DS_PEACE = 3;
var DS_ALLIANCE = 4;

/**************************************************************************
 * Initialize diplomacy system
 * 
 * Creates the diplomatic states between all players.
 **************************************************************************/
function server_init_diplomacy() {
  if (!window.diplomacy_states) {
    window.diplomacy_states = {};
  }
  
  console.log("[Server Diplomacy] Initialized diplomacy system");
}

/**************************************************************************
 * Get diplomatic state between two players
 * 
 * @param {number} playerId1 - First player ID
 * @param {number} playerId2 - Second player ID
 * @returns {number} Diplomatic state constant
 **************************************************************************/
function server_get_diplomatic_state(playerId1, playerId2) {
  if (playerId1 === playerId2) {
    return DS_ALLIANCE; // A player is always allied with themselves
  }
  
  var key = playerId1 + "_" + playerId2;
  var reverseKey = playerId2 + "_" + playerId1;
  
  if (diplomacy_states[key] !== undefined) {
    return diplomacy_states[key];
  }
  
  if (diplomacy_states[reverseKey] !== undefined) {
    return diplomacy_states[reverseKey];
  }
  
  // Default state is peace
  return DS_PEACE;
}

/**************************************************************************
 * Set diplomatic state between two players
 * 
 * @param {number} playerId1 - First player ID
 * @param {number} playerId2 - Second player ID
 * @param {number} state - Diplomatic state constant
 **************************************************************************/
function server_set_diplomatic_state(playerId1, playerId2, state) {
  if (playerId1 === playerId2) {
    console.log("[Server Diplomacy] Cannot set diplomatic state with self");
    return;
  }
  
  var key = playerId1 + "_" + playerId2;
  diplomacy_states[key] = state;
  
  var stateName = ["No Contact", "War", "Ceasefire", "Peace", "Alliance"][state];
  console.log("[Server Diplomacy] Set state between players " + playerId1 + 
              " and " + playerId2 + " to " + stateName);
}

/**************************************************************************
 * Declare war between two players
 * 
 * @param {number} playerId1 - First player ID
 * @param {number} playerId2 - Second player ID
 **************************************************************************/
function server_declare_war(playerId1, playerId2) {
  server_set_diplomatic_state(playerId1, playerId2, DS_WAR);
  
  // Notify players if server messaging is available
  if (typeof server_send_chat_message === 'function') {
    var msg = "Player " + playerId1 + " has declared war on Player " + playerId2 + "!";
    server_send_chat_message(msg, E_DIPLOMACY || 0);
  }
}

/**************************************************************************
 * Make peace between two players
 * 
 * @param {number} playerId1 - First player ID
 * @param {number} playerId2 - Second player ID
 **************************************************************************/
function server_make_peace(playerId1, playerId2) {
  server_set_diplomatic_state(playerId1, playerId2, DS_PEACE);
  
  // Notify players if server messaging is available
  if (typeof server_send_chat_message === 'function') {
    var msg = "Players " + playerId1 + " and " + playerId2 + " have made peace.";
    server_send_chat_message(msg, E_DIPLOMACY || 0);
  }
}

/**************************************************************************
 * Form alliance between two players
 * 
 * @param {number} playerId1 - First player ID
 * @param {number} playerId2 - Second player ID
 **************************************************************************/
function server_form_alliance(playerId1, playerId2) {
  server_set_diplomatic_state(playerId1, playerId2, DS_ALLIANCE);
  
  // Notify players if server messaging is available
  if (typeof server_send_chat_message === 'function') {
    var msg = "Players " + playerId1 + " and " + playerId2 + " have formed an alliance!";
    server_send_chat_message(msg, E_DIPLOMACY || 0);
  }
}

/**************************************************************************
 * Check if two players are at war
 * 
 * @param {number} playerId1 - First player ID
 * @param {number} playerId2 - Second player ID
 * @returns {boolean} True if players are at war
 **************************************************************************/
function server_is_at_war(playerId1, playerId2) {
  return server_get_diplomatic_state(playerId1, playerId2) === DS_WAR;
}

/**************************************************************************
 * Check if two players are allied
 * 
 * @param {number} playerId1 - First player ID
 * @param {number} playerId2 - Second player ID
 * @returns {boolean} True if players are allied
 **************************************************************************/
function server_is_allied(playerId1, playerId2) {
  return server_get_diplomatic_state(playerId1, playerId2) === DS_ALLIANCE;
}