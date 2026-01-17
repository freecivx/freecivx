/**********************************************************************
'use strict';

    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
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

const TRUE = true;
const FALSE = false;

const TRI_NO = 0;
const TRI_YES = 1;
const TRI_MAYBE = 2;

const MAX_NUM_ITEMS = 200;
const MAX_NUM_ADVANCES = 250;
const MAX_NUM_UNITS = 250;
const MAX_NUM_BUILDINGS = 200;
const MAX_EXTRA_TYPES = 128;
const MAX_LEN_NAME = 48;
const MAX_LEN_CITYNAME = 50;

const FC_INFINITY = (1000 * 1000 * 1000);

const ACTIVITY_IDLE = 0;
const ACTIVITY_POLLUTION = 1;
const ACTIVITY_MINE = 2;
const ACTIVITY_IRRIGATE = 3;
const ACTIVITY_FORTIFIED = 4;
const ACTIVITY_SENTRY = 5;
const ACTIVITY_PILLAGE = 6;
const ACTIVITY_GOTO = 7;
const ACTIVITY_EXPLORE = 8;
const ACTIVITY_TRANSFORM = 9;
const ACTIVITY_FORTIFYING = 10;
const ACTIVITY_FALLOUT = 11;
const ACTIVITY_BASE = 12;        /* Building base */
const ACTIVITY_GEN_ROAD = 13;
const ACTIVITY_CONVERT = 14;
const ACTIVITY_CULTIVATE = 15;
const ACTIVITY_PLANT = 16;
const ACTIVITY_CLEAN = 17;
const ACTIVITY_LAST = 18;        /* Leave this one last */

/* enum action_result */
const ACTRES_ESTABLISH_EMBASSY = 0;
const ACTRES_SPY_INVESTIGATE_CITY = 1;
const ACTRES_SPY_POISON = 2;
const ACTRES_SPY_STEAL_GOLD = 3;
const ACTRES_SPY_SABOTAGE_CITY = 4;
const ACTRES_SPY_TARGETED_SABOTAGE_CITY = 5;
const ACTRES_SPY_SABOTAGE_CITY_PRODUCTION = 6;
const ACTRES_SPY_STEAL_TECH = 7;
const ACTRES_SPY_TARGETED_STEAL_TECH = 8;
const ACTRES_SPY_INCITE_CITY = 9;
const ACTRES_TRADE_ROUTE = 10;
const ACTRES_MARKETPLACE = 11;
const ACTRES_HELP_WONDER = 12;
const ACTRES_SPY_BRIBE_UNIT = 13;
const ACTRES_SPY_SABOTAGE_UNIT = 14;
const ACTRES_CAPTURE_UNITS = 15;
const ACTRES_FOUND_CITY = 16;
const ACTRES_JOIN_CITY = 17;
const ACTRES_STEAL_MAPS = 18;
const ACTRES_BOMBARD = 19;
const ACTRES_SPY_NUKE = 20;
const ACTRES_NUKE = 21;
const ACTRES_NUKE_UNITS = 22;
const ACTRES_DESTROY_CITY = 23;
const ACTRES_EXPEL_UNIT = 24;
const ACTRES_RECYCLE_UNIT = 25;
const ACTRES_DISBAND_UNIT = 26;
const ACTRES_HOME_CITY = 27;
const ACTRES_UPGRADE_UNIT = 28;
const ACTRES_PARADROP = 29;
const ACTRES_AIRLIFT = 30;
const ACTRES_ATTACK = 31;
const ACTRES_STRIKE_BUILDING = 32;
const ACTRES_STRIKE_PRODUCTION = 33;
const ACTRES_CONQUER_CITY = 34;
const ACTRES_HEAL_UNIT = 35;
const ACTRES_TRANSFORM_TERRAIN = 36;
const ACTRES_CULTIVATE = 37;
const ACTRES_PLANT = 38;
const ACTRES_PILLAGE = 39;
const ACTRES_FORTIFY = 40;
const ACTRES_ROAD = 41;
const ACTRES_CONVERT = 42;
const ACTRES_BASE = 43;
const ACTRES_MINE = 44;
const ACTRES_IRRIGATE = 45;
const ACTRES_CLEAN_POLLUTION = 46;
const ACTRES_CLEAN_FALLOUT = 47;
const ACTRES_TRANSPORT_DEBOARD = 48;
const ACTRES_TRANSPORT_UNLOAD = 49;
const ACTRES_TRANSPORT_DISEMBARK = 50;
const ACTRES_TRANSPORT_BOARD = 51;
const ACTRES_TRANSPORT_EMBARK = 52;
const ACTRES_SPY_SPREAD_PLAGUE = 53;
const ACTRES_SPY_ATTACK = 54;
const ACTRES_CONQUER_EXTRAS = 55;
const ACTRES_HUT_ENTER = 56;
const ACTRES_HUT_FRIGHTEN = 57;
const ACTRES_UNIT_MOVE = 58;
const ACTRES_PARADROP_CONQUER = 59;
const ACTRES_HOMELESS = 60;
const ACTRES_WIPE_UNITS = 61;
const ACTRES_SPY_ESCAPE = 62;
const ACTRES_TRANSPORT_LOAD = 63;
const ACTRES_CLEAN = 64;
const ACTRES_TELEPORT = 65;
const ACTRES_ENABLER_CHECK = 66;
const ACTRES_NONE = 67;

