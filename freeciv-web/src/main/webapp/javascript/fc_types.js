/****************************************
 * THIS IS A GENERATED FILE, DO NOT EDIT
 *
 * Generated from Freeciv C source files:
 *   utility/shared.h
 *   common/fc_types.h
 *   common/actions.h
 *   common/actres.h
 *   common/requirements.h
 *   common/worklist.h
 *   common/player.h
 * By scripts/gen_fc_types/gen_fc_types.py
 ****************************************/

/* Simple constants from fc_types.h */
var MAX_NUM_ITEMS = 200;
var MAX_NUM_ADVANCES = 250;
var MAX_NUM_UNITS = 250;
var MAX_NUM_BUILDINGS = 200;
var MAX_EXTRA_TYPES = 128;
var MAX_LEN_NAME = 48;
var IDENTITY_NUMBER_ZERO = 0;
var FC_INFINITY = 1000000000;

/* Client-side player limit (server MAX_NUM_PLAYERS = 500) */
var MAX_NUM_PLAYERS = 30;

/* From common/worklist.h */
var MAX_LEN_WORKLIST = 64;

/* From common/player.h */
var MAX_AI_LOVE = 1000;

/* Note: MAX_LEN_CITYNAME is 120 in C, but limited to 50 in JS for compatibility */
var MAX_LEN_CITYNAME = 50;


/* fc_tristate enum from utility/shared.h */
var TRI_NO = 0;
var TRI_YES = 1;
var TRI_MAYBE = 2;

/* req_problem_type enum (RPT_*) from common/fc_types.h */
var RPT_POSSIBLE = 0;
var RPT_CERTAIN = 1;

/* unit_activity from common/fc_types.h */
var ACTIVITY_IDLE = 0;
var ACTIVITY_POLLUTION = 1;
var ACTIVITY_MINE = 2;
var ACTIVITY_IRRIGATE = 3;
var ACTIVITY_FORTIFIED = 4;
var ACTIVITY_SENTRY = 5;
var ACTIVITY_PILLAGE = 6;
var ACTIVITY_GOTO = 7;
var ACTIVITY_EXPLORE = 8;
var ACTIVITY_TRANSFORM = 9;
var ACTIVITY_FORTIFYING = 10;
var ACTIVITY_FALLOUT = 11;
var ACTIVITY_BASE = 12;
var ACTIVITY_GEN_ROAD = 13;
var ACTIVITY_CONVERT = 14;
var ACTIVITY_CULTIVATE = 15;
var ACTIVITY_PLANT = 16;
var ACTIVITY_CLEAN = 17;
var ACTIVITY_LAST = 18;

/* action_result from common/fc_types.h */
var ACTRES_ESTABLISH_EMBASSY = 0;
var ACTRES_SPY_INVESTIGATE_CITY = 1;
var ACTRES_SPY_POISON = 2;
var ACTRES_SPY_STEAL_GOLD = 3;
var ACTRES_SPY_SABOTAGE_CITY = 4;
var ACTRES_SPY_TARGETED_SABOTAGE_CITY = 5;
var ACTRES_SPY_SABOTAGE_CITY_PRODUCTION = 6;
var ACTRES_SPY_STEAL_TECH = 7;
var ACTRES_SPY_TARGETED_STEAL_TECH = 8;
var ACTRES_SPY_INCITE_CITY = 9;
var ACTRES_TRADE_ROUTE = 10;
var ACTRES_MARKETPLACE = 11;
var ACTRES_HELP_WONDER = 12;
var ACTRES_SPY_BRIBE_UNIT = 13;
var ACTRES_SPY_SABOTAGE_UNIT = 14;
var ACTRES_CAPTURE_UNITS = 15;
var ACTRES_FOUND_CITY = 16;
var ACTRES_JOIN_CITY = 17;
var ACTRES_STEAL_MAPS = 18;
var ACTRES_BOMBARD = 19;
var ACTRES_SPY_NUKE = 20;
var ACTRES_NUKE = 21;
var ACTRES_NUKE_UNITS = 22;
var ACTRES_DESTROY_CITY = 23;
var ACTRES_EXPEL_UNIT = 24;
var ACTRES_DISBAND_UNIT_RECOVER = 25;
var ACTRES_DISBAND_UNIT = 26;
var ACTRES_HOME_CITY = 27;
var ACTRES_UPGRADE_UNIT = 28;
var ACTRES_PARADROP = 29;
var ACTRES_AIRLIFT = 30;
var ACTRES_ATTACK = 31;
var ACTRES_STRIKE_BUILDING = 32;
var ACTRES_STRIKE_PRODUCTION = 33;
var ACTRES_CONQUER_CITY = 34;
var ACTRES_HEAL_UNIT = 35;
var ACTRES_TRANSFORM_TERRAIN = 36;
var ACTRES_CULTIVATE = 37;
var ACTRES_PLANT = 38;
var ACTRES_PILLAGE = 39;
var ACTRES_FORTIFY = 40;
var ACTRES_ROAD = 41;
var ACTRES_CONVERT = 42;
var ACTRES_BASE = 43;
var ACTRES_MINE = 44;
var ACTRES_IRRIGATE = 45;
var ACTRES_CLEAN_POLLUTION = 46;
var ACTRES_CLEAN_FALLOUT = 47;
var ACTRES_TRANSPORT_DEBOARD = 48;
var ACTRES_TRANSPORT_UNLOAD = 49;
var ACTRES_TRANSPORT_DISEMBARK = 50;
var ACTRES_TRANSPORT_BOARD = 51;
var ACTRES_TRANSPORT_EMBARK = 52;
var ACTRES_SPY_SPREAD_PLAGUE = 53;
var ACTRES_SPY_ATTACK = 54;
var ACTRES_CONQUER_EXTRAS = 55;
var ACTRES_HUT_ENTER = 56;
var ACTRES_HUT_FRIGHTEN = 57;
var ACTRES_UNIT_MOVE = 58;
var ACTRES_PARADROP_CONQUER = 59;
var ACTRES_HOMELESS = 60;
var ACTRES_WIPE_UNITS = 61;
var ACTRES_SPY_ESCAPE = 62;
var ACTRES_TRANSPORT_LOAD = 63;
var ACTRES_CLEAN = 64;
var ACTRES_TELEPORT = 65;
var ACTRES_ENABLER_CHECK = 66;
var ACTRES_LAST = 67;

/* action_sub_result from common/fc_types.h */
var ACT_SUB_RES_HUT_ENTER = 0;
var ACT_SUB_RES_HUT_FRIGHTEN = 1;
var ACT_SUB_RES_MAY_EMBARK = 2;
var ACT_SUB_RES_NON_LETHAL = 3;
var ACT_SUB_RES_COUNT = 4;

/* action_decision from common/fc_types.h */
var ACT_DEC_NOTHING = 0;
var ACT_DEC_PASSIVE = 1;
var ACT_DEC_ACTIVE = 2;
var ACT_DEC_COUNT = 3;

/* vision_layer from common/fc_types.h */
var V_MAIN = 0;
var V_INVIS = 1;
var V_SUBSURFACE = 2;
var V_COUNT = 3;

/* extra_cause from common/fc_types.h */
var EC_IRRIGATION = 0;
var EC_MINE = 1;
var EC_ROAD = 2;
var EC_BASE = 3;
var EC_POLLUTION = 4;
var EC_FALLOUT = 5;
var EC_HUT = 6;
var EC_APPEARANCE = 7;
var EC_RESOURCE = 8;
var EC_COUNT = 9;

/* extra_rmcause from common/fc_types.h */
var ERM_PILLAGE = 0;
var ERM_CLEAN = 1;
var ERM_CLEANFALLOUT = 2;
var ERM_DISAPPEARANCE = 3;
var ERM_ENTER = 4;
var ERM_CLEANPOLLUTION = 5;
var ERM_COUNT = 6;

