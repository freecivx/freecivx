/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.FreecivWorld.net/
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

import org.json.JSONArray;

/**
 * Shared packet-encoding utilities used by both {@link CivServer} and
 * {@link BrowserCivServer}.
 *
 * <p>Keeping these helpers in a standalone class with no server-transport
 * dependencies (no WebSocket, no HTTP) allows them to be compiled and used
 * by the TeaVM/browser build without dragging in server-only libraries.
 */
public final class PacketUtils {

    private PacketUtils() {}

    /**
     * Action result IDs for PACKET_RULESET_ACTION.
     * Maps action index → result code expected by the JS client.
     * Mirrors the {@code action_result_t} array in the C Freeciv server.
     */
    public static final int[] ACTION_RESULTS = {
        0,  0,  1,  1,  2,  2,  3,  3,  4,  4,
        5,  5,  6,  6,  7,  7,  8,  8,  9,  9,
        10, 11, 12, 13, 15, 14, 14, 16, 17, 18,
        18, 20, 20, 21, 21, 22, 23, 24, 25, 26,
        27, 60, 28, 42, 30, 31, 31, 32, 33, 34,
        34, 34, 34, 19, 19, 19, 19, 40, 37, 38,
        36, 41, 45, 44, 43, 39, 46, 47, 51, 51,
        51, 48, 52, 52, 52, 52, 50, 50, 50, 50,
        63, 63, 63, 49, 53, 54, 55, 55, 55, 55,
        56, 56, 56, 56, 57, 57, 57, 57, 35, 35,
        29, 59, 29, 59, 29, 59, 61, 62, 58, 58,
        58, 64, 65, 66, 66, 66, 66
    };

    /**
     * Human-readable action names for PACKET_RULESET_ACTION.
     * Index must match {@link #ACTION_RESULTS}.
     */
    public static final String[] ACTION_NAMES = {
        "Establish Embassy", "Establish Embassy Stay", "Investigate City",
        "Investigate City Spend", "Poison City", "Poison City Escape",
        "Steal Gold", "Steal Gold Escape", "Sabotage City", "Sabotage City Escape",
        "Targeted Sabotage City", "Targeted Sabotage City Escape",
        "Sabotage City Production", "Sabotage City Production Escape",
        "Steal Tech", "Steal Tech Escape", "Targeted Steal Tech",
        "Targeted Steal Tech Escape", "Incite City", "Incite City Escape",
        "Trade Route", "Marketplace", "Help Wonder", "Bribe Unit",
        "Capture Units", "Sabotage Unit", "Sabotage Unit Escape",
        "Found City", "Join City", "Steal Maps", "Steal Maps Escape",
        "Nuke City Spy", "Nuke City Spy Escape", "Nuke", "Nuke City", "Nuke Units",
        "Destroy City", "Expel Unit", "Disband Unit Recover", "Disband Unit",
        "Home City", "Homeless", "Upgrade Unit", "Convert", "Airlift",
        "Attack", "Suicide Attack", "Strike Building", "Strike Production",
        "Conquer City", "Conquer City 2", "Conquer City 3", "Conquer City 4",
        "Bombard", "Bombard 2", "Bombard 3", "Bombard Lethal", "Fortify",
        "Cultivate", "Plant", "Transform Terrain", "Road", "Irrigate",
        "Mine", "Base", "Pillage", "Clean Pollution", "Clean Fallout",
        "Transport Board", "Transport Board 2", "Transport Board 3",
        "Transport Deboard", "Transport Embark", "Transport Embark 2",
        "Transport Embark 3", "Transport Embark 4",
        "Transport Disembark", "Transport Disembark 2",
        "Transport Disembark 3", "Transport Disembark 4",
        "Transport Load", "Transport Load 2", "Transport Load 3",
        "Transport Unload", "Spread Plague", "Spy Attack",
        "Conquer Extras", "Conquer Extras 2", "Conquer Extras 3", "Conquer Extras 4",
        "Enter Hut", "Enter Hut 2", "Enter Hut 3", "Enter Hut 4",
        "Frighten Hut", "Frighten Hut 2", "Frighten Hut 3", "Frighten Hut 4",
        "Heal Unit", "Heal Unit 2",
        "Paradrop", "Paradrop Conquer", "Paradrop Frighten",
        "Paradrop Frighten Conquer", "Paradrop Enter", "Paradrop Enter Conquer",
        "Wipe Units", "Spy Escape",
        "Unit Move", "Unit Move 2", "Unit Move 3",
        "Clean", "Teleport",
        "User Action 1", "User Action 2", "User Action 3", "User Action 4"
    };

    /**
     * Converts a binary string (e.g. {@code "10110000"}) to a {@link JSONArray}
     * of byte values suitable for use as a bit-vector in a Freeciv packet.
     *
     * <p>This mirrors the bit-vector encoding expected by the JavaScript client's
     * {@code BitVector} class in {@code bitvector.js}: each array element holds
     * one byte (0–255) with the most-significant bit of each byte corresponding
     * to the leftmost character in the input string.
     *
     * @param binaryString a string of {@code '0'} and {@code '1'} characters
     * @return a {@link JSONArray} of byte values (as integers 0–255)
     */
    public static JSONArray binaryStringToJsonArray(String binaryString) {
        int byteArraySize = (binaryString.length() + 7) / 8;
        int[] bitVector = new int[byteArraySize];

        for (int i = 0; i < binaryString.length(); i++) {
            if (binaryString.charAt(i) == '1') {
                bitVector[i / 8] |= (1 << (7 - (i % 8)));
            }
        }

        JSONArray jsonArray = new JSONArray();
        for (int value : bitVector) {
            jsonArray.put(value);
        }

        return jsonArray;
    }
}
