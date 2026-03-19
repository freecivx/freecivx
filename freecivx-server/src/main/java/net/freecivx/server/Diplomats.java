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
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Diplomat and spy actions. Mirrors diplomats.c in the C Freeciv server.
 */
public class Diplomats {

    private static final Logger log = LoggerFactory.getLogger(Diplomats.class);
    private static final Random random = new Random();

    /** Returns true if tileA and tileB are the same tile or adjacent (Chebyshev ≤ 1). */
    public static boolean isTileAdjacentOrEqual(Game game, long tileA, long tileB) {
        if (tileA == tileB) return true;
        if (game.map == null) return false;
        int xsize = game.map.getXsize();
        int ax = (int)(tileA % xsize);
        int ay = (int)(tileA / xsize);
        int bx = (int)(tileB % xsize);
        int by = (int)(tileB / xsize);
        int rawDx = Math.abs(ax - bx);
        int wrappedDx = Math.min(rawDx, xsize - rawDx);
        int dy = Math.abs(ay - by);
        return wrappedDx <= 1 && dy <= 1;
    }

    /** Establish an embassy with the owner of the target city. Mirrors do_establish_embassy(). */
    public static boolean establishEmbassy(Game game, long actorId, long cityId) {
        Unit actor = game.units.get(actorId);
        if (actor == null) return false;

        UnitType actorType = game.unitTypes.get((long) actor.getType());
        if (actorType == null || !actorType.isNonMilitary()) return false;

        City targetCity = game.cities.get(cityId);
        if (targetCity == null) return false;

        long actorOwner = actor.getOwner();
        long targetOwner = targetCity.getOwner();
        if (actorOwner == targetOwner) return false;
        if (!isTileAdjacentOrEqual(game, actor.getTile(), targetCity.getTile())) return false;

        Player actingPlayer = game.players.get(actorOwner);
        if (actingPlayer == null) return false;
        Player targetPlayer = game.players.get(targetOwner);

        String targetName = targetPlayer != null ? targetPlayer.getUsername() : "foreign";
        actor.setMovesleft(0);

        Notify.notifyPlayer(game, game.getServer(), actorOwner,
                "Your Diplomat has established an embassy with " + targetName + ".");
        if (targetPlayer != null) {
            Notify.notifyPlayer(game, game.getServer(), targetOwner,
                    actingPlayer.getUsername() + " has established an embassy in " + targetCity.getName() + ".");
        }
        log.info("Embassy established: {} → {} (city {})", actorOwner, targetOwner, targetCity.getName());
        return true;
    }

    /** Bribe an enemy unit, converting it to the acting player's control. Mirrors diplomat_bribe(). */
    public static boolean bribeUnit(Game game, long actorId, long targetId) {
        Unit actor = game.units.get(actorId);
        Unit target = game.units.get(targetId);
        if (actor == null || target == null) return false;

        UnitType actorType = game.unitTypes.get((long) actor.getType());
        if (actorType == null || !actorType.isNonMilitary()) return false;
        if (actor.getOwner() == target.getOwner()) return false;
        if (!isTileAdjacentOrEqual(game, actor.getTile(), target.getTile())) return false;

        // Cannot bribe a unit garrisoned in a city.
        net.freecivx.game.Tile targetTile = game.tiles.get(target.getTile());
        if (targetTile != null && targetTile.getWorked() > 0
                && game.cities.get(targetTile.getWorked()) != null) return false;

        Player actingPlayer = game.players.get(actor.getOwner());
        if (actingPlayer == null) return false;

        UnitType targetType = game.unitTypes.get((long) target.getType());
        int maxHp = targetType != null ? targetType.getHp() : 10;
        int atk   = targetType != null ? targetType.getAttackStrength() : 1;
        int def   = targetType != null ? targetType.getDefenseStrength() : 1;
        int bribeCost = Math.max(1, (atk + def) * target.getHp() / maxHp * 50);

        if (actingPlayer.getGold() < bribeCost) {
            Notify.notifyPlayer(game, game.getServer(), actor.getOwner(),
                    "You need " + bribeCost + " gold to bribe this unit (you have "
                    + actingPlayer.getGold() + ").");
            return false;
        }

        actingPlayer.setGold(actingPlayer.getGold() - bribeCost);
        long previousOwner = target.getOwner();
        target.setOwner(actor.getOwner());
        target.setVeteran(0);
        actor.setMovesleft(0);

        String targetName = targetType != null ? targetType.getName() : "unit";
        Notify.notifyPlayer(game, game.getServer(), actor.getOwner(),
                "Your Diplomat bribed the enemy " + targetName + " for " + bribeCost + " gold.");
        Notify.notifyPlayer(game, game.getServer(), previousOwner,
                "One of your " + targetName + " units was bribed by an enemy Diplomat!");

        UnitTools.refreshUnit(game, target.getId());
        log.info("Unit {} bribed from player {} by player {} for {} gold",
                targetId, previousOwner, actor.getOwner(), bribeCost);
        return true;
    }