/* barbarian_type from common/fc_types.h */
var NOT_A_BARBARIAN = 0;
var LAND_BARBARIAN = 1;
var SEA_BARBARIAN = 2;
var ANIMAL_BARBARIAN = 3;
var LAND_AND_SEA_BARBARIAN = 4;

/* capital_type from common/fc_types.h */
var CAPITAL_NOT = 0;
var CAPITAL_SECONDARY = 1;
var CAPITAL_PRIMARY = 2;

/* universals_n from common/fc_types.h */
var VUT_NONE = 0;
var VUT_ADVANCE = 1;
var VUT_GOVERNMENT = 2;
var VUT_IMPROVEMENT = 3;
var VUT_TERRAIN = 4;
var VUT_NATION = 5;
var VUT_UTYPE = 6;
var VUT_UTFLAG = 7;
var VUT_UCLASS = 8;
var VUT_UCFLAG = 9;
var VUT_OTYPE = 10;
var VUT_SPECIALIST = 11;
var VUT_MINSIZE = 12;
var VUT_AI_LEVEL = 13;
var VUT_TERRAINCLASS = 14;
var VUT_MINYEAR = 15;
var VUT_TERRAINALTER = 16;
var VUT_CITYTILE = 17;
var VUT_GOOD = 18;
var VUT_TERRFLAG = 19;
var VUT_NATIONALITY = 20;
var VUT_ROADFLAG = 21;
var VUT_EXTRA = 22;
var VUT_TECHFLAG = 23;
var VUT_ACHIEVEMENT = 24;
var VUT_DIPLREL = 25;
var VUT_MAXTILEUNITS = 26;
var VUT_STYLE = 27;
var VUT_MINCULTURE = 28;
var VUT_UNITSTATE = 29;
var VUT_MINMOVES = 30;
var VUT_MINVETERAN = 31;
var VUT_MINHP = 32;
var VUT_AGE = 33;
var VUT_NATIONGROUP = 34;
var VUT_TOPO = 35;
var VUT_IMPR_GENUS = 36;
var VUT_ACTION = 37;
var VUT_MINTECHS = 38;
var VUT_EXTRAFLAG = 39;
var VUT_MINCALFRAG = 40;
var VUT_SERVERSETTING = 41;
var VUT_CITYSTATUS = 42;
var VUT_MINFOREIGNPCT = 43;
var VUT_ACTIVITY = 44;
var VUT_DIPLREL_TILE = 45;
var VUT_DIPLREL_TILE_O = 46;
var VUT_DIPLREL_UNITANY = 47;
var VUT_DIPLREL_UNITANY_O = 48;
var VUT_MINLATITUDE = 49;
var VUT_MAXLATITUDE = 50;
var VUT_COUNTER = 51;
var VUT_ORIGINAL_OWNER = 52;
var VUT_IMPR_FLAG = 53;
var VUT_WRAP = 54;
var VUT_COUNT = 55;

/* achievement_type from common/fc_types.h */
var ACHIEVEMENT_SPACESHIP = 0;
var ACHIEVEMENT_MAP = 1;
var ACHIEVEMENT_MULTICULTURAL = 2;
var ACHIEVEMENT_CULTURED_CITY = 3;
var ACHIEVEMENT_CULTURED_NATION = 4;
var ACHIEVEMENT_LUCKY = 5;
var ACHIEVEMENT_HUTS = 6;
var ACHIEVEMENT_METROPOLIS = 7;
var ACHIEVEMENT_LITERATE = 8;
var ACHIEVEMENT_LAND_AHOY = 9;
var ACHIEVEMENT_KILLER = 10;
var ACHIEVEMENT_COUNT = 11;

/* ai_level from common/fc_types.h */
var AI_LEVEL_RESTRICTED = 0;
var AI_LEVEL_NOVICE = 1;
var AI_LEVEL_EASY = 2;
var AI_LEVEL_NORMAL = 3;
var AI_LEVEL_HARD = 4;
var AI_LEVEL_CHEATING = 5;
var AI_LEVEL_AWAY = 6;
var AI_LEVEL_AWAY = 7;
var AI_LEVEL_COUNT = 8;

/* airlifting_style from common/fc_types.h */
var AIRLIFTING_ALLIED_SRC = 0;
var AIRLIFTING_ALLIED_DEST = 1;
var AIRLIFTING_UNLIMITED_SRC = 2;
var AIRLIFTING_UNLIMITED_DEST = 3;

/* caravan_bonus_style from common/fc_types.h */
var CBS_CLASSIC = 0;
var CBS_LOGARITHMIC = 1;

/* casus_belli_range from common/fc_types.h */
var CBR_NONE = 0;
var CBR_VICTIM_ONLY = 1;
var CBR_INTERNATIONAL_OUTRAGE = 2;
var CBR_LAST = 3;

/* citystatus_type from common/fc_types.h */
var CITYS_OWNED_BY_ORIGINAL = 0;
var CITYS_STARVED = 1;
var CITYS_DISORDER = 2;
var CITYS_CELEBRATION = 3;
var CITYS_LAST = 4;

/* citytile_type from common/fc_types.h */
var CITYT_CENTER = 0;
var CITYT_CLAIMED = 1;
var CITYT_EXTRAS_OWNED = 2;
var CITYT_WORKED = 3;
var CITYT_SAME_CONTINENT = 4;
var CITYT_BORDERING_TCLASS_REGION = 5;
var CITYT_LAST = 6;

/* counter_behaviour from common/fc_types.h */
var CB_CITY_OWNED_TURNS = 1;
var CB_CITY_CELEBRATION_TURNS = 2;
var CB_CITY_DISORDER_TURNS = 3;
var COUNTER_BEHAVIOUR_LAST = 4;

/* direction8 from common/fc_types.h */
var DIR8_NORTHWEST = 0;
var DIR8_NORTH = 1;
var DIR8_NORTHEAST = 2;
var DIR8_WEST = 3;
var DIR8_EAST = 4;
var DIR8_SOUTHWEST = 5;
var DIR8_SOUTH = 6;
var DIR8_SOUTHEAST = 7;

/* extra_category from common/fc_types.h */
var ECAT_INFRA = 0;
var ECAT_NATURAL = 1;
var ECAT_NUISANCE = 2;
var ECAT_BONUS = 3;
var ECAT_RESOURCE = 4;
var ECAT_COUNT = 5;

/* extra_unit_seen_type from common/fc_types.h */
var EUS_NORMAL = 0;
var EUS_HIDDEN = 1;

/* free_tech_method from common/fc_types.h */
var FTM_GOAL = 0;
var FTM_RANDOM = 1;
var FTM_CHEAPEST = 2;

/* gameloss_style from common/fc_types.h */
var GAMELOSS_STYLE_BARB = 0;
var GAMELOSS_STYLE_CWAR = 1;
var GAMELOSS_STYLE_LOOT = 2;

/* gold_upkeep_style from common/fc_types.h */
var GOLD_UPKEEP_CITY = 0;
var GOLD_UPKEEP_MIXED = 1;
var GOLD_UPKEEP_NATION = 2;

/* goods_selection_method from common/fc_types.h */
var GSM_LEAVING = 0;
var GSM_ARRIVAL = 1;

/* gui_type from common/fc_types.h */
var GUI_STUB = 0;
var GUI_GTK2 = 1;
var GUI_GTK3 = 2;
var GUI_GTK3_22 = 3;
var GUI_SDL = 4;
var GUI_QT = 5;
var GUI_SDL2 = 6;
var GUI_WEB = 7;
var GUI_GTK4 = 8;

/* impr_flag_id from common/fc_types.h */
var IF_VISIBLE_BY_OTHERS = 0;
var IF_SAVE_SMALL_WONDER = 1;
var IF_GOLD = 2;
var IF_DISASTER_PROOF = 3;
var IF_USER_FLAG_1 = 4;
var IF_USER_FLAG_2 = 5;
var IF_USER_FLAG_3 = 6;
var IF_USER_FLAG_4 = 7;
var IF_USER_FLAG_5 = 8;
var IF_USER_FLAG_6 = 9;
var IF_USER_FLAG_7 = 10;
var IF_USER_FLAG_8 = 11;
var IF_COUNT = 12;

