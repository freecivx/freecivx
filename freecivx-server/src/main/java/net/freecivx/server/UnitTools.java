/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
 Copyright (C) 2009-2025  The Freeciv-web project

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

package net.freecivx.server;

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Player;
import net.freecivx.game.Technology;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Utility methods for unit management used across server handlers.
 * Mirrors the functionality of unittools.c in the C Freeciv server.
 * Provides functions for creating and removing units, sending unit packets
 * to clients, and triggering per-turn unit state refreshes.
 */
public class UnitTools {

    private static final Logger log = LoggerFactory.getLogger(UnitTools.class);
    private static final AtomicLong unitIdCounter = new AtomicLong(1);

    /** Default HP for a newly created unit. */
    public static final int UNIT_INITIAL_HP = 10;
    /** Default moves left for a newly created unit. */
    public static final int UNIT_INITIAL_MOVES = 3;

    /**
     * Creates a new unit for the given player on the specified tile.
     * Assigns a unique unit ID, places it on the map, and broadcasts the
     * new unit info to all connected clients.
     *
     * @param game       the current game state
     * @param playerId   the ID of the player who will own the unit
     * @param tileId     the tile index where the unit is to be created
     * @param unitTypeId the unit type ID (index into {@code game.unitTypes})
     * @return the newly created {@link Unit}, or {@code null} if creation failed
     */
    public static Unit createUnit(Game game, long playerId, long tileId, int unitTypeId) {
        Tile tile = game.tiles.get(tileId);
        if (tile == null) return null;

        Player player = game.players.get(playerId);
        if (player == null) return null;

        UnitType unitType = game.unitTypes.get((long) unitTypeId);
        int hp = unitType != null ? unitType.getHp() : UNIT_INITIAL_HP;
        int moveRate = unitType != null ? unitType.getMoveRate() : UNIT_INITIAL_MOVES;

        long unitId = unitIdCounter.getAndIncrement();
        Unit unit = new Unit(unitId, playerId, tileId, unitTypeId, 0, 0, hp, 0, moveRate);
        game.units.put(unitId, unit);

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_INFO);
        msg.put("id", unitId);
        msg.put("owner", playerId);
        msg.put("tile", tileId);
        msg.put("type", unitTypeId);
        msg.put("hp", hp);
        msg.put("movesleft", moveRate);
        game.getServer().broadcastPacket(msg);

