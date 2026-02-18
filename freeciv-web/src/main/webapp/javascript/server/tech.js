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



/**************************************************************************
 * Create technology definitions
 * 
 * Creates a comprehensive technology tree with prerequisites.
 * Technologies are organized in progression from ancient to modern era.
 **************************************************************************/
function server_create_technologies() {
  techs = {};

  // Ancient Era - Starting technologies
  handle_ruleset_tech({ id: 0, name: "Alphabet", req1: "None", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 1, name: "Bronze Working", req1: "None", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 2, name: "Pottery", req1: "None", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 3, name: "The Wheel", req1: "None", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 4, name: "Ceremonial Burial", req1: "None", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 5, name: "Masonry", req1: "None", req2: "None", research_reqs: [] });
  
  // Ancient Era - Second tier
  handle_ruleset_tech({ id: 6, name: "Code of Laws", req1: "Alphabet", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 7, name: "Map Making", req1: "Alphabet", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 8, name: "Writing", req1: "Alphabet", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 9, name: "Iron Working", req1: "Bronze Working", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 10, name: "Warrior Code", req1: "Bronze Working", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 11, name: "Horseback Riding", req1: "The Wheel", req2: "None", research_reqs: [] });
  
  // Classical Era
  handle_ruleset_tech({ id: 12, name: "Literacy", req1: "Writing", req2: "Code of Laws", research_reqs: [] });
  handle_ruleset_tech({ id: 13, name: "Mathematics", req1: "Alphabet", req2: "Masonry", research_reqs: [] });
  handle_ruleset_tech({ id: 14, name: "Currency", req1: "Bronze Working", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 15, name: "Construction", req1: "Masonry", req2: "Currency", research_reqs: [] });
  handle_ruleset_tech({ id: 16, name: "Monarchy", req1: "Ceremonial Burial", req2: "Code of Laws", research_reqs: [] });
  handle_ruleset_tech({ id: 17, name: "Philosophy", req1: "Literacy", req2: "Ceremonial Burial", research_reqs: [] });
  handle_ruleset_tech({ id: 18, name: "The Republic", req1: "Code of Laws", req2: "Literacy", research_reqs: [] });
  
  // Medieval Era
  handle_ruleset_tech({ id: 19, name: "Engineering", req1: "Construction", req2: "Mathematics", research_reqs: [] });
  handle_ruleset_tech({ id: 20, name: "Feudalism", req1: "Monarchy", req2: "Warrior Code", research_reqs: [] });
  handle_ruleset_tech({ id: 21, name: "Invention", req1: "Engineering", req2: "Literacy", research_reqs: [] });
  handle_ruleset_tech({ id: 22, name: "Chivalry", req1: "Feudalism", req2: "Horseback Riding", research_reqs: [] });
  handle_ruleset_tech({ id: 23, name: "Gunpowder", req1: "Invention", req2: "Iron Working", research_reqs: [] });
  handle_ruleset_tech({ id: 24, name: "Banking", req1: "The Republic", req2: "Currency", research_reqs: [] });
  
  // Renaissance Era
  handle_ruleset_tech({ id: 25, name: "University", req1: "Mathematics", req2: "Philosophy", research_reqs: [] });
  handle_ruleset_tech({ id: 26, name: "Physics", req1: "Literacy", req2: "Navigation", research_reqs: [] });
  handle_ruleset_tech({ id: 27, name: "Navigation", req1: "Map Making", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 28, name: "Chemistry", req1: "University", req2: "Medicine", research_reqs: [] });
  handle_ruleset_tech({ id: 29, name: "Medicine", req1: "Philosophy", req2: "None", research_reqs: [] });
  handle_ruleset_tech({ id: 30, name: "Democracy", req1: "Philosophy", req2: "The Republic", research_reqs: [] });

  console.log("[Server Ruleset] Created " + Object.keys(techs).length + " technologies");
}