/****************************************
 * THIS IS A GENERATED FILE, DO NOT EDIT
 *
 * From common/events.{h,c}
 * By gen_event_types.py
 ****************************************/

var E_S_ADVANCE = 0;
var E_S_BUILD = 1;
var E_S_CITY = 2;
var E_S_D_ME = 3;
var E_S_D_THEM = 4;
var E_S_GLOBAL = 5;
var E_S_HUT = 6;
var E_S_NATION = 7;
var E_S_TREATY = 8;
var E_S_UNIT = 9;
var E_S_VOTE = 10;
var E_S_WONDER = 11;
var E_S_XYZZY = 12;
var E_S_CHAT = 13;

var fc_e_section_names = [
  'e_s_advance',
  'e_s_build',
  'e_s_city',
  'e_s_d_me',
  'e_s_d_them',
  'e_s_global',
  'e_s_hut',
  'e_s_nation',
  'e_s_treaty',
  'e_s_unit',
  'e_s_vote',
  'e_s_wonder',
  'e_s_xyzzy',
  'e_s_chat'
];

var fc_e_section_descriptions = [
  "Technology",
  "Improvement",
  "City",
  "Diplomat Action",
  "Enemy Diplomat",
  "Global",
  "Hut",
  "Nation",
  "Treaty",
  "Unit",
  "Vote",
  "Wonder",
  "Misc",
  "Chat"
];

