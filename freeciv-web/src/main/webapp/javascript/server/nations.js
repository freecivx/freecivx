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
 * Nations management for the JavaScript server
 * 
 * This module handles creating nation definitions for the standalone server.
 * Nations are hardcoded here since the JavaScript server doesn't have access
 * to the full ruleset files.
 */

/**************************************************************************
 * Create nation definitions
 **************************************************************************/
function server_create_nations() {
  nations = {};
  
  // Use handle_ruleset_nation to create nations
  handle_ruleset_nation({
    id: 0,
    name: "Romans",
    adjective: "Roman",
    graphic_str: "rome",
    legend: "The Roman Empire was one of the greatest civilizations in history, ruling much of Europe, North Africa, and the Middle East for centuries.",
    color: "#8B0000",
    is_playable: true
  });
  
  handle_ruleset_nation({
    id: 1,
    name: "Egyptians",
    adjective: "Egyptian",
    graphic_str: "egypt",
    legend: "Ancient Egypt was home to one of the oldest civilizations, known for the Pyramids, the Sphinx, and powerful pharaohs.",
    color: "#FFD700",
    is_playable: true
  });
  
  handle_ruleset_nation({
    id: 2,
    name: "Greeks",
    adjective: "Greek",
    graphic_str: "greece",
    legend: "Ancient Greece laid the foundations of Western civilization with contributions to philosophy, democracy, science, and the arts.",
    color: "#0000FF",
    is_playable: true
  });
  
  handle_ruleset_nation({
    id: 3,
    name: "Barbarians",
    adjective: "Barbarian",
    graphic_str: "barbarian",
    legend: "Barbarian tribes roamed the fringes of civilization, sometimes raiding, sometimes trading with settled peoples.",
    color: "#808080",
    is_playable: true
  });
  
  handle_ruleset_nation({
    id: 4,
    name: "Persians",
    adjective: "Persian",
    graphic_str: "iran_ancient",
    legend: "The Persian Empire was one of the largest empires in ancient history, stretching from India to Greece.",
    color: "#800080",
    is_playable: true
  });
  
  handle_ruleset_nation({
    id: 5,
    name: "Chinese",
    adjective: "Chinese",
    graphic_str: "china",
    legend: "Ancient China developed one of the world's oldest continuous civilizations with innovations in technology, governance, and culture.",
    color: "#FF0000",
    is_playable: true
  });
  
  handle_ruleset_nation({
    id: 6,
    name: "Indians",
    adjective: "Indian",
    graphic_str: "india",
    legend: "Ancient India was the birthplace of major religions and philosophical traditions, and a center of learning and trade.",
    color: "#FFA500",
    is_playable: true
  });
  
  handle_ruleset_nation({
    id: 7,
    name: "Vikings",
    adjective: "Viking",
    graphic_str: "viking",
    legend: "The Norse Vikings were legendary seafarers and warriors who explored and settled vast territories from America to Russia.",
    color: "#4169E1",
    is_playable: true
  });
  
  handle_ruleset_nation({
    id: 8,
    name: "Babylonians",
    adjective: "Babylonian",
    graphic_str: "babylon",
    legend: "The Babylonian Empire was known for the Hanging Gardens, the Code of Hammurabi, and advances in astronomy and mathematics.",
    color: "#DAA520",
    is_playable: true
  });
  
  handle_ruleset_nation({
    id: 9,
    name: "Carthaginians",
    adjective: "Carthaginian",
    graphic_str: "cartago",
    legend: "Carthage was a powerful maritime trading empire that rivaled Rome for control of the Mediterranean.",
    color: "#8B4513",
    is_playable: true
  });
  
  console.log("[Server Nations] Created " + Object.keys(nations).length + " nations");
}