/* enum action_sub_result */
const ACT_SUB_RES_HUT_ENTER = 0;
const ACT_SUB_RES_HUT_FRIGHTEN = 1;
const ACT_SUB_RES_MAY_EMBARK = 2;
const ACT_SUB_RES_NON_LETHAL = 3;
const ACT_SUB_RES_COUNT = 4;

const IDENTITY_NUMBER_ZERO = 0;

/* Corresponds to the enum action_target_kind */
const ATK_CITY = 0;
const ATK_UNIT = 1;
const ATK_UNITS = 2;
const ATK_TILE = 3;
const ATK_EXTRAS = 4;
const ATK_SELF = 5;
const ATK_COUNT = 6;

/* Corresponds to the enum action_sub_target_kind */
const ASTK_NONE = 0;
const ASTK_BUILDING = 1;
const ASTK_TECH = 2;
const ASTK_EXTRA = 3;
const ASTK_EXTRA_NOT_THERE = 4;
const ASTK_COUNT = 5;

/* Actions */
const ACTION_ESTABLISH_EMBASSY = 0;
const ACTION_ESTABLISH_EMBASSY_STAY = 1;
const ACTION_SPY_INVESTIGATE_CITY = 2;
const ACTION_INV_CITY_SPEND = 3;
const ACTION_SPY_POISON = 4;
const ACTION_SPY_POISON_ESC = 5;
const ACTION_SPY_STEAL_GOLD = 6;
const ACTION_SPY_STEAL_GOLD_ESC = 7;
const ACTION_SPY_SABOTAGE_CITY = 8;
const ACTION_SPY_SABOTAGE_CITY_ESC = 9;
const ACTION_SPY_TARGETED_SABOTAGE_CITY = 10;
const ACTION_SPY_TARGETED_SABOTAGE_CITY_ESC = 11;
const ACTION_SPY_SABOTAGE_CITY_PRODUCTION = 12;
const ACTION_SPY_SABOTAGE_CITY_PRODUCTION_ESC = 13;
const ACTION_SPY_STEAL_TECH = 14;
const ACTION_SPY_STEAL_TECH_ESC = 15;
const ACTION_SPY_TARGETED_STEAL_TECH = 16;
const ACTION_SPY_TARGETED_STEAL_TECH_ESC = 17;
const ACTION_SPY_INCITE_CITY = 18;
const ACTION_SPY_INCITE_CITY_ESC = 19;
const ACTION_TRADE_ROUTE = 20;
const ACTION_MARKETPLACE = 21;
const ACTION_HELP_WONDER = 22;
const ACTION_SPY_BRIBE_UNIT = 23;
const ACTION_CAPTURE_UNITS = 24;
const ACTION_SPY_SABOTAGE_UNIT = 25;
const ACTION_SPY_SABOTAGE_UNIT_ESC = 26;
const ACTION_FOUND_CITY = 27;
const ACTION_JOIN_CITY = 28;
const ACTION_STEAL_MAPS = 29;
const ACTION_STEAL_MAPS_ESC = 30;
const ACTION_SPY_NUKE = 31;
const ACTION_SPY_NUKE_ESC = 32;
const ACTION_NUKE = 33;
const ACTION_NUKE_CITY = 34;
const ACTION_NUKE_UNITS = 35;
const ACTION_DESTROY_CITY = 36;
const ACTION_EXPEL_UNIT = 37;