/* impr_genus_id from common/fc_types.h */
var IG_GREAT_WONDER = 0;
var IG_SMALL_WONDER = 1;
var IG_IMPROVEMENT = 2;
var IG_SPECIAL = 3;
var IG_CONVERT = 4;
var IG_COUNT = 5;

/* mood_type from common/fc_types.h */
var MOOD_PEACEFUL = 0;
var MOOD_COMBAT = 1;
var MOOD_COUNT = 2;

/* persistent_ready from common/fc_types.h */
var PERSISTENTR_DISABLED = 0;
var PERSISTENTR_CONNECTED = 1;

/* phase_mode_type from common/fc_types.h */
var PMT_CONCURRENT = 0;
var PMT_PLAYERS_ALTERNATE = 1;
var PMT_TEAMS_ALTERNATE = 2;

/* reveal_map from common/fc_types.h */
var REVEAL_MAP_START = 0;
var REVEAL_MAP_DEAD = 1;

/* setting_default_level from common/fc_types.h */
var SETDEF_INTERNAL = 0;
var SETDEF_RULESET = 1;
var SETDEF_CHANGED = 2;

/* sset_type from common/fc_types.h */
var SST_BOOL = 0;
var SST_INT = 1;
var SST_STRING = 2;
var SST_ENUM = 3;
var SST_BITWISE = 4;
var SST_COUNT = 5;

/* tech_cost_style from common/fc_types.h */
var TECH_COST_CIV1CIV2 = 0;
var TECH_COST_CLASSIC = 1;
var TECH_COST_CLASSIC_PRESET = 2;
var TECH_COST_EXPERIMENTAL = 3;
var TECH_COST_EXPERIMENTAL_PRESET = 4;
var TECH_COST_LINEAR = 5;

/* tech_leakage_style from common/fc_types.h */
var TECH_LEAKAGE_NONE = 0;
var TECH_LEAKAGE_EMBASSIES = 1;
var TECH_LEAKAGE_PLAYERS = 2;
var TECH_LEAKAGE_NO_BARBS = 3;

/* tech_upkeep_style from common/fc_types.h */
var TECH_UPKEEP_NONE = 0;
var TECH_UPKEEP_BASIC = 1;
var TECH_UPKEEP_PER_CITY = 2;

/* topo_flag from common/fc_types.h */
var TF_ISO = 0;
var TF_HEX = 1;
var TF_OLD_WRAPX = 2;
var TF_OLD_WRAPY = 3;

/* trade_revenue_style from common/fc_types.h */
var TRS_CLASSIC = 0;
var TRS_SIMPLE = 1;

/* transp_def_type from common/fc_types.h */
var TDT_ALIGHT = 0;
var TDT_BLOCKED = 1;

/* ustate_prop from common/fc_types.h */
var USP_TRANSPORTED = 0;
var USP_LIVABLE_TILE = 1;
var USP_TRANSPORTING = 2;
var USP_HAS_HOME_CITY = 3;
var USP_NATIVE_TILE = 4;
var USP_NATIVE_EXTRA = 5;
var USP_MOVED_THIS_TURN = 6;
var USP_COUNT = 7;

/* wonder_visib_type from common/fc_types.h */
var WV_ALWAYS = 0;
var WV_NEVER = 1;
var WV_EMBASSY = 2;

/* wrap_flag from common/fc_types.h */
var WRAP_X = 0;
var WRAP_Y = 1;