var E_CITY_CANTBUILD = 0;
var E_CITY_LOST = 1;
var E_CITY_LOVE = 2;
var E_CITY_DISORDER = 3;
var E_CITY_FAMINE = 4;
var E_CITY_FAMINE_FEARED = 5;
var E_CITY_GROWTH = 6;
var E_CITY_MAY_SOON_GROW = 7;
var E_CITY_AQUEDUCT = 8;
var E_CITY_AQ_BUILDING = 9;
var E_CITY_NORMAL = 10;
var E_CITY_NUKED = 11;
var E_CITY_CMA_RELEASE = 12;
var E_CITY_GRAN_THROTTLE = 13;
var E_CITY_TRANSFER = 14;
var E_CITY_BUILD = 15;
var E_CITY_PRODUCTION_CHANGED = 16;
var E_WORKLIST = 17;
var E_UPRISING = 18;
var E_CIVIL_WAR = 19;
var E_ANARCHY = 20;
var E_FIRST_CONTACT = 21;
var E_NEW_GOVERNMENT = 22;
var E_LOW_ON_FUNDS = 23;
var E_POLLUTION = 24;
var E_REVOLT_DONE = 25;
var E_REVOLT_START = 26;
var E_SPACESHIP = 27;
var E_MY_DIPLOMAT_BRIBE = 28;
var E_DIPLOMATIC_INCIDENT = 29;
var E_MY_DIPLOMAT_ESCAPE = 30;
var E_MY_DIPLOMAT_EMBASSY = 31;
var E_MY_DIPLOMAT_FAILED = 32;
var E_MY_DIPLOMAT_INCITE = 33;
var E_MY_DIPLOMAT_POISON = 34;
var E_MY_DIPLOMAT_SABOTAGE = 35;
var E_MY_DIPLOMAT_THEFT = 36;
var E_ENEMY_DIPLOMAT_BRIBE = 37;
var E_ENEMY_DIPLOMAT_EMBASSY = 38;
var E_ENEMY_DIPLOMAT_FAILED = 39;
var E_ENEMY_DIPLOMAT_INCITE = 40;
var E_ENEMY_DIPLOMAT_POISON = 41;
var E_ENEMY_DIPLOMAT_SABOTAGE = 42;
var E_ENEMY_DIPLOMAT_THEFT = 43;
var E_CARAVAN_ACTION = 44;
var E_SCRIPT = 45;
var E_BROADCAST_REPORT = 46;
var E_GAME_END = 47;
var E_GAME_START = 48;
var E_NATION_SELECTED = 49;
var E_DESTROYED = 50;
var E_REPORT = 51;
var E_TURN_BELL = 52;
var E_NEXT_YEAR = 53;
var E_GLOBAL_ECO = 54;
var E_NUKE = 55;
var E_HUT_BARB = 56;
var E_HUT_CITY = 57;
var E_HUT_GOLD = 58;
var E_HUT_BARB_KILLED = 59;
var E_HUT_MERC = 60;
var E_HUT_SETTLER = 61;
var E_HUT_TECH = 62;
var E_HUT_BARB_CITY_NEAR = 63;
var E_IMP_BUY = 64;
var E_IMP_BUILD = 65;
var E_IMP_AUCTIONED = 66;
var E_IMP_AUTO = 67;
var E_IMP_SOLD = 68;
var E_TECH_GAIN = 69;
var E_TECH_LEARNED = 70;
var E_TREATY_ALLIANCE = 71;
var E_TREATY_BROKEN = 72;
var E_TREATY_CEASEFIRE = 73;
var E_TREATY_PEACE = 74;
var E_TREATY_SHARED_VISION = 75;
var E_UNIT_LOST_ATT = 76;
var E_UNIT_WIN_ATT = 77;
var E_UNIT_BUY = 78;
var E_UNIT_BUILT = 79;
var E_UNIT_LOST_DEF = 80;
var E_UNIT_WIN_DEF = 81;
var E_UNIT_BECAME_VET = 82;
var E_UNIT_UPGRADED = 83;
var E_UNIT_RELOCATED = 84;
var E_UNIT_ORDERS = 85;
var E_WONDER_BUILD = 86;
var E_WONDER_OBSOLETE = 87;
var E_WONDER_STARTED = 88;
var E_WONDER_STOPPED = 89;
var E_WONDER_WILL_BE_BUILT = 90;
var E_DIPLOMACY = 91;
var E_TREATY_EMBASSY = 92;
var E_BAD_COMMAND = 93;
var E_SETTING = 94;
var E_CHAT_MSG = 95;
var E_MESSAGE_WALL = 96;
var E_CHAT_ERROR = 97;
var E_CONNECTION = 98;
var E_AI_DEBUG = 99;
var E_LOG_ERROR = 100;
var E_LOG_FATAL = 101;
var E_TECH_GOAL = 102;
var E_UNIT_LOST_MISC = 103;
var E_CITY_PLAGUE = 104;
var E_VOTE_NEW = 105;
var E_VOTE_RESOLVED = 106;
var E_VOTE_ABORTED = 107;
var E_CITY_RADIUS_SQ = 108;
var E_UNIT_BUILT_POP_COST = 109;
var E_DISASTER = 110;
var E_ACHIEVEMENT = 111;
var E_TECH_LOST = 112;
var E_TECH_EMBASSY = 113;
var E_MY_SPY_STEAL_GOLD = 114;
var E_ENEMY_SPY_STEAL_GOLD = 115;
var E_SPONTANEOUS_EXTRA = 116;
var E_UNIT_ILLEGAL_ACTION = 117;
var E_MY_SPY_STEAL_MAP = 118;
var E_ENEMY_SPY_STEAL_MAP = 119;
var E_MY_SPY_NUKE = 120;
var E_ENEMY_SPY_NUKE = 121;
var E_UNIT_WAS_EXPELLED = 122;
var E_UNIT_DID_EXPEL = 123;
var E_UNIT_ACTION_FAILED = 124;
var E_UNIT_ESCAPED = 125;
var E_DEPRECATION_WARNING = 126;
var E_BEGINNER_HELP = 127;
var E_MY_UNIT_DID_HEAL = 128;
var E_MY_UNIT_WAS_HEALED = 129;
var E_MULTIPLIER = 130;
var E_UNIT_ACTION_ACTOR_SUCCESS = 131;
var E_UNIT_ACTION_ACTOR_FAILURE = 132;
var E_UNIT_ACTION_TARGET_OTHER = 133;
var E_UNIT_ACTION_TARGET_HOSTILE = 134;
var E_INFRAPOINTS = 135;
var E_HUT_MAP = 136;
var E_TREATY_SHARED_TILES = 137;
var E_CHAT_PRIVATE = 138;
var E_CHAT_ALLIES = 139;
var E_CHAT_OBSERVER = 140;
var E_UNDEFINED = 141;