// TODO: Rename to ACTION_DISBAND_UNIT_RECOVER to match server side
const ACTION_RECYCLE_UNIT = 38;
const ACTION_DISBAND_UNIT = 39;
const ACTION_HOME_CITY = 40;
const ACTION_HOMELESS = 41;
const ACTION_UPGRADE_UNIT = 42;
const ACTION_CONVERT = 43;
const ACTION_AIRLIFT = 44;
const ACTION_ATTACK = 45;
const ACTION_SUICIDE_ATTACK = 46;
const ACTION_STRIKE_BUILDING = 47;
const ACTION_STRIKE_PRODUCTION = 48;
const ACTION_CONQUER_CITY = 49;
const ACTION_CONQUER_CITY2 = 50;
const ACTION_CONQUER_CITY3 = 51;
const ACTION_CONQUER_CITY4 = 52;
const ACTION_BOMBARD = 53;
const ACTION_BOMBARD2 = 54;
const ACTION_BOMBARD3 = 55;
const ACTION_BOMBARD_LETHAL = 56;
const ACTION_FORTIFY = 57;
const ACTION_CULTIVATE = 58;
const ACTION_PLANT = 59;
const ACTION_TRANSFORM_TERRAIN = 60;
const ACTION_ROAD = 61;
const ACTION_IRRIGATE = 62;
const ACTION_MINE = 63;
const ACTION_BASE = 64;
const ACTION_PILLAGE = 65;
const ACTION_CLEAN_POLLUTION = 66;
const ACTION_CLEAN_FALLOUT = 67;
const ACTION_TRANSPORT_BOARD = 68;
const ACTION_TRANSPORT_BOARD2 = 69;
const ACTION_TRANSPORT_BOARD3 = 70;
const ACTION_TRANSPORT_DEBOARD = 71;
const ACTION_TRANSPORT_EMBARK = 72;
const ACTION_TRANSPORT_EMBARK2 = 73;
const ACTION_TRANSPORT_EMBARK3 = 74;
const ACTION_TRANSPORT_EMBARK4 = 75;
const ACTION_TRANSPORT_DISEMBARK1 = 76;
const ACTION_TRANSPORT_DISEMBARK2 = 77;
const ACTION_TRANSPORT_DISEMBARK3 = 78;
const ACTION_TRANSPORT_DISEMBARK4 = 79;
const ACTION_TRANSPORT_LOAD = 80;
const ACTION_TRANSPORT_LOAD2 = 81;
const ACTION_TRANSPORT_LOAD3 = 82;
const ACTION_TRANSPORT_UNLOAD = 83;
const ACTION_SPY_SPREAD_PLAGUE = 84;
const ACTION_SPY_ATTACK = 85;
const ACTION_CONQUER_EXTRAS = 86;
const ACTION_CONQUER_EXTRAS2 = 87;
const ACTION_CONQUER_EXTRAS3 = 88;
const ACTION_CONQUER_EXTRAS4 = 89;
const ACTION_HUT_ENTER = 90;
const ACTION_HUT_ENTER2 = 91;
const ACTION_HUT_ENTER3 = 92;
const ACTION_HUT_ENTER4 = 93;
const ACTION_HUT_FRIGHTEN = 94;
const ACTION_HUT_FRIGHTEN2 = 95;
const ACTION_HUT_FRIGHTEN3 = 96;
const ACTION_HUT_FRIGHTEN4 = 97;
const ACTION_HEAL_UNIT = 98;
const ACTION_HEAL_UNIT2 = 99;
const ACTION_PARADROP = 100;
const ACTION_PARADROP_CONQUER = 101;
const ACTION_PARADROP_FRIGHTEN = 102;
const ACTION_PARADROP_FRIGHTEN_CONQUER = 103;
const ACTION_PARADROP_ENTER = 104;
const ACTION_PARADROP_ENTER_CONQUER = 105;
const ACTION_WIPE_UNITS = 106;
const ACTION_SPY_ESCAPE = 107;
const ACTION_UNIT_MOVE = 108;
const ACTION_UNIT_MOVE2 = 109;
const ACTION_UNIT_MOVE3 = 110;
const ACTION_CLEAN = 111;
const ACTION_USER_ACTION1 = 112;
const ACTION_USER_ACTION2 = 113;
const ACTION_USER_ACTION3 = 114;
const ACTION_USER_ACTION4 = 115;
const ACTION_COUNT = 116;

/* The action_decision enum */
/* Doesn't need the player to decide what action to take. */
const ACT_DEC_NOTHING = 0;
/* Wants a decision because of something done to the actor. */
const ACT_DEC_PASSIVE = 1;
/* Wants a decision because of something the actor did. */
const ACT_DEC_ACTIVE = 2;

/* The kind of universals_u (value_union_type was req_source_type).
 * Used in the network protocol. */
