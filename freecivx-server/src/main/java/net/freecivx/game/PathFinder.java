package net.freecivx.game;

import net.freecivx.server.Packets;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

/**
 * Path-finding utility for unit movement requests.
 * Uses an A* search that accounts for per-terrain movement costs, and for
 * land units avoids ocean tiles (terrain 2 = Ocean, 3 = Deep Ocean).
 * Mirrors the behaviour of {@code common/pf_tools.c} in the C Freeciv server.
 */
public class PathFinder {
    private static final Logger log = LoggerFactory.getLogger(PathFinder.class);
    private final Game game;

    /** Direction deltas: NW, N, NE, W, E, SW, S, SE (indices 0-7). */
    private static final int[] DIR_DX = {-1, 0, 1, -1, 1, -1, 0, 1};
    private static final int[] DIR_DY = {-1, -1, -1, 0, 0, 1, 1, 1};

    public PathFinder(Game game) {
        this.game = game;
    }

    /**
     * Processes the move request and returns a path packet for the client.
     * If no path can be found the response contains an empty direction list.
     */
    public JSONObject processMove(JSONObject json) {
        long unitId = json.optLong("unit_id");
        long destinationTileId = json.optLong("goal");

        Unit unit = game.units.get(unitId);
        if (unit == null) {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_WEB_GOTO_PATH);
            msg.put("unit_id", unitId);
            msg.put("length", 0);
            msg.put("dir", new JSONArray());
            msg.put("dest", destinationTileId);
            msg.put("turns", 0);
            return msg;
        }

        UnitType utype = game.unitTypes.get((long) unit.getType());
        int domain = utype != null ? utype.getDomain() : 0;
        if (utype == null) {
            log.warn("PathFinder: unit type {} not found; defaulting to land domain", unit.getType());
        }

        List<Integer> dirs = findPath(unit.getTile(), destinationTileId, domain);

        JSONArray dirArray = new JSONArray();
        for (int d : dirs) dirArray.put(d);