/* Actions (ACTION_*) from common/actions.h */
var ACTION_ESTABLISH_EMBASSY = 0;
var ACTION_ESTABLISH_EMBASSY_STAY = 1;
var ACTION_SPY_INVESTIGATE_CITY = 2;
var ACTION_INV_CITY_SPEND = 3;
var ACTION_SPY_POISON = 4;
var ACTION_SPY_POISON_ESC = 5;
var ACTION_SPY_STEAL_GOLD = 6;
var ACTION_SPY_STEAL_GOLD_ESC = 7;
var ACTION_SPY_SABOTAGE_CITY = 8;
var ACTION_SPY_SABOTAGE_CITY_ESC = 9;
var ACTION_SPY_TARGETED_SABOTAGE_CITY = 10;
var ACTION_SPY_TARGETED_SABOTAGE_CITY_ESC = 11;
var ACTION_SPY_SABOTAGE_CITY_PRODUCTION = 12;
var ACTION_SPY_SABOTAGE_CITY_PRODUCTION_ESC = 13;
var ACTION_SPY_STEAL_TECH = 14;
var ACTION_SPY_STEAL_TECH_ESC = 15;
var ACTION_SPY_TARGETED_STEAL_TECH = 16;
var ACTION_SPY_TARGETED_STEAL_TECH_ESC = 17;
var ACTION_SPY_INCITE_CITY = 18;
var ACTION_SPY_INCITE_CITY_ESC = 19;
var ACTION_TRADE_ROUTE = 20;
var ACTION_MARKETPLACE = 21;
var ACTION_HELP_WONDER = 22;
var ACTION_SPY_BRIBE_UNIT = 23;
var ACTION_CAPTURE_UNITS = 24;
var ACTION_SPY_SABOTAGE_UNIT = 25;
var ACTION_SPY_SABOTAGE_UNIT_ESC = 26;
var ACTION_FOUND_CITY = 27;
var ACTION_JOIN_CITY = 28;
var ACTION_STEAL_MAPS = 29;
var ACTION_STEAL_MAPS_ESC = 30;
var ACTION_SPY_NUKE = 31;
var ACTION_SPY_NUKE_ESC = 32;
var ACTION_NUKE = 33;
var ACTION_NUKE_CITY = 34;
var ACTION_NUKE_UNITS = 35;
var ACTION_DESTROY_CITY = 36;
var ACTION_EXPEL_UNIT = 37;
var ACTION_DISBAND_UNIT_RECOVER = 38;
var ACTION_DISBAND_UNIT = 39;
var ACTION_HOME_CITY = 40;
var ACTION_HOMELESS = 41;
var ACTION_UPGRADE_UNIT = 42;
var ACTION_CONVERT = 43;
var ACTION_AIRLIFT = 44;
var ACTION_ATTACK = 45;
var ACTION_SUICIDE_ATTACK = 46;
var ACTION_STRIKE_BUILDING = 47;
var ACTION_STRIKE_PRODUCTION = 48;
var ACTION_CONQUER_CITY = 49;
var ACTION_CONQUER_CITY2 = 50;
var ACTION_CONQUER_CITY3 = 51;
var ACTION_CONQUER_CITY4 = 52;
var ACTION_BOMBARD = 53;
var ACTION_BOMBARD2 = 54;
var ACTION_BOMBARD3 = 55;
var ACTION_BOMBARD_LETHAL = 56;
var ACTION_FORTIFY = 57;
var ACTION_CULTIVATE = 58;
var ACTION_PLANT = 59;
var ACTION_TRANSFORM_TERRAIN = 60;
var ACTION_ROAD = 61;
var ACTION_IRRIGATE = 62;
var ACTION_MINE = 63;
var ACTION_BASE = 64;
var ACTION_PILLAGE = 65;
var ACTION_CLEAN_POLLUTION = 66;
var ACTION_CLEAN_FALLOUT = 67;
var ACTION_TRANSPORT_BOARD = 68;
var ACTION_TRANSPORT_BOARD2 = 69;
var ACTION_TRANSPORT_BOARD3 = 70;
var ACTION_TRANSPORT_DEBOARD = 71;
var ACTION_TRANSPORT_EMBARK = 72;
var ACTION_TRANSPORT_EMBARK2 = 73;
var ACTION_TRANSPORT_EMBARK3 = 74;
var ACTION_TRANSPORT_EMBARK4 = 75;
var ACTION_TRANSPORT_DISEMBARK1 = 76;
var ACTION_TRANSPORT_DISEMBARK2 = 77;
var ACTION_TRANSPORT_DISEMBARK3 = 78;
var ACTION_TRANSPORT_DISEMBARK4 = 79;
var ACTION_TRANSPORT_LOAD = 80;
var ACTION_TRANSPORT_LOAD2 = 81;
var ACTION_TRANSPORT_LOAD3 = 82;
var ACTION_TRANSPORT_UNLOAD = 83;
var ACTION_SPY_SPREAD_PLAGUE = 84;
var ACTION_SPY_ATTACK = 85;
var ACTION_CONQUER_EXTRAS = 86;
var ACTION_CONQUER_EXTRAS2 = 87;
var ACTION_CONQUER_EXTRAS3 = 88;
var ACTION_CONQUER_EXTRAS4 = 89;
var ACTION_HUT_ENTER = 90;
var ACTION_HUT_ENTER2 = 91;
var ACTION_HUT_ENTER3 = 92;
var ACTION_HUT_ENTER4 = 93;
var ACTION_HUT_FRIGHTEN = 94;
var ACTION_HUT_FRIGHTEN2 = 95;
var ACTION_HUT_FRIGHTEN3 = 96;
var ACTION_HUT_FRIGHTEN4 = 97;
var ACTION_HEAL_UNIT = 98;
var ACTION_HEAL_UNIT2 = 99;
var ACTION_PARADROP = 100;
var ACTION_PARADROP_CONQUER = 101;
var ACTION_PARADROP_FRIGHTEN = 102;
var ACTION_PARADROP_FRIGHTEN_CONQUER = 103;
var ACTION_PARADROP_ENTER = 104;
var ACTION_PARADROP_ENTER_CONQUER = 105;
var ACTION_WIPE_UNITS = 106;
var ACTION_SPY_ESCAPE = 107;
var ACTION_UNIT_MOVE = 108;
var ACTION_UNIT_MOVE2 = 109;
var ACTION_UNIT_MOVE3 = 110;
var ACTION_CLEAN = 111;
var ACTION_TELEPORT = 112;
var ACTION_USER_ACTION1 = 113;
var ACTION_USER_ACTION2 = 114;
var ACTION_USER_ACTION3 = 115;
var ACTION_USER_ACTION4 = 116;
var ACTION_COUNT = 117;