    /** Sabotage production in a foreign city. Mirrors diplomat_sabotage(). */
    public static boolean sabotageCity(Game game, long actorId, long cityId) {
        Unit actor = game.units.get(actorId);
        if (actor == null) return false;

        UnitType actorType = game.unitTypes.get((long) actor.getType());
        if (actorType == null || !actorType.isNonMilitary()) return false;

        City targetCity = game.cities.get(cityId);
        if (targetCity == null) return false;
        if (actor.getOwner() == targetCity.getOwner()) return false;
        if (!isTileAdjacentOrEqual(game, actor.getTile(), targetCity.getTile())) return false;

        Player targetOwner = game.players.get(targetCity.getOwner());
        targetCity.setShieldStock(0);
        actor.setMovesleft(0);

        boolean expelled = random.nextInt(2) == 0;
        if (expelled) {
            game.units.remove(actorId);
            game.getServer().sendUnitRemove(actorId);
            Notify.notifyPlayer(game, game.getServer(), actor.getOwner(),
                    "Your Diplomat sabotaged " + targetCity.getName()
                    + " but was caught and expelled!");
        } else {
            Notify.notifyPlayer(game, game.getServer(), actor.getOwner(),
                    "Your Diplomat successfully sabotaged production in " + targetCity.getName() + ".");
        }
        if (targetOwner != null) {
            Notify.notifyPlayer(game, game.getServer(), targetCity.getOwner(),
                    "An enemy Diplomat has sabotaged production in " + targetCity.getName() + "!");
        }
        log.info("City {} sabotaged by player {}, expelled={}", targetCity.getName(),
                actor.getOwner(), expelled);
        return true;
    }

    /** Steal a random technology from a foreign player via their city. Mirrors diplomat_get_tech(). */
    public static boolean stealTech(Game game, long actorId, long cityId) {
        Unit actor = game.units.get(actorId);
        if (actor == null) return false;

        UnitType actorType = game.unitTypes.get((long) actor.getType());
        if (actorType == null || !actorType.isNonMilitary()) return false;

        City targetCity = game.cities.get(cityId);
        if (targetCity == null) return false;
        if (actor.getOwner() == targetCity.getOwner()) return false;
        if (!isTileAdjacentOrEqual(game, actor.getTile(), targetCity.getTile())) return false;

        Player actingPlayer = game.players.get(actor.getOwner());
        Player targetPlayer = game.players.get(targetCity.getOwner());
        if (actingPlayer == null || targetPlayer == null) return false;

        List<Long> stealableTechs = new ArrayList<>();
        for (long techId : targetPlayer.getKnownTechs()) {
            if (!actingPlayer.hasTech(techId)) {
                stealableTechs.add(techId);
            }
        }

        if (stealableTechs.isEmpty()) {
            Notify.notifyPlayer(game, game.getServer(), actor.getOwner(),
                    "There are no technologies to steal from " + targetPlayer.getUsername() + ".");
            return false;
        }

        long stolenTechId = stealableTechs.get(random.nextInt(stealableTechs.size()));
        Technology stolenTech = game.techs.get(stolenTechId);
        String techName = stolenTech != null ? stolenTech.getName() : "technology";

        actingPlayer.addKnownTech(stolenTechId);
        actor.setMovesleft(0);

        boolean caught = random.nextInt(3) == 0;
        if (caught) {
            game.units.remove(actorId);
            game.getServer().sendUnitRemove(actorId);
            Notify.notifyPlayer(game, game.getServer(), actor.getOwner(),
                    "Your Diplomat stole " + techName + " but was caught!");
            Notify.notifyPlayer(game, game.getServer(), targetCity.getOwner(),
                    "An enemy Diplomat stole " + techName + " from " + targetCity.getName()
                    + " and was caught!");
        } else {
            Notify.notifyPlayer(game, game.getServer(), actor.getOwner(),
                    "Your Diplomat stole " + techName + " from " + targetCity.getName() + ".");
            Notify.notifyPlayer(game, game.getServer(), targetCity.getOwner(),
                    "An enemy Diplomat has stolen technology from " + targetCity.getName() + "!");
        }
        TechTools.sendResearchInfo(game, game.getServer(),
                actingPlayer.getConnectionId(), actingPlayer.getPlayerNo());
        log.info("Tech {} stolen from {} by {}, caught={}", techName,
                targetCity.getOwner(), actor.getOwner(), caught);
        return true;
    }
}