        int movesLeft = unit.getMovesleft();
        if (movesLeft <= 0) movesLeft = 1;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_WEB_GOTO_PATH);
        msg.put("unit_id", unitId);
        msg.put("length", dirs.size());
        msg.put("dir", dirArray);
        msg.put("dest", destinationTileId);
        msg.put("turns", Math.max(1, (int) Math.ceil((double) dirs.size() / movesLeft)));
        return msg;
    }

    /**
     * Finds a path from {@code startTileId} to {@code destTileId} using A*
     * with terrain movement costs.  Returns an ordered list of direction
     * indices (0-7) from start to destination, or an empty list when no path
     * exists.
     *
     * <p>For hex topology ({@link Game#TF_HEX}) only 6 of the 8 directions
     * are valid.  For pure hex (TF_HEX without TF_ISO) the diagonal SE(7) and
     * NW(0) directions are invalid; for iso-hex (TF_HEX | TF_ISO) NE(2) and
     * SW(5) are invalid.  This mirrors {@code is_valid_dir()} in the
     * C Freeciv client's {@code common/map.c}.
     *
     * @param startTileId start tile index
     * @param destTileId  destination tile index
     * @param domain      unit domain: 0 = land, 1 = sea, 2 = air
     */
    List<Integer> findPath(long startTileId, long destTileId, int domain) {
        if (startTileId == destTileId) return Collections.emptyList();

        int xsize = game.map.getXsize();
        Tile destTile = game.tiles.get(destTileId);
        if (destTile == null) return Collections.emptyList();

        long destX = destTile.getX(xsize);
        long destY = destTile.getY(xsize);

        // Determine which directions are valid based on map topology.
        boolean[] validDir = buildValidDirs(game.getTopologyId());

        // A* open set: [tileId (as double bits), f-cost]
        PriorityQueue<double[]> open = new PriorityQueue<>(
                (a, b) -> Double.compare(a[1], b[1]));
        Map<Long, Long> cameFrom = new HashMap<>();       // tileId -> parentTileId
        Map<Long, Integer> cameFromDir = new HashMap<>(); // tileId -> direction taken
        Map<Long, Double> gScore = new HashMap<>();

        gScore.put(startTileId, 0.0);
        open.offer(new double[]{startTileId, 0.0});

        while (!open.isEmpty()) {
            double[] current = open.poll();
            long curId = (long) current[0];

            if (curId == destTileId) {
                return reconstructPath(cameFrom, cameFromDir, destTileId);
            }

            Tile curTile = game.tiles.get(curId);
            if (curTile == null) continue;
            long curX = curTile.getX(xsize);
            long curY = curTile.getY(xsize);

            for (int d = 0; d < 8; d++) {
                if (!validDir[d]) continue;

                long nx = curX + DIR_DX[d];
                long ny = curY + DIR_DY[d];

                // Wrap horizontally (cylindrical map)
                nx = ((nx % xsize) + xsize) % xsize;

                long neighborId = ny * xsize + nx;
                Tile neighbor = game.tiles.get(neighborId);
                if (neighbor == null) continue;

                // Terrain passability for land units
                if (domain == 0) {
                    int terrain = neighbor.getTerrain();
                    if (terrain == 2 || terrain == 3) continue; // ocean impassable
                }

                int moveCost = getMoveCost(neighbor, domain);
                double tentativeG = gScore.getOrDefault(curId, Double.MAX_VALUE) + moveCost;

                if (tentativeG < gScore.getOrDefault(neighborId, Double.MAX_VALUE)) {
                    cameFrom.put(neighborId, curId);
                    cameFromDir.put(neighborId, d);
                    gScore.put(neighborId, tentativeG);
                    double h = heuristic(nx, ny, destX, destY);
                    open.offer(new double[]{neighborId, tentativeG + h});
                }
            }
        }

        return Collections.emptyList(); // no path found
    }

    /**
     * Returns a boolean array of length 8 where {@code true} means the
     * direction index is valid for the given topology.
     *
     * <p>Direction indices: 0=NW, 1=N, 2=NE, 3=W, 4=E, 5=SW, 6=S, 7=SE.
     * Mirrors {@code is_valid_dir()} in the C Freeciv client.
     *
     * @param topologyId the map topology bitmask (0=square, 2=hex, 3=iso-hex)
     */
    private static boolean[] buildValidDirs(int topologyId) {
        boolean isHex = (topologyId & Game.TF_HEX) != 0;
        boolean isIso = (topologyId & Game.TF_ISO) != 0;
        boolean[] valid = new boolean[8];
        for (int d = 0; d < 8; d++) {
            if (isHex) {
                if (!isIso) {
                    // Pure hex: NW(0) and SE(7) are invalid.
                    valid[d] = (d != 0 && d != 7);
                } else {
                    // Iso-hex: NE(2) and SW(5) are invalid.
                    valid[d] = (d != 2 && d != 5);
                }
            } else {
                valid[d] = true; // square: all 8 directions valid
            }
        }
        return valid;
    }

    /**
     * Returns the movement cost to enter the given tile for the specified
     * unit domain.  Mirrors the per-terrain {@code move_cost} from the
     * Freeciv terrain ruleset (Mountains=3, Hills/Forest/Jungle/Swamp=2, others=1).
     */
    private int getMoveCost(Tile tile, int domain) {
        if (domain == 2) return 1; // air units ignore terrain cost
        Terrain terrain = game.terrains.get((long) tile.getTerrain());
        if (terrain != null) return terrain.getMoveCost();
        return 1;
    }

    /** Chebyshev distance heuristic (8-directional movement). */
    private double heuristic(long x1, long y1, long x2, long y2) {
        return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
    }

    /** Reconstructs the direction list by following parent pointers. */
    private List<Integer> reconstructPath(Map<Long, Long> cameFrom,
                                          Map<Long, Integer> cameFromDir,
                                          long dest) {
        List<Integer> dirs = new ArrayList<>();
        long cur = dest;
        while (cameFromDir.containsKey(cur)) {
            dirs.add(cameFromDir.get(cur));
            cur = cameFrom.get(cur);
        }
        Collections.reverse(dirs);
        return dirs;
    }
}