/* Backward compatibility aliases */
var ACTION_RECYCLE_UNIT = ACTION_DISBAND_UNIT_RECOVER; // TODO: Update code to use ACTION_DISBAND_UNIT_RECOVER

/* action_target_kind from common/actres.h */
var ATK_CITY = 0;
var ATK_UNIT = 1;
var ATK_UNITS = 2;
var ATK_TILE = 3;
var ATK_EXTRAS = 4;
var ATK_SELF = 5;
var ATK_COUNT = 6;

/* action_sub_target_kind from common/actres.h */
var ASTK_NONE = 0;
var ASTK_BUILDING = 1;
var ASTK_TECH = 2;
var ASTK_EXTRA = 3;
var ASTK_EXTRA_NOT_THERE = 4;
var ASTK_COUNT = 5;

/* req_range from common/requirements.h */
var REQ_RANGE_LOCAL = 0;
var REQ_RANGE_TILE = 1;
var REQ_RANGE_CADJACENT = 2;
var REQ_RANGE_ADJACENT = 3;
var REQ_RANGE_CITY = 4;
var REQ_RANGE_TRADEROUTE = 5;
var REQ_RANGE_CONTINENT = 6;
var REQ_RANGE_PLAYER = 7;
var REQ_RANGE_TEAM = 8;
var REQ_RANGE_ALLIANCE = 9;
var REQ_RANGE_WORLD = 10;
var REQ_RANGE_COUNT = 11;

/* Derived constants for compatibility */
var B_LAST = MAX_NUM_BUILDINGS;
var A_LAST = (MAX_NUM_ADVANCES + 1);
var U_LAST = MAX_NUM_UNITS;

/* JavaScript-specific boolean constants */
var TRUE = true;
var FALSE = false;
