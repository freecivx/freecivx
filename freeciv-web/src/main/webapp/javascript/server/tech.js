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
 **************************************************************************/
function server_create_technologies() {
  techs = {};

  // Use handle_ruleset_tech to create technologies
  handle_ruleset_tech({ id: 0, name: "Alphabet", research_reqs: [] });
  handle_ruleset_tech({ id: 1, name: "Bronze Working", research_reqs: [] });
  handle_ruleset_tech({ id: 2, name: "Pottery", research_reqs: [] });
  handle_ruleset_tech({ id: 3, name: "The Wheel", research_reqs: [] });

  console.log("[Server Ruleset] Created " + Object.keys(techs).length + " technologies");
}