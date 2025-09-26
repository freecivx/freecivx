/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.Freecivx.net/
 Copyright (C) 2009-2025  The Freeciv-web project, Andreas Røsdal

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

public class Packets {

    public static int PACKET_SERVER_JOIN_REQ = 4;
    public static int PACKET_SERVER_JOIN_REPLY = 5;
    public static int PACKET_PLAYER_READY = 11;
    public static int PACKET_TILE_INFO = 15;
    public static int PACKET_GAME_INFO = 16;
    public static int PACKET_MAP_INFO = 17;
    public static int PACKET_CHAT_MSG = 25;
    public static int PACKET_CHAT_MSG_REQ = 26;
    public static int PACKET_CITY_INFO = 31;
    public static int PACKET_CITY_SHORT_INFO = 32;
    public static int PACKET_CITY_NAME_SUGGESTION_REQ = 43;
    public static int PACKET_CITY_NAME_SUGGESTION_INFO = 44;

    public static int PACKET_PLAYER_INFO = 51;
    public static int PACKET_PLAYER_PHASE_DONE = 52;
    public static int PACKET_PLAYER_RATES = 53;
    public static int PACKET_RESEARCH_INFO = 60;
    public static int PACKET_UNIT_REMOVE = 62;
    public static int PACKET_UNIT_INFO = 63;
    public static int PACKET_UNIT_SHORT_INFO = 64;
    public static int PACKET_UNIT_ORDERS = 73;
    public static int PACKET_UNIT_DO_ACTION = 84;
    public static int PACKET_CONN_PING = 88;
    public static int PACKET_CONN_PONG = 89;
    public static int PACKET_CONN_INFO = 115;
    public static int PACKET_START_PHASE = 126;
    public static int PACKET_BEGIN_TURN = 128;
    public static int PACKET_END_TURN = 129;
    public static int PACKET_RULESET_UNIT = 140;
    public static int PACKET_RULESET_GAME = 141;
    public static int PACKET_RULESET_TECH = 144;
    public static int PACKET_RULESET_GOVERNMENT = 145;
    public static int PACKET_RULESET_NATION = 148;
    public static int PACKET_RULESET_CITY = 149;
    public static int PACKET_RULESET_TERRAIN = 151;
    public static int PACKET_RULESET_CONTROL = 155;
    public static int PACKET_SERVER_SETTING_CONST = 165;
    public static int PACKET_SERVER_SETTING_BOOL = 166;
    public static int PACKET_RULESET_EXTRA = 232;
    public static int PACKET_WEB_PLAYER_INFO_ADDITION = 259;
    public static int PACKET_CALENDAR_INFO = 255;
    public static int PACKET_WEB_RULESET_UNIT_ADDITION = 260;
    public static int PACKET_WEB_GOTO_PATH_REQ = 287;
    public static int PACKET_WEB_GOTO_PATH = 288;


}