const VUT_NONE = 0;
const VUT_ADVANCE = 1;
const VUT_GOVERNMENT = 2;
const VUT_IMPROVEMENT = 3;
const VUT_TERRAIN = 4;
const VUT_NATION = 5;
const VUT_UTYPE = 6;
const VUT_UTFLAG = 7;
const VUT_UCLASS = 8;
const VUT_UCFLAG = 9;
const VUT_OTYPE = 10;
const VUT_SPECIALIST = 11;
const VUT_MINSIZE = 12;		/* Minimum size: at city range means city size */
const VUT_AI_LEVEL = 13;		/* AI level of the player */
const VUT_TERRAINCLASS = 14;	/* More generic terrain type, currently "Land" or "Ocean" */
const VUT_MINYEAR = 15;
const VUT_TERRAINALTER = 16;      /* Terrain alterations that are possible */
const VUT_CITYTILE = 17;          /* Target tile is used by city. */
const VUT_GOOD = 18;
const VUT_TERRFLAG = 19;
const VUT_NATIONALITY = 20;
const VUT_ROADFLAG = 21;
const VUT_EXTRA = 22;
const VUT_TECHFLAG = 23;
const VUT_ACHIEVEMENT = 24;
const VUT_DIPLREL = 25;
const VUT_MAXTILEUNITS = 26;
const VUT_STYLE = 27;
const VUT_MINCULTURE = 28;
const VUT_UNITSTATE = 29;
const VUT_MINMOVES = 30;
const VUT_MINVETERAN = 31;
const VUT_MINHP = 32;
const VUT_AGE = 33;
const VUT_NATIONGROUP = 34;
const VUT_TOPO = 35;
const VUT_IMPR_GENUS = 36;
const VUT_ACTION = 37;
const VUT_MINTECHS = 38;
const VUT_EXTRAFLAG = 39;
const VUT_MINCALFRAG = 40;
const VUT_SERVERSETTING = 41;
const VUT_CITYSTATUS = 42;
const VUT_MINFOREIGNPCT = 43;
const VUT_ACTIVITY = 44;
const VUT_DIPLREL_TILE = 45;
const VUT_DIPLREL_TILE_O = 46;
const VUT_DIPLREL_UNITANY = 47;
const VUT_DIPLREL_UNITANY_O = 48;
const VUT_COUNT = 49;             /* Keep this last. */

/* Freeciv's gui_type enum */
/* Used for options which do not belong to any gui. */
const GUI_STUB = 0;
const GUI_GTK2 = 1;
const GUI_GTK3 = 2;
const GUI_GTK3_22 = 3;
/* GUI_SDL remains for now for keeping client options alive until
 * user has migrated them to sdl2-client */
const GUI_SDL = 4;
const GUI_QT = 5;
const GUI_SDL2 = 6;
const GUI_WEB = 7;
const GUI_GTK3x = 8;

/* Sometimes we don't know (or don't care) if some requirements for effect
 * are currently fulfilled or not. This enum tells lower level functions
 * how to handle uncertain requirements.
 */
const RPT_POSSIBLE = 0; /* We want to know if it is possible that effect is active */
const RPT_CERTAIN = 1;  /* We want to know if it is certain that effect is active  */

const O_FOOD = 0;
const O_SHIELD = 1;
const O_TRADE = 2;
const O_GOLD = 3;
const O_LUXURY = 4;
const O_SCIENCE = 5;

/* vision_layer enum */
const V_MAIN = 0;
const V_INVIS = 1;
const V_SUBSURFACE = 2;
const V_COUNT = 3;

/* causes for extra */
const EC_IRRIGATION = 0;
const EC_MINE = 1;
const EC_ROAD = 2;
const EC_BASE = 3;
const EC_POLLUTION = 4;
const EC_FALLOUT = 5;
const EC_HUT = 6;
const EC_APPEARANCE = 7;
const EC_RESOURCE = 8;

/* causes for extra removal */
const ERM_PILLAGE = 0;
const ERM_CLEANPOLLUTION = 1; // deprecated.
const ERM_CLEANFALLOUT = 2;
const ERM_DISAPPEARANCE = 3;
const ERM_CLEAN = 1;

/* barbarian types */
const NOT_A_BARBARIAN = 0;
const LAND_BARBARIAN = 1;
const SEA_BARBARIAN = 2;
const ANIMAL_BARBARIAN = 3;
const LAND_AND_SEA_BARBARIAN = 4;

const CAPITAL_NOT = 0;
const CAPITAL_SECONDARY = 1;
const CAPITAL_PRIMARY = 2;
