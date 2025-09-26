package net.freecivx.game;

import net.freecivx.server.Packets;
import org.json.JSONArray;
import org.json.JSONObject;

public class PathFinder {
    private final Game game;
    private final int[] DIR_DX = {-1, 0, 1, -1, 1, -1, 0, 1};
    private final int[] DIR_DY = {-1, -1, -1, 0, 0, 1, 1, 1};

    public PathFinder(Game game) {
        this.game = game;
    }

    /**
     * Processes the move request and generates a direct path.
     */
    public JSONObject processMove(JSONObject json) {
        long unitId = json.optInt("unit_id");
        long destinationTileId = json.optInt("goal");

        Unit unit = game.units.get(unitId);
        Tile startTile = game.tiles.get(unit.getTile());
        Tile destTile = game.tiles.get(destinationTileId);

        JSONArray dirs = getDirectPath(startTile, destTile, game.map);

        // Construct JSON message
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_WEB_GOTO_PATH);
        msg.put("unit_id", unitId);
        msg.put("length", dirs.length());
        msg.put("dir", dirs);
        msg.put("dest", destinationTileId);
        msg.put("turns", Math.max(1, dirs.length() / unit.getMovesleft()));

        return msg;
    }

    /**
     * Generates a direct path in a straight line from start to destination.
     */
    private JSONArray getDirectPath(Tile start, Tile dest, WorldMap map) {
        JSONArray dirs = new JSONArray();
        long startX = start.getX(map.getXsize());
        long startY = start.getY(map.getXsize());
        long destX = dest.getX(map.getXsize());
        long destY = dest.getY(map.getXsize());

        long x = startX;
        long y = startY;

        while (x != destX || y != destY) {
            int dx = Long.compare(destX, x); // -1, 0, or 1
            int dy = Long.compare(destY, y); // -1, 0, or 1

            int direction = getDirection(dx, dy);
            if (direction != -1) {
                dirs.put(direction);
                x += dx;
                y += dy;
            } else {
                break; // Stop if no valid direction is found
            }
        }

        return dirs;
    }

    /**
     * Determines movement direction based on DX and DY values.
     */
    private int getDirection(int dx, int dy) {
        for (int i = 0; i < 8; i++) {
            if (DIR_DX[i] == dx && DIR_DY[i] == dy) {
                return i;
            }
        }
        return -1; // No valid direction found
    }
}