        return unit;
    }

    /**
     * Removes the unit with the given ID from the game state and sends a
     * PACKET_UNIT_REMOVE to all clients so they discard their local copy.
     *
     * @param game   the current game state
     * @param unitId the ID of the unit to remove
     */
    public static void removeUnit(Game game, long unitId) {
        if (!game.units.containsKey(unitId)) return;

        game.units.remove(unitId);

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_REMOVE);
        msg.put("unit_id", unitId);
        game.getServer().broadcastPacket(msg);
    }

    /**
     * Sends a PACKET_UNIT_INFO packet for the specified unit to a single client.
     *
     * @param game   the current game state
     * @param server the CivServer used to transmit the packet
     * @param connId the connection ID of the recipient client
     * @param unitId the ID of the unit whose info is to be sent
     */
    public static void sendUnitInfo(Game game, IGameServer server, long connId, long unitId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_INFO);
        msg.put("id", unitId);
        msg.put("owner", unit.getOwner());
        msg.put("tile", unit.getTile());
        msg.put("type", unit.getType());
        msg.put("facing", unit.getFacing());
        msg.put("veteran", unit.getVeteran());
        msg.put("hp", unit.getHp());
        msg.put("activity", unit.getActivity());
        msg.put("movesleft", unit.getMovesleft());
        msg.put("transported", unit.isTransported());
        msg.put("transported_by", unit.getTransportedBy());
        msg.put("homecity", unit.getHomecity());
        server.sendMessage(connId, msg.toString());
    }

    /**
     * Sends PACKET_UNIT_INFO for every unit in the game to the specified client.
     * Used during initial synchronisation after a player joins mid-game.
     *
     * @param game   the current game state
     * @param server the CivServer used to transmit packets
     * @param connId the connection ID of the recipient client
     */
    public static void sendAllUnitInfo(Game game, IGameServer server, long connId) {
        for (long unitId : game.units.keySet()) {
            sendUnitInfo(game, server, connId, unitId);
        }
    }

    /**
     * Resets the unit's move state at the start of a new turn.
     * Restores moves-left to the unit type's full move rate and clears
     * the done-moving flag.
     *
     * @param game   the current game state
     * @param unitId the ID of the unit to reset for the new turn
     */
    public static void unitStartMove(Game game, long unitId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return;

        UnitType unitType = game.unitTypes.get((long) unit.getType());
        int moveRate = unitType != null ? unitType.getMoveRate() : UNIT_INITIAL_MOVES;

        unit.setMovesleft(moveRate);
        unit.setDoneMoving(false);
    }

    /**
     * Refreshes a unit's derived state (e.g. recalculates terrain bonuses,
     * updates activity progress) and sends updated info to all clients.
     *
     * @param game   the current game state
     * @param unitId the ID of the unit to refresh
     */
    public static void refreshUnit(Game game, long unitId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_INFO);
        msg.put("id", unitId);
        msg.put("activity", unit.getActivity());
        msg.put("movesleft", unit.getMovesleft());
        game.getServer().broadcastPacket(msg);
    }

    /** Production cost of a unit type in shields. Mirrors unit_build_shield_cost(). */
    static int calcUnitCost(UnitType utype) {
        return utype.getCost() > 0 ? utype.getCost()
                : (utype.getAttackStrength() + utype.getDefenseStrength()) * utype.getHp() / 2;
    }

    /** Disbands a unit without recovering resources. Mirrors do_unit_disband(). */
    public static void disbandUnit(Game game, long unitId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return;
        game.units.remove(unitId);
        game.getServer().sendUnitRemove(unitId);
        log.info("Unit {} disbanded by player {}", unitId, unit.getOwner());
    }

    /** Recycles a unit into a city, adding half its cost to shield stock. Mirrors do_unit_recycle(). */
    public static void recycleUnit(Game game, long unitId, long cityId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return;
        City city = game.cities.get(cityId);
        if (city != null && city.getTile() == unit.getTile()) {
            UnitType utype = game.unitTypes.get((long) unit.getType());
            if (utype != null) {
                int recycledShields = calcUnitCost(utype) / 2;
                city.setShieldStock(city.getShieldStock() + recycledShields);
                log.info("Unit {} recycled into city {} for {} shields", unitId, cityId, recycledShields);
            }
        }
        game.units.remove(unitId);
        game.getServer().sendUnitRemove(unitId);
    }

    /** Changes a unit's home city. Mirrors do_unit_change_homecity(). */
    public static boolean setUnitHomecity(Game game, long unitId, long cityId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return false;
        City city = game.cities.get(cityId);
        if (city == null) return false;
        if (city.getOwner() != unit.getOwner()) return false;
        if (city.getTile() != unit.getTile()) return false;
        unit.setHomecity(cityId);
        VisibilityHandler.sendUnitToVisiblePlayers(game, unit);
        Notify.notifyPlayer(game, game.getServer(), unit.getOwner(),
                "Unit's home city changed to " + city.getName() + ".");
        log.info("Unit {} home city changed to city {} by player {}", unitId, cityId, unit.getOwner());
        return true;
    }

    /** Upgrades a unit to its newer type at the cost of gold. Mirrors do_unit_upgrade(). */
    public static boolean upgradeUnit(Game game, long unitId, long cityId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return false;
        City city = game.cities.get(cityId);
        if (city == null || city.getOwner() != unit.getOwner()) return false;
        if (city.getTile() != unit.getTile()) return false;
        UnitType oldType = game.unitTypes.get((long) unit.getType());
        if (oldType == null) return false;
        int upgradesTo = oldType.getUpgradesTo();
        if (upgradesTo < 0) {
            Notify.notifyPlayer(game, game.getServer(), unit.getOwner(), "This unit cannot be upgraded.");
            return false;
        }
        UnitType newType = game.unitTypes.get((long) upgradesTo);
        if (newType == null) return false;
        int upgradeCost = Math.max(0, (calcUnitCost(newType) - calcUnitCost(oldType)) * 2);
        Player player = game.players.values().stream()
                .filter(p -> p.getPlayerNo() == unit.getOwner())
                .findFirst().orElse(null);
        if (player == null) return false;
        if (player.getGold() < upgradeCost) {
            Notify.notifyPlayer(game, game.getServer(), unit.getOwner(),
                    "Insufficient gold to upgrade unit (need " + upgradeCost + " gold, have "
                    + player.getGold() + ").");
            return false;
        }
        player.setGold(player.getGold() - upgradeCost);
        unit.setType(upgradesTo);
        unit.setHp(newType.getHp());
        VisibilityHandler.sendUnitToVisiblePlayers(game, unit);
        game.getServer().sendPlayerInfoAll(player);
        Notify.notifyPlayer(game, game.getServer(), unit.getOwner(),
                "Unit upgraded from " + oldType.getName() + " to " + newType.getName()
                + " for " + upgradeCost + " gold.");
        log.info("Unit {} upgraded from {} to {} by player {} for {} gold",
                unitId, oldType.getName(), newType.getName(), unit.getOwner(), upgradeCost);
        return true;
    }

    /** Boards a unit onto a transport. Mirrors do_unit_board_transport(). */
    public static boolean boardTransport(Game game, long unitId, long transportId) {
        Unit unit = game.units.get(unitId);
        Unit transport = game.units.get(transportId);
        if (unit == null || transport == null) return false;
        if (unit.getOwner() != transport.getOwner()) return false;
        if (unit.getTile() != transport.getTile()) return false;
        unit.setTransported(true);
        unit.setTransportedBy(transportId);
        VisibilityHandler.sendUnitToVisiblePlayers(game, unit);
        log.info("Unit {} boarded transport {} for player {}", unitId, transportId, unit.getOwner());
        return true;
    }

    /** Deboards a unit from its transport. Mirrors do_unit_deboard_transport(). */
    public static boolean deboardTransport(Game game, long unitId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return false;
        if (!unit.isTransported()) return false;
        unit.setTransported(false);
        unit.setTransportedBy(-1L);
        VisibilityHandler.sendUnitToVisiblePlayers(game, unit);
        log.info("Unit {} deboarded transport for player {}", unitId, unit.getOwner());
        return true;
    }

    /**
     * Helps build a wonder in a friendly city by disbanding the Caravan or
     * Freight unit and contributing its full production cost as shields to the
     * city's current production.  The city must be currently building a great
     * wonder (genus 0) for the action to succeed.
     *
     * <p>Mirrors {@code do_unit_help_build_wonder()} in the C Freeciv server's
     * {@code server/unittools.c}: the unit is removed and its
     * {@code utype_build_shield_cost_base()} is added to the city's shield stock.
     *
     * @param game   the current game state
     * @param unitId the ID of the Caravan/Freight unit performing the action
     * @param cityId the ID of the target city currently building a wonder
     * @return {@code true} if the action was successfully performed
     */
    public static boolean helpWonder(Game game, long unitId, long cityId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return false;

        UnitType utype = game.unitTypes.get((long) unit.getType());
        if (utype == null || !utype.hasHelpWonderFlag()) {
            Notify.notifyPlayer(game, game.getServer(), unit.getOwner(),
                    "Only Caravans and Freights can help build wonders.");
            return false;
        }

        City city = game.cities.get(cityId);
        if (city == null) return false;
        if (city.getOwner() != unit.getOwner()) return false;
        if (city.getTile() != unit.getTile()) {
            Notify.notifyPlayer(game, game.getServer(), unit.getOwner(),
                    "The unit must be in the same city to help build a wonder.");
            return false;
        }

        // The city must be building a great wonder (genus 0).
        if (city.getProductionKind() != 1) {
            Notify.notifyPlayer(game, game.getServer(), unit.getOwner(),
                    "The city must be building a wonder to receive caravan help.");
            return false;
        }
        net.freecivx.game.Improvement target =
                game.improvements.get((long) city.getProductionValue());
        if (target == null || target.getGenus() != 0) {
            Notify.notifyPlayer(game, game.getServer(), unit.getOwner(),
                    "The city must be building a great wonder to receive caravan help.");
            return false;
        }

        int shields = calcUnitCost(utype);
        city.setShieldStock(city.getShieldStock() + shields);

        game.units.remove(unitId);
        game.getServer().sendUnitRemove(unitId);

        Notify.notifyPlayer(game, game.getServer(), unit.getOwner(),
                utype.getName() + " helped build " + target.getName()
                + " in " + city.getName() + " (++" + shields + " production shields).");
        log.info("Unit {} ({}) helped build {} in city {} for {} shields",
                unitId, utype.getName(), target.getName(), city.getName(), shields);
        return true;
    }

    private static final int MIN_HUT_GOLD = 25;
    private static final int MAX_HUT_GOLD = 100;
    private static final Random random = new Random();

    /** Awards a random reward when a unit enters a goodie hut. Mirrors unit_enter_hut(). */
    public static void enterHut(Game game, Unit unit, net.freecivx.game.Tile tile) {
        tile.setExtras(tile.getExtras() & ~(1 << 8));
        game.getServer().sendTileInfoAll(tile);
        long ownerId = unit.getOwner();
        Player player = game.players.get(ownerId);
        if (player == null) return;
        if (random.nextBoolean()) {
            int gold = MIN_HUT_GOLD + random.nextInt(MAX_HUT_GOLD - MIN_HUT_GOLD + 1);
            player.setGold(player.getGold() + gold);
            game.getServer().sendPlayerInfoAll(player);
            Notify.notifyPlayer(game, game.getServer(), ownerId,
                    "Your explorers found " + gold + " gold in a goodie hut!");
        } else {
            List<Long> researchable = new ArrayList<>();
            for (Map.Entry<Long, Technology> entry : game.techs.entrySet()) {
                long tid = entry.getKey();
                if (!player.hasTech(tid) && TechTools.canPlayerResearch(game, ownerId, tid)) {
                    researchable.add(tid);
                }
            }
            if (!researchable.isEmpty()) {
                long techId = researchable.get(random.nextInt(researchable.size()));
                Technology tech = game.techs.get(techId);
                TechTools.giveTechToPlayer(game, ownerId, techId);
                game.getServer().sendPlayerInfoAll(player);
                Notify.notifyPlayer(game, game.getServer(), ownerId,
                        "Your explorers discovered "
                        + (tech != null ? tech.getName() : "a new technology")
                        + " in a goodie hut!");
            } else {
                int gold = MIN_HUT_GOLD;
                player.setGold(player.getGold() + gold);
                game.getServer().sendPlayerInfoAll(player);
                Notify.notifyPlayer(game, game.getServer(), ownerId,
                        "Your explorers found " + gold + " gold in a goodie hut!");
            }
        }
    }
}
