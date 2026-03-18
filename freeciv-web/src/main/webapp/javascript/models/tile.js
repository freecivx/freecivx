/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.freecivx.com/
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

/**
 * Represents a Freeciv map tile on the client side.
 * Fields mirror PACKET_TILE_INFO defined in packets.def; client-side
 * properties (units, seen, specials, goto_dir, nuke) are initialised to
 * sensible defaults and are never overwritten by server packets.
 */
class Tile {
  constructor(packet) {
    // Fields from PACKET_TILE_INFO (packets.def)
    this.tile = 0;
    this.continent = 0;
    this.known = null;
    this.owner = null;
    this.extras_owner = null;
    this.worked = null;
    this.terrain = 0;
    this.resource = null;
    this.extras = null;
    this.placing = -1;
    this.place_turn = 0;
    this.spec_sprite = null;
    this.label = "";
    this.height = 0;
    // Client-side properties (not from server packets)
    this.units = [];
    this.seen = {};
    this.specials = [];
    this.goto_dir = null;
    this.nuke = 0;
    Object.assign(this, packet);
  }

  /**
   * Update this tile with data from a new server packet.
   */
  update(packet) {
    Object.assign(this, packet);
  }
}

var TILE_UNKNOWN = 0;
var TILE_KNOWN_UNSEEN = 1;
var TILE_KNOWN_SEEN = 2;

const TILE_INDEX_NONE = -1;


/****************************************************************************
  Return a known_type enumeration value for the tile.

  Note that the client only has known data about its own player.
  @param {Tile} ptile - The tile to get the known status for.
  @returns {number} TILE_UNKNOWN, TILE_KNOWN_UNSEEN, or TILE_KNOWN_SEEN.
****************************************************************************/
function tile_get_known(ptile)
{
  if (ptile == null || ptile['known'] == null || ptile['known'] == TILE_UNKNOWN) {
    return TILE_UNKNOWN;
  } else if (ptile['known'] == TILE_KNOWN_UNSEEN) {
    return TILE_KNOWN_UNSEEN;
  } else if (ptile['known'] == TILE_KNOWN_SEEN) {
    return TILE_KNOWN_SEEN;
  }

}

/**************************************************************************
  Returns true iff the specified tile has the extra with the specified
  extra number.
  @param {Tile} ptile - The tile to check.
  @param {number} extra - The extra type index to check for.
  @returns {boolean} True if the tile has the specified extra.
**************************************************************************/
function tile_has_extra(ptile, extra)
{
  if (ptile == null || ptile['extras'] == null) {
    return false;
  }

  return ptile['extras'].isSet(extra);
}

/**
 * Returns the resource extra index for the tile, or null if there is none.
 * @param {Tile} tile - The tile to get the resource for.
 * @returns {number|null} The resource extra index, or null if no resource.
 */
function tile_resource(tile)
{
  if (tile != null && tile.extras != null) {
    const tile_extras = tile.extras.toBitSet();
    for (var extra in tile_extras) {
      if (is_extra_caused_by(extras[tile_extras[extra]], EC_RESOURCE)) {
        return tile_extras[extra];
      }
    }
  }
  return null;
}

/************************************************************************//**
  Check if tile contains an extra type that claim territory
  @param {Tile} ptile - The tile to check for territory-claiming extras.
  @returns {boolean} True if the tile has a territory-claiming extra.
****************************************************************************/
function tile_has_territory_claiming_extra(ptile)
{
  var extra;

  for (extra = 0; extra < MAX_EXTRA_TYPES; extra++) {
    if (tile_has_extra(ptile, extra)
        && territory_claiming_extra(extra_by_number(extra))) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the owner player number of the tile.
 * @param {Tile} tile - The tile to get the owner for.
 * @returns {number|null} The owner's player number, or null if unowned.
 */
function tile_owner(tile)
{
  return tile['owner'];
}

/**
 * Sets the owner of the tile.
 * @param {Tile} tile - The tile to set the owner on.
 * @param {number|null} owner - The player number of the new owner.
 * @param {number|null} claimer - The player number of the claimer (unused).
 */
function tile_set_owner(tile, owner, claimer)
{
  tile['owner'] = owner;
}

/**
 * Returns the city ID of the city working this tile, or null.
 * @param {Tile} tile - The tile to get the worked city for.
 * @returns {number|null} The city ID working the tile, or null if none.
 */
function tile_worked(tile)
{
  return tile['worked'];
}

/**
 * Sets the city working the tile.
 * @param {Tile} ptile - The tile to update.
 * @param {number|null} pwork - The city ID working the tile, or null.
 */
function tile_set_worked(ptile, pwork)
{
  ptile['worked'] = pwork;
}


/****************************************************************************
  Return the city on this tile (or NULL), checking for city center.
  @param {Tile} ptile - The tile to get the city for.
  @returns {City|null} The city on the tile (if it is the city center), or null.
****************************************************************************/
function tile_city(ptile)
{
  if (ptile == null) return null;

  var city_id = ptile['worked'];
  var pcity = cities[city_id];

  if (pcity != null && is_city_center(pcity, ptile)) {
    return pcity;
  }
  return null;
}