var fc_e_events = [
  ["e_city_cantbuild", E_S_CITY, "Building Unavailable Item"],
  ["e_city_lost", E_S_CITY, "Captured/Destroyed"],
  ["e_city_love", E_S_CITY, "Celebrating"],
  ["e_city_disorder", E_S_CITY, "Civil Disorder"],
  ["e_city_famine", E_S_CITY, "Famine"],
  ["e_city_famine_feared", E_S_CITY, "Famine Feared"],
  ["e_city_growth", E_S_CITY, "Growth"],
  ["e_city_may_soon_grow", E_S_CITY, "May Soon Grow"],
  ["e_city_aqueduct", E_S_CITY, "Needs Aqueduct"],
  ["e_city_aq_building", E_S_CITY, "Needs Aqueduct Being Built"],
  ["e_city_normal", E_S_CITY, "Normal"],
  ["e_city_nuked", E_S_CITY, "Nuked"],
  ["e_city_cma_release", E_S_CITY, "Released from citizen governor"],
  ["e_city_gran_throttle", E_S_CITY, "Suggest Growth Throttling"],
  ["e_city_transfer", E_S_CITY, "Transfer"],
  ["e_city_build", E_S_CITY, "Was Built"],
  ["e_city_production_changed", E_S_CITY, "Production changed"],
  ["e_worklist", E_S_CITY, "Worklist Events"],
  ["e_uprising", E_S_NATION, "Barbarian Uprising"],
  ["e_civil_war", E_S_NATION, "Civil War"],
  ["e_anarchy", E_S_NATION, "Collapse to Anarchy"],
  ["e_first_contact", E_S_NATION, "First Contact"],
  ["e_new_government", E_S_NATION, "Learned New Government"],
  ["e_low_on_funds", E_S_NATION, "Low Funds"],
  ["e_pollution", E_S_NATION, "Pollution"],
  ["e_revolt_done", E_S_NATION, "Revolution Ended"],
  ["e_revolt_start", E_S_NATION, "Revolution Started"],
  ["e_spaceship", E_S_NATION, "Spaceship Events"],
  ["e_my_diplomat_bribe", E_S_D_ME, "Bribe"],
  ["e_diplomatic_incident", E_S_D_ME, "Caused Incident"],
  ["e_my_diplomat_escape", E_S_D_ME, "Escape"],
  ["e_my_diplomat_embassy", E_S_D_ME, "Embassy"],
  ["e_my_diplomat_failed", E_S_D_ME, "Failed"],
  ["e_my_diplomat_incite", E_S_D_ME, "Incite"],
  ["e_my_diplomat_poison", E_S_D_ME, "Poison"],
  ["e_my_diplomat_sabotage", E_S_D_ME, "Sabotage"],
  ["e_my_diplomat_theft", E_S_D_ME, "Theft"],
  ["e_enemy_diplomat_bribe", E_S_D_THEM, "Bribe"],
  ["e_enemy_diplomat_embassy", E_S_D_THEM, "Embassy"],
  ["e_enemy_diplomat_failed", E_S_D_THEM, "Failed"],
  ["e_enemy_diplomat_incite", E_S_D_THEM, "Incite"],
  ["e_enemy_diplomat_poison", E_S_D_THEM, "Poison"],
  ["e_enemy_diplomat_sabotage", E_S_D_THEM, "Sabotage"],
  ["e_enemy_diplomat_theft", E_S_D_THEM, "Theft"],
  ["e_caravan_action", E_S_XYZZY, "Caravan actions"],
  ["e_script", E_S_XYZZY, "Scenario/ruleset script message"],
  ["e_broadcast_report", E_S_XYZZY, "Broadcast Report"],
  ["e_game_end", E_S_XYZZY, "Game Ended"],
  ["e_game_start", E_S_XYZZY, "Game Started"],
  ["e_nation_selected", E_S_XYZZY, "Nation Selected"],
  ["e_destroyed", E_S_XYZZY, "Player Destroyed"],
  ["e_report", E_S_XYZZY, "Report"],
  ["e_turn_bell", E_S_XYZZY, "Turn Bell"],
  ["e_next_year", E_S_XYZZY, "Year Advance"],
  ["e_global_eco", E_S_GLOBAL, "Eco-Disaster"],
  ["e_nuke", E_S_GLOBAL, "Nuke Detonated"],
  ["e_hut_barb", E_S_HUT, "Barbarians in a Hut Roused"],
  ["e_hut_city", E_S_HUT, "City Founded from Hut"],
  ["e_hut_gold", E_S_HUT, "Gold Found in Hut"],
  ["e_hut_barb_killed", E_S_HUT, "Killed by Barbarians in a Hut"],
  ["e_hut_merc", E_S_HUT, "Mercenaries Found in Hut"],
  ["e_hut_settler", E_S_HUT, "Settler Found in Hut"],
  ["e_hut_tech", E_S_HUT, "Tech Found in Hut"],
  ["e_hut_barb_city_near", E_S_HUT, "Unit Spared by Barbarians"],
  ["e_imp_buy", E_S_BUILD, "Bought"],
  ["e_imp_build", E_S_BUILD, "Built"],
  ["e_imp_auctioned", E_S_BUILD, "Forced to Sell"],
  ["e_imp_auto", E_S_BUILD, "New Improvement Selected"],
  ["e_imp_sold", E_S_BUILD, "Sold"],
  ["e_tech_gain", E_S_ADVANCE, "Acquired New Tech"],
  ["e_tech_learned", E_S_ADVANCE, "Learned New Tech"],
  ["e_treaty_alliance", E_S_TREATY, "Alliance"],
  ["e_treaty_broken", E_S_TREATY, "Broken"],
  ["e_treaty_ceasefire", E_S_TREATY, "Cease-fire"],
  ["e_treaty_peace", E_S_TREATY, "Peace"],
  ["e_treaty_shared_vision", E_S_TREATY, "Shared Vision"],
  ["e_unit_lost_att", E_S_UNIT, "Attack Failed"],
  ["e_unit_win_att", E_S_UNIT, "Attack Succeeded"],
  ["e_unit_buy", E_S_UNIT, "Bought"],
  ["e_unit_built", E_S_UNIT, "Built"],
  ["e_unit_lost_def", E_S_UNIT, "Defender Destroyed"],
  ["e_unit_win_def", E_S_UNIT, "Defender Survived"],
  ["e_unit_became_vet", E_S_UNIT, "Promoted to Veteran"],
  ["e_unit_upgraded", E_S_UNIT, "Production Upgraded"],
  ["e_unit_relocated", E_S_UNIT, "Relocated"],
  ["e_unit_orders", E_S_UNIT, "Orders / goto events"],
  ["e_wonder_build", E_S_WONDER, "Finished"],
  ["e_wonder_obsolete", E_S_WONDER, "Made Obsolete"],
  ["e_wonder_started", E_S_WONDER, "Started"],
  ["e_wonder_stopped", E_S_WONDER, "Stopped"],
  ["e_wonder_will_be_built", E_S_WONDER, "Will Finish Next Turn"],
  ["e_diplomacy", E_S_XYZZY, "Diplomatic Message"],
  ["e_treaty_embassy", E_S_TREATY, "Embassy"],
  ["e_bad_command", E_S_XYZZY, "Error message from bad command"],
  ["e_setting", E_S_XYZZY, "Server settings changed"],
  ["e_chat_msg", E_S_CHAT, "Chat messages"],
  ["e_message_wall", E_S_XYZZY, "Message from server operator"],
  ["e_chat_error", E_S_CHAT, "Chat error messages"],
  ["e_connection", E_S_XYZZY, "Connect/disconnect messages"],
  ["e_ai_debug", E_S_XYZZY, "AI Debug messages"],
  ["e_log_error", E_S_XYZZY, "Server Problems"],
  ["e_log_fatal", E_S_XYZZY, "Server Aborting"],
  ["e_tech_goal", E_S_ADVANCE, "Selected New Goal"],
  ["e_unit_lost_misc", E_S_UNIT, "Lost outside battle"],
  ["e_city_plague", E_S_CITY, "Has Plague"],
  ["e_vote_new", E_S_VOTE, "New vote"],
  ["e_vote_resolved", E_S_VOTE, "Vote resolved"],
  ["e_vote_aborted", E_S_VOTE, "Vote canceled"],
  ["e_city_radius_sq", E_S_CITY, "City Map changed"],
  ["e_unit_built_pop_cost", E_S_UNIT, "Built unit with population cost"],
  ["e_disaster", E_S_CITY, "Disaster"],
  ["e_achievement", E_S_NATION, "Achievements"],
  ["e_tech_lost", E_S_ADVANCE, "Lost a Tech"],
  ["e_tech_embassy", E_S_ADVANCE, "Other Player Gained/Lost a Tech"],
  ["e_my_spy_steal_gold", E_S_D_ME, "Gold Theft"],
  ["e_enemy_spy_steal_gold", E_S_D_THEM, "Gold Theft"],
  ["e_spontaneous_extra", E_S_XYZZY, "Extra Appears or Disappears"],
  ["e_unit_illegal_action", E_S_UNIT, "Unit Illegal Action"],
  ["e_my_spy_steal_map", E_S_D_ME, "Map Theft"],
  ["e_enemy_spy_steal_map", E_S_D_THEM, "Map Theft"],
  ["e_my_spy_nuke", E_S_D_ME, "Suitcase Nuke"],
  ["e_enemy_spy_nuke", E_S_D_THEM, "Suitcase Nuke"],
  ["e_unit_was_expelled", E_S_UNIT, "Was Expelled"],
  ["e_unit_did_expel", E_S_UNIT, "Did Expel"],
  ["e_unit_action_failed", E_S_UNIT, "Action failed"],
  ["e_unit_escaped", E_S_UNIT, "Unit escaped"],
  ["e_deprecation_warning", E_S_XYZZY, "Deprecated Modpack syntax warnings"],
  ["e_beginner_help", E_S_XYZZY, "Help for beginners"],
  ["e_my_unit_did_heal", E_S_UNIT, "Unit did heal"],
  ["e_my_unit_was_healed", E_S_UNIT, "Unit was healed"],
  ["e_multiplier", E_S_NATION, "Multiplier changed"],
  ["e_unit_action_actor_success", E_S_UNIT, "Your unit did"],
  ["e_unit_action_actor_failure", E_S_UNIT, "Your unit failed"],
  ["e_unit_action_target_other", E_S_UNIT, "Unit did"],
  ["e_unit_action_target_hostile", E_S_UNIT, "Unit did to you"],
  ["e_infrapoints", E_S_NATION, "Infrapoints"],
  ["e_hut_map", E_S_HUT, "Map found from a hut"],
  ["e_treaty_shared_tiles", E_S_TREATY, "Tiles shared"],
  ["e_chat_private", E_S_CHAT, "Private messages"],
  ["e_chat_allies", E_S_CHAT, "Allies messages"],
  ["e_chat_observer", E_S_CHAT, "Observers messages"],
  ["e_undefined", E_S_XYZZY, "Unknown event"]
];

var E_I_NAME = 0;
var E_I_SECTION = 1;
var E_I_DESCRIPTION = 2;

