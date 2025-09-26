/***********************************************************************
 Freeciv - Copyright (C) 2004 - The Freeciv Project
   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; either version 2, or (at your option)
   any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.
***********************************************************************/

#ifndef FC__FC_TYPES_H
#define FC__FC_TYPES_H

#ifdef __cplusplus
extern "C" {
#endif /* __cplusplus */

/* utility */
#include "bitvector.h"
#include "shared.h"

/* This file serves to reduce the cross-inclusion of header files which
 * occurs when a type which is defined in one file is needed for a function
 * definition in another file.
 *
 * Nothing in this file should require anything else from the common/
 * directory! */

#define MAX_NUM_PLAYER_SLOTS 512 /* Used in the network protocol. */
                                 /* Must be divisable by 32 or iterations
                                  * in savegame2.c needs to be changed */
#define MAX_NUM_BARBARIANS   12  /* 3, but slots reserved for future use. */
#define MAX_NUM_PLAYERS      MAX_NUM_PLAYER_SLOTS - MAX_NUM_BARBARIANS
/* Used in the network protocol. */
#define MAX_NUM_CONNECTIONS (2 * (MAX_NUM_PLAYER_SLOTS))
/* e.g. unit_types. Used in the network protocol. */
#define MAX_NUM_ITEMS   200
#define MAX_NUM_ADVANCES  250 /* Used in the network protocol. */
#define MAX_NUM_UNITS     250 /* Used in the network protocol. */
#define MAX_NUM_BUILDINGS 200 /* Used in the network protocol. */
#define MAX_NUM_TECH_LIST 10 /* Used in the network protocol. */
#define MAX_NUM_UNIT_LIST 10 /* Used in the network protocol. */
#define MAX_NUM_BUILDING_LIST 10 /* Used in the network protocol. */
#define MAX_LEN_VET_SHORT_NAME 8
/* Used in the network protocol. See diplomat_success_vs_defender() */
#define MAX_VET_LEVELS 20
#define MAX_EXTRA_TYPES 128 /* Used in the network protocol. */
#define MAX_BASE_TYPES MAX_EXTRA_TYPES /* Used in the network protocol. */
#define MAX_ROAD_TYPES MAX_EXTRA_TYPES /* Used in the network protocol. */
#define MAX_GOODS_TYPES 25
#define MAX_DISASTER_TYPES 10
#define MAX_ACHIEVEMENT_TYPES 40
#define MAX_NUM_ACTION_AUTO_PERFORMERS 9
#define MAX_NUM_MULTIPLIERS 15
#define MAX_NUM_LEADERS MAX_NUM_ITEMS /* Used in the network protocol. */
#define MAX_NUM_NATION_SETS 32 /* Used in the network protocol.
                                * RULESET_NATION_SETS packet may become too big
                                * if increased */
#define MAX_NUM_NATION_GROUPS 128 /* Used in the network protocol. */
/* Used in the network protocol -- nation count is a UINT16 */
#define MAX_NUM_NATIONS MAX_UINT16
#define MAX_NUM_STARTPOS_NATIONS 1024 /* Used in the network protocol. */
#define MAX_CALENDAR_FRAGMENTS 52     /* Used in the network protocol. */
#define MAX_NUM_TECH_CLASSES   16     /* Used in the network protocol. */

/* Changing these will probably break network compatibility. */
#define MAX_LEN_NAME        48
#define MAX_LEN_CITYNAME   120
#define MAX_LEN_MAP_LABEL   64
#define MAX_LEN_DEMOGRAPHY  16
#define MAX_LEN_ALLOW_TAKE  16
#define MAX_LEN_GAME_IDENTIFIER 33
#define MAX_GRANARY_INIS    24
#define MAX_LEN_STARTUNIT (20+1)
#define MAX_LEN_ENUM        64

/* Line breaks after this number of characters; be careful and use only 70 */
#define LINE_BREAK 70

/* Changing the max radius requires updating network capabilities and results
 * in incompatible savefiles. */
#define CITY_MAP_MIN_RADIUS       0
#define CITY_MAP_DEFAULT_RADIUS   2
#define CITY_MAP_MAX_RADIUS       5

/* Below size of city tiles array is big enough for radius 5 city */
FC_STATIC_ASSERT(CITY_MAP_MAX_RADIUS <= 5, too_many_city_tiles);
#define MAX_CITY_TILES (91)

#define MAX_CITY_NATIONALITIES (MIN(MAX_NUM_PLAYER_SLOTS, MAX_CITY_SIZE))

/* symbol to flag missing numbers for better debugging */
#define IDENTITY_NUMBER_ZERO (0)

enum override_bool { OVERRIDE_TRUE, OVERRIDE_FALSE, NO_OVERRIDE };

/* A bitvector for all player slots. Used in the network protocol. */
BV_DEFINE(bv_player, MAX_NUM_PLAYER_SLOTS);

/* Changing this breaks network compatibility. */
enum output_type_id {
  O_FOOD, O_SHIELD, O_TRADE, O_GOLD, O_LUXURY, O_SCIENCE, O_LAST
};

/* Counters related definitions. See common/counters.h */
/* Used in the network protocol. */
#define MAX_COUNTERS 20

/* Counters related types. See common/counters.h */
/* Used in the network protocol. */
#define SPECENUM_NAME counter_behaviour
#define SPECENUM_VALUE1 CB_CITY_OWNED_TURNS
#define SPECENUM_VALUE1NAME "Owned"
#define SPECENUM_VALUE2 CB_CITY_CELEBRATION_TURNS
#define SPECENUM_VALUE2NAME "Celebration"
#define SPECENUM_VALUE3 CB_CITY_DISORDER_TURNS
#define SPECENUM_VALUE3NAME "Disorder"

#define SPECENUM_COUNT COUNTER_BEHAVIOUR_LAST
#include "specenum_gen.h"

/* Used in the network protocol. */
enum counter_target { CTGT_CITY };

/* Changing this enum will break savegame and network compatibility. */
/* When changing this, also update the list of valid requirement "Activity"
 * values in doc/README.effects and the list of invalid requirement
 * "Activity" values in activity_is_valid_in_requirement(). */
#define SPECENUM_NAME unit_activity
/* Not performing any activity right now */
#define SPECENUM_VALUE0 ACTIVITY_IDLE
#define SPECENUM_VALUE0NAME N_("Idle")
/* Action with the result ACTRES_CLEAN_POLLUTION */
#define SPECENUM_VALUE1 ACTIVITY_POLLUTION
#define SPECENUM_VALUE1NAME N_("Pollution")
/* Action with the result ACTRES_CULTIVATE */
#define SPECENUM_VALUE2 ACTIVITY_MINE
#define SPECENUM_VALUE2NAME N_("?act:Mine")
/* Action with the result ACTRES_IRRIGATE */
#define SPECENUM_VALUE3 ACTIVITY_IRRIGATE
#define SPECENUM_VALUE3NAME N_("Irrigate")
/* Has completed ACTIVITY_FORTIFYING */
#define SPECENUM_VALUE4 ACTIVITY_FORTIFIED
#define SPECENUM_VALUE4NAME N_("Fortified")
/* Server side client state (UI) */
#define SPECENUM_VALUE5 ACTIVITY_SENTRY
#define SPECENUM_VALUE5NAME "Sentry"
/* Action with the result ACTRES_PILLAGE */
#define SPECENUM_VALUE6 ACTIVITY_PILLAGE
#define SPECENUM_VALUE6NAME N_("Pillage")
/* AI compatibility. Is not orders' goto. */
#define SPECENUM_VALUE7 ACTIVITY_GOTO
#define SPECENUM_VALUE7NAME "Goto"
/* Server side agent */
#define SPECENUM_VALUE8 ACTIVITY_EXPLORE
#define SPECENUM_VALUE8NAME "Explore"
/* Action with the result ACTRES_TRANSFORM_TERRAIN */
#define SPECENUM_VALUE9 ACTIVITY_TRANSFORM
#define SPECENUM_VALUE9NAME N_("Transform")
/* Action with the result ACTRES_FORTIFY */
#define SPECENUM_VALUE10 ACTIVITY_FORTIFYING
#define SPECENUM_VALUE10NAME N_("Fortifying")
/* Action with the result ACTRES_CLEAN_FALLOUT */
#define SPECENUM_VALUE11 ACTIVITY_FALLOUT
#define SPECENUM_VALUE11NAME N_("Fallout")
/* Action with the result ACTRES_BASE */
#define SPECENUM_VALUE12 ACTIVITY_BASE
#define SPECENUM_VALUE12NAME N_("Base")
/* Action with the result ACTRES_ROAD */
#define SPECENUM_VALUE13 ACTIVITY_GEN_ROAD
#define SPECENUM_VALUE13NAME N_("Road")
/* Action with the result ACTRES_CONVERT */
#define SPECENUM_VALUE14 ACTIVITY_CONVERT
#define SPECENUM_VALUE14NAME N_("Convert")
/* Action with the result ACTRES_CULTIVATE */
#define SPECENUM_VALUE15 ACTIVITY_CULTIVATE
#define SPECENUM_VALUE15NAME N_("Cultivate")
/* Action with the result ACTRES_PLANT */
#define SPECENUM_VALUE16 ACTIVITY_PLANT
#define SPECENUM_VALUE16NAME N_("Plant")
/* Action with the result ACTRES_CLEAN */
#define SPECENUM_VALUE17 ACTIVITY_CLEAN
#define SPECENUM_VALUE17NAME N_("Clean")
/* Number of activities */
#define SPECENUM_COUNT ACTIVITY_LAST
#include "specenum_gen.h"

/* Values used in the network protocol. */
/* Update also properties table on actres.c when touching this. */
#define SPECENUM_NAME action_result
#define SPECENUM_VALUE0 ACTRES_ESTABLISH_EMBASSY
#define SPECENUM_VALUE0NAME "Unit Establish Embassy"
#define SPECENUM_VALUE1 ACTRES_SPY_INVESTIGATE_CITY
#define SPECENUM_VALUE1NAME "Unit Investigate City"
#define SPECENUM_VALUE2 ACTRES_SPY_POISON
#define SPECENUM_VALUE2NAME "Unit Poison City"
#define SPECENUM_VALUE3 ACTRES_SPY_STEAL_GOLD
#define SPECENUM_VALUE3NAME "Unit Steal Gold"
#define SPECENUM_VALUE4 ACTRES_SPY_SABOTAGE_CITY
#define SPECENUM_VALUE4NAME "Unit Sabotage City"
#define SPECENUM_VALUE5 ACTRES_SPY_TARGETED_SABOTAGE_CITY
#define SPECENUM_VALUE5NAME "Unit Targeted Sabotage City"
#define SPECENUM_VALUE6 ACTRES_SPY_SABOTAGE_CITY_PRODUCTION
#define SPECENUM_VALUE6NAME "Unit Sabotage City Production"
#define SPECENUM_VALUE7 ACTRES_SPY_STEAL_TECH
#define SPECENUM_VALUE7NAME "Unit Steal Tech"
#define SPECENUM_VALUE8 ACTRES_SPY_TARGETED_STEAL_TECH
#define SPECENUM_VALUE8NAME "Unit Targeted Steal Tech"
#define SPECENUM_VALUE9 ACTRES_SPY_INCITE_CITY
#define SPECENUM_VALUE9NAME "Unit Incite City"
#define SPECENUM_VALUE10 ACTRES_TRADE_ROUTE
#define SPECENUM_VALUE10NAME "Unit Establish Trade Route"
#define SPECENUM_VALUE11 ACTRES_MARKETPLACE
#define SPECENUM_VALUE11NAME "Unit Enter Marketplace"
#define SPECENUM_VALUE12 ACTRES_HELP_WONDER
#define SPECENUM_VALUE12NAME "Unit Help Wonder"
#define SPECENUM_VALUE13 ACTRES_SPY_BRIBE_UNIT
#define SPECENUM_VALUE13NAME "Unit Bribe Unit"
#define SPECENUM_VALUE14 ACTRES_SPY_SABOTAGE_UNIT
#define SPECENUM_VALUE14NAME "Unit Sabotage Unit"
#define SPECENUM_VALUE15 ACTRES_CAPTURE_UNITS
#define SPECENUM_VALUE15NAME "Unit Capture Units"
#define SPECENUM_VALUE16 ACTRES_FOUND_CITY
#define SPECENUM_VALUE16NAME "Unit Found City"
#define SPECENUM_VALUE17 ACTRES_JOIN_CITY
#define SPECENUM_VALUE17NAME "Unit Join City"
#define SPECENUM_VALUE18 ACTRES_STEAL_MAPS
#define SPECENUM_VALUE18NAME "Unit Steal Maps"
#define SPECENUM_VALUE19 ACTRES_BOMBARD
#define SPECENUM_VALUE19NAME "Unit Bombard"
#define SPECENUM_VALUE20 ACTRES_SPY_NUKE
#define SPECENUM_VALUE20NAME "Unit Suitcase Nuke"
#define SPECENUM_VALUE21 ACTRES_NUKE
#define SPECENUM_VALUE21NAME "Unit Nuke"
#define SPECENUM_VALUE22 ACTRES_NUKE_UNITS
#define SPECENUM_VALUE22NAME "Unit Nuke Units"
#define SPECENUM_VALUE23 ACTRES_DESTROY_CITY
#define SPECENUM_VALUE23NAME "Unit Destroy City"
#define SPECENUM_VALUE24 ACTRES_EXPEL_UNIT
#define SPECENUM_VALUE24NAME "Unit Expel Unit"
#define SPECENUM_VALUE25 ACTRES_DISBAND_UNIT_RECOVER
#define SPECENUM_VALUE25NAME "Unit Disband Recover"
#define SPECENUM_VALUE26 ACTRES_DISBAND_UNIT
#define SPECENUM_VALUE26NAME "Unit Disband"
#define SPECENUM_VALUE27 ACTRES_HOME_CITY
#define SPECENUM_VALUE27NAME "Unit Home City"
#define SPECENUM_VALUE28 ACTRES_UPGRADE_UNIT
#define SPECENUM_VALUE28NAME "Unit Upgrade"
#define SPECENUM_VALUE29 ACTRES_PARADROP
#define SPECENUM_VALUE29NAME "Unit Paradrop"
#define SPECENUM_VALUE30 ACTRES_AIRLIFT
#define SPECENUM_VALUE30NAME "Unit Airlift"
#define SPECENUM_VALUE31 ACTRES_ATTACK
#define SPECENUM_VALUE31NAME "Unit Attack"
#define SPECENUM_VALUE32 ACTRES_STRIKE_BUILDING
#define SPECENUM_VALUE32NAME "Unit Surgical Strike Building"
#define SPECENUM_VALUE33 ACTRES_STRIKE_PRODUCTION
#define SPECENUM_VALUE33NAME "Unit Surgical Strike Production"
#define SPECENUM_VALUE34 ACTRES_CONQUER_CITY
#define SPECENUM_VALUE34NAME "Unit Conquer City"
#define SPECENUM_VALUE35 ACTRES_HEAL_UNIT
#define SPECENUM_VALUE35NAME "Unit Heal Unit"
#define SPECENUM_VALUE36 ACTRES_TRANSFORM_TERRAIN
#define SPECENUM_VALUE36NAME "Unit Transform Terrain"
#define SPECENUM_VALUE37 ACTRES_CULTIVATE
#define SPECENUM_VALUE37NAME "Unit Cultivate"
#define SPECENUM_VALUE38 ACTRES_PLANT
#define SPECENUM_VALUE38NAME "Unit Plant"
#define SPECENUM_VALUE39 ACTRES_PILLAGE
#define SPECENUM_VALUE39NAME "Unit Pillage"
#define SPECENUM_VALUE40 ACTRES_FORTIFY
#define SPECENUM_VALUE40NAME "Unit Fortify"
#define SPECENUM_VALUE41 ACTRES_ROAD
#define SPECENUM_VALUE41NAME "Unit Build Road"
#define SPECENUM_VALUE42 ACTRES_CONVERT
#define SPECENUM_VALUE42NAME "Unit Convert"
#define SPECENUM_VALUE43 ACTRES_BASE
#define SPECENUM_VALUE43NAME "Unit Build Base"
#define SPECENUM_VALUE44 ACTRES_MINE
#define SPECENUM_VALUE44NAME "Unit Build Mine"
#define SPECENUM_VALUE45 ACTRES_IRRIGATE
#define SPECENUM_VALUE45NAME "Unit Build Irrigation"
#define SPECENUM_VALUE46 ACTRES_CLEAN_POLLUTION
#define SPECENUM_VALUE46NAME "Unit Clean Pollution"
#define SPECENUM_VALUE47 ACTRES_CLEAN_FALLOUT
#define SPECENUM_VALUE47NAME "Unit Clean Fallout"
#define SPECENUM_VALUE48 ACTRES_TRANSPORT_DEBOARD
#define SPECENUM_VALUE48NAME "Unit Transport Deboard"
#define SPECENUM_VALUE49 ACTRES_TRANSPORT_UNLOAD
#define SPECENUM_VALUE49NAME "Unit Transport Unload"
#define SPECENUM_VALUE50 ACTRES_TRANSPORT_DISEMBARK
#define SPECENUM_VALUE50NAME "Unit Transport Disembark"
#define SPECENUM_VALUE51 ACTRES_TRANSPORT_BOARD
#define SPECENUM_VALUE51NAME "Unit Transport Board"
#define SPECENUM_VALUE52 ACTRES_TRANSPORT_EMBARK
#define SPECENUM_VALUE52NAME "Unit Transport Embark"
#define SPECENUM_VALUE53 ACTRES_SPY_SPREAD_PLAGUE
#define SPECENUM_VALUE53NAME "Unit Spread Plague"
#define SPECENUM_VALUE54 ACTRES_SPY_ATTACK
#define SPECENUM_VALUE54NAME "Unit Spy Attack"
#define SPECENUM_VALUE55 ACTRES_CONQUER_EXTRAS
#define SPECENUM_VALUE55NAME "Unit Conquer Extras"
#define SPECENUM_VALUE56 ACTRES_HUT_ENTER
#define SPECENUM_VALUE56NAME "Unit Enter Hut"
#define SPECENUM_VALUE57 ACTRES_HUT_FRIGHTEN
#define SPECENUM_VALUE57NAME "Unit Frighten Hut"
#define SPECENUM_VALUE58 ACTRES_UNIT_MOVE
#define SPECENUM_VALUE58NAME "Unit Move"
#define SPECENUM_VALUE59 ACTRES_PARADROP_CONQUER
#define SPECENUM_VALUE59NAME "Unit Paradrop Conquer"
#define SPECENUM_VALUE60 ACTRES_HOMELESS
#define SPECENUM_VALUE60NAME "Unit Make Homeless"
#define SPECENUM_VALUE61 ACTRES_WIPE_UNITS
#define SPECENUM_VALUE61NAME "Wipe Units"
#define SPECENUM_VALUE62 ACTRES_SPY_ESCAPE
#define SPECENUM_VALUE62NAME "Unit Spy Escape"
#define SPECENUM_VALUE63 ACTRES_TRANSPORT_LOAD
#define SPECENUM_VALUE63NAME "Unit Transport Load"
#define SPECENUM_VALUE64 ACTRES_CLEAN
#define SPECENUM_VALUE64NAME "Clean"
/* TODO: Move close to "Move" */
#define SPECENUM_VALUE65 ACTRES_TELEPORT
#define SPECENUM_VALUE65NAME "Teleport"
/* Hardcoded action that's just controlled by enablers */
#define SPECENUM_VALUE66 ACTRES_ENABLER_CHECK
/* All consequences are handled as (ruleset) action data. */
#define SPECENUM_COUNT ACTRES_LAST
#include "specenum_gen.h"

#define ACTRES_NONE ACTRES_LAST

/* Used in the network protocol. */
#define SPECENUM_NAME action_sub_result
/* Will enter each enterable hut at the target tile */
#define SPECENUM_VALUE0 ACT_SUB_RES_HUT_ENTER
#define SPECENUM_VALUE0NAME "Unit Enter Hut"
/* Will frighten each frightenable hut at the target tile */
#define SPECENUM_VALUE1 ACT_SUB_RES_HUT_FRIGHTEN
#define SPECENUM_VALUE1NAME "Unit Frighten Hut"
/* The actor may load into a transport if it can't survive on its own at the
 * target tile. */
#define SPECENUM_VALUE2 ACT_SUB_RES_MAY_EMBARK
#define SPECENUM_VALUE2NAME "Unit May Embark"
/* Target units won't be killed by this action. */
#define SPECENUM_VALUE3 ACT_SUB_RES_NON_LETHAL
#define SPECENUM_VALUE3NAME "Non Lethal To Target Unit"
#define SPECENUM_BITVECTOR bv_action_sub_results
#define SPECENUM_COUNT ACT_SUB_RES_COUNT
#include "specenum_gen.h"

/* Happens at once, not during turn change. */
#define ACT_TIME_INSTANTANEOUS (-1)

/* Symbol used to flag no (sub) target of an action or for an activity.
 * IDENTITY_NUMBER_ZERO can't be used since 0 is a valid identity for
 * certain (sub) targets. */
#define NO_TARGET (-1)

/* How "large" a Casus Belli is. */
#define SPECENUM_NAME casus_belli_range
/* No one gets a Casus Belli. */
#define SPECENUM_VALUE0 CBR_NONE
#define SPECENUM_VALUE0NAME N_("No Casus Belli")
/* Only the victim player gets a Casus Belli. */
#define SPECENUM_VALUE1 CBR_VICTIM_ONLY
#define SPECENUM_VALUE1NAME N_("Victim Casus Belli")
/* Every other player, including the victim, gets a Casus Belli. */
#define SPECENUM_VALUE2 CBR_INTERNATIONAL_OUTRAGE
#define SPECENUM_VALUE2NAME N_("International Outrage")
#define SPECENUM_COUNT CBR_LAST
#include "specenum_gen.h"

enum adv_unit_task { AUT_NONE, AUT_AUTO_SETTLER, AUT_BUILD_CITY };

typedef signed short Continent_id;
typedef int Terrain_type_id;
typedef int Resource_type_id;
typedef int Specialist_type_id;
typedef int Impr_type_id;
typedef int Tech_type_id;
typedef enum output_type_id Output_type_id;
typedef enum unit_activity Activity_type_id;
typedef int Nation_type_id;
typedef int Government_type_id;
typedef int Unit_type_id;
typedef int Base_type_id;
typedef int Road_type_id;
typedef int Disaster_type_id;
typedef int Multiplier_type_id;
typedef int Goods_type_id;
typedef unsigned char citizens;
typedef int action_id;

struct advance;
struct city;
struct connection;
struct government;
struct impr_type;
struct nation_type;
struct output_type;
struct player;
struct specialist;
struct terrain;
struct tile;
struct unit;
struct achievement;
struct action;


/* Changing these will break network compatibility.
 * If changing MAX_NUM_REQS, also update user documentation in README.effects. */
#define SP_MAX 20
#define MAX_NUM_REQS 40

#define MAX_NUM_RULESETS 63 /* Used in the network protocol. */
#define MAX_RULESET_NAME_LENGTH 64 /* Used in the network protocol. */
#define RULESET_SUFFIX ".serv"

/* Unit Class List, also 32-bit vector? */
#define UCL_LAST 32 /* Used in the network protocol. */
typedef int Unit_Class_id;

/* The direction8 gives the 8 possible directions.  These may be used in
 * a number of ways, for instance as an index into the DIR_DX/DIR_DY
 * arrays.  Not all directions may be valid; see is_valid_dir and
 * is_cardinal_dir. */

/* The DIR8/direction8 naming system is used to avoid conflict with
 * DIR4/direction4 in client/tilespec.h
 *
 * Changing the order of the directions will break network compatibility.
 *
 * Some code assumes that the first 4 directions are the reverses of the
 * last 4 (in no particular order).  See client/goto.c and
 * map.c:opposite_direction(). */

/* Used in the network protocol. */
#define SPECENUM_NAME direction8
#define SPECENUM_VALUE0 DIR8_NORTHWEST
#define SPECENUM_VALUE0NAME "Northwest"
#define SPECENUM_VALUE1 DIR8_NORTH
#define SPECENUM_VALUE1NAME "North"
#define SPECENUM_VALUE2 DIR8_NORTHEAST
#define SPECENUM_VALUE2NAME "Northeast"
#define SPECENUM_VALUE3 DIR8_WEST
#define SPECENUM_VALUE3NAME "West"
#define SPECENUM_VALUE4 DIR8_EAST
#define SPECENUM_VALUE4NAME "East"
#define SPECENUM_VALUE5 DIR8_SOUTHWEST
#define SPECENUM_VALUE5NAME "Southwest"
#define SPECENUM_VALUE6 DIR8_SOUTH
#define SPECENUM_VALUE6NAME "South"
#define SPECENUM_VALUE7 DIR8_SOUTHEAST
#define SPECENUM_VALUE7NAME "Southeast"
#define SPECENUM_INVALID ((enum direction8) (DIR8_SOUTHEAST + 1))
#include "specenum_gen.h"

/* No direction. Understood as the origin tile that a direction would have
 * been relative to. */
#define DIR8_ORIGIN direction8_invalid()

/* Used in the network protocol. */
#define SPECENUM_NAME free_tech_method
#define SPECENUM_VALUE0 FTM_GOAL
#define SPECENUM_VALUE0NAME "Goal"
#define SPECENUM_VALUE1 FTM_RANDOM
#define SPECENUM_VALUE1NAME "Random"
#define SPECENUM_VALUE2 FTM_CHEAPEST
#define SPECENUM_VALUE2NAME "Cheapest"
#include "specenum_gen.h"

/* Some code requires compile time value for number of directions, and
 * cannot use specenum function call direction8_max(). */
#define DIR8_MAGIC_MAX 8

/* The victim gets a casus belli if EFT_CASUS_BELLI_* is equal to or above
 * CASUS_BELLI_VICTIM. To change this value you must update the
 * documentation of each Casus_Belli_* effect in
 * doc/README.effects, update existing rulesets and add ruleset
 * compatibility code to server/rscompat.c. */
#define CASUS_BELLI_VICTIM 1
/* International outrage: Everyone gets a casus belli if EFT_CASUS_BELLI_*
 * is equal to or above CASUS_BELLI_OUTRAGE. To change this value you must
 * update the documentation of each Casus_Belli_* effect in
 * doc/README.effects, update existing rulesets and add ruleset
 * compatibility code to server/rscompat.c. */
#define CASUS_BELLI_OUTRAGE 1000

/* Really in ai.c */
const char *ai_level_name_update_cb(const char *old);

/* Used in the network protocol. */
/* server/commands.c must match these */
#define SPECENUM_NAME ai_level
#define SPECENUM_VALUE0 AI_LEVEL_RESTRICTED
#define SPECENUM_VALUE0NAME N_("Restricted")
#define SPECENUM_VALUE1 AI_LEVEL_NOVICE
#define SPECENUM_VALUE1NAME N_("Novice")
#define SPECENUM_VALUE2 AI_LEVEL_EASY
#define SPECENUM_VALUE2NAME N_("Easy")
#define SPECENUM_VALUE3 AI_LEVEL_NORMAL
#define SPECENUM_VALUE3NAME N_("Normal")
#define SPECENUM_VALUE4 AI_LEVEL_HARD
#define SPECENUM_VALUE4NAME N_("Hard")
#define SPECENUM_VALUE5 AI_LEVEL_CHEATING
#define SPECENUM_VALUE5NAME N_("Cheating")

#ifdef FREECIV_DEBUG
#define SPECENUM_VALUE6 AI_LEVEL_EXPERIMENTAL
#define SPECENUM_VALUE6NAME N_("Experimental")
/* Away must be the last, so ailevel_name() can terminate list
 * of level names before it. */
#define SPECENUM_VALUE7 AI_LEVEL_AWAY
#define SPECENUM_VALUE7NAME N_("Away")
#else  /* FREECIV_DEBUG */
#define SPECENUM_VALUE6 AI_LEVEL_AWAY
#define SPECENUM_VALUE6NAME N_("Away")
#endif /* FREECIV_DEBUG */

#define SPECENUM_COUNT AI_LEVEL_COUNT
#define SPECENUM_NAME_UPDATER
#include "specenum_gen.h"

/* pplayer->ai.barbarian_type and nations use this enum. */
#define SPECENUM_NAME barbarian_type
#define SPECENUM_VALUE0 NOT_A_BARBARIAN
#define SPECENUM_VALUE0NAME "None"
#define SPECENUM_VALUE1 LAND_BARBARIAN
#define SPECENUM_VALUE1NAME "Land"
#define SPECENUM_VALUE2 SEA_BARBARIAN
#define SPECENUM_VALUE2NAME "Sea"
#define SPECENUM_VALUE3 ANIMAL_BARBARIAN
#define SPECENUM_VALUE3NAME "Animal"
#define SPECENUM_VALUE4 LAND_AND_SEA_BARBARIAN
#define SPECENUM_VALUE4NAME "LandAndSea"
#include "specenum_gen.h"

/*
 * CityTile requirement types.
 *
 * Used in the network protocol
 */
#define SPECENUM_NAME citytile_type
#define SPECENUM_VALUE0 CITYT_CENTER
#define SPECENUM_VALUE0NAME "Center"
#define SPECENUM_VALUE1 CITYT_CLAIMED
#define SPECENUM_VALUE1NAME "Claimed"
#define SPECENUM_VALUE2 CITYT_EXTRAS_OWNED
#define SPECENUM_VALUE2NAME "Extras Owned"
#define SPECENUM_VALUE3 CITYT_WORKED
#define SPECENUM_VALUE3NAME "Worked"
#define SPECENUM_VALUE4 CITYT_SAME_CONTINENT
#define SPECENUM_VALUE4NAME "Same Continent"
#define SPECENUM_VALUE5 CITYT_BORDERING_TCLASS_REGION
#define SPECENUM_VALUE5NAME "Bordering TClass Region"
#define SPECENUM_COUNT CITYT_LAST
#include "specenum_gen.h"

/*
 * CityStatus requirement types.
 *
 * Used in the network protocol
 */
#define SPECENUM_NAME citystatus_type
#define SPECENUM_VALUE0 CITYS_OWNED_BY_ORIGINAL
#define SPECENUM_VALUE0NAME "OwnedByOriginal"
#define SPECENUM_VALUE1 CITYS_STARVED
#define SPECENUM_VALUE1NAME "Starved"
#define SPECENUM_VALUE2 CITYS_DISORDER
#define SPECENUM_VALUE2NAME "Disorder"
#define SPECENUM_VALUE3 CITYS_CELEBRATION
#define SPECENUM_VALUE3NAME "Celebration"
#define SPECENUM_COUNT CITYS_LAST
#include "specenum_gen.h"

/*
 * UnitState requirement property types.
 *
 * Used in the network protocol.
 */
#define SPECENUM_NAME ustate_prop
#define SPECENUM_VALUE0 USP_TRANSPORTED
#define SPECENUM_VALUE0NAME "Transported"
#define SPECENUM_VALUE1 USP_LIVABLE_TILE
#define SPECENUM_VALUE1NAME "OnLivableTile"
#define SPECENUM_VALUE2 USP_TRANSPORTING
#define SPECENUM_VALUE2NAME "Transporting"
#define SPECENUM_VALUE3 USP_HAS_HOME_CITY
#define SPECENUM_VALUE3NAME "HasHomeCity"
#define SPECENUM_VALUE4 USP_NATIVE_TILE
#define SPECENUM_VALUE4NAME "OnNativeTile"
#define SPECENUM_VALUE5 USP_NATIVE_EXTRA
#define SPECENUM_VALUE5NAME "InNativeExtra"
#define SPECENUM_VALUE6 USP_MOVED_THIS_TURN
#define SPECENUM_VALUE6NAME "MovedThisTurn"
#define SPECENUM_COUNT USP_COUNT
#include "specenum_gen.h"

/* Changing these values will break map_init_topology().
 * Changing the names will break file format compatibility. */
#define SPECENUM_NAME topo_flag
#define SPECENUM_BITWISE
#define SPECENUM_VALUE0 TF_ISO
#define SPECENUM_VALUE0NAME N_("ISO")
#define SPECENUM_VALUE1 TF_HEX
#define SPECENUM_VALUE1NAME N_("Hex")
#define SPECENUM_VALUE2 TF_OLD_WRAPX
#define SPECENUM_VALUE2NAME N_("WrapX")
#define SPECENUM_VALUE3 TF_OLD_WRAPY
#define SPECENUM_VALUE3NAME N_("WrapY")
#define TOPO_FLAG_BITS  4
#include "specenum_gen.h"

#define SPECENUM_NAME wrap_flag
#define SPECENUM_BITWISE
#define SPECENUM_VALUE0 WRAP_X
#define SPECENUM_VALUE0NAME N_("WrapX")
#define SPECENUM_VALUE1 WRAP_Y
#define SPECENUM_VALUE1NAME N_("WrapY")
#define WRAP_FLAG_BITS  2
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME impr_genus_id
#define SPECENUM_VALUE0 IG_GREAT_WONDER
#define SPECENUM_VALUE0NAME "GreatWonder"
#define SPECENUM_VALUE1 IG_SMALL_WONDER
#define SPECENUM_VALUE1NAME "SmallWonder"
#define SPECENUM_VALUE2 IG_IMPROVEMENT
#define SPECENUM_VALUE2NAME "Improvement"
#define SPECENUM_VALUE3 IG_SPECIAL
#define SPECENUM_VALUE3NAME "Special"
#define SPECENUM_VALUE4 IG_CONVERT
#define SPECENUM_VALUE4NAME "Convert"
#define SPECENUM_COUNT  IG_COUNT
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME impr_flag_id
/* Improvement should be visible to others without spying */
#define SPECENUM_VALUE0 IF_VISIBLE_BY_OTHERS
#define SPECENUM_VALUE0NAME "VisibleByOthers"
/* This small wonder is moved to another city if game.savepalace is on. */
#define SPECENUM_VALUE1 IF_SAVE_SMALL_WONDER
#define SPECENUM_VALUE1NAME "SaveSmallWonder"
/* When built, gives gold */
#define SPECENUM_VALUE2 IF_GOLD
#define SPECENUM_VALUE2NAME "Gold"
/* Never destroyed by disasters */
#define SPECENUM_VALUE3 IF_DISASTER_PROOF
#define SPECENUM_VALUE3NAME "DisasterProof"
#define SPECENUM_VALUE4 IF_USER_FLAG_1
#define SPECENUM_VALUE5 IF_USER_FLAG_2
#define SPECENUM_VALUE6 IF_USER_FLAG_3
#define SPECENUM_VALUE7 IF_USER_FLAG_4
#define SPECENUM_VALUE8 IF_USER_FLAG_5
#define SPECENUM_VALUE9 IF_USER_FLAG_6
#define SPECENUM_VALUE10 IF_USER_FLAG_7
#define SPECENUM_VALUE11 IF_USER_FLAG_8
#define SPECENUM_COUNT IF_COUNT
#define SPECENUM_NAMEOVERRIDE
#define SPECENUM_BITVECTOR bv_impr_flags
#include "specenum_gen.h"

#define IF_LAST_USER_FLAG IF_USER_FLAG_8
#define MAX_NUM_USER_BUILDING_FLAGS (IF_LAST_USER_FLAG - IF_USER_FLAG_1 + 1)

/* A server setting + its value. */
typedef int ssetv;

/* Sometimes we don't know (or don't care) if some requirements for effect
 * are currently fulfilled or not. This enum tells lower level functions
 * how to handle uncertain requirements.
 */
enum req_problem_type {
  RPT_POSSIBLE, /* We want to know if it is possible that effect is active */
  RPT_CERTAIN   /* We want to know if it is certain that effect is active  */
};

#define REVERSED_RPT(x) \
  (x == RPT_CERTAIN ? RPT_POSSIBLE : RPT_CERTAIN)

/* Originally in requirements.h, bumped up and revised to unify with
 * city_production and worklists.  Functions remain in requirements.c
 * Used in the network protocol. */
typedef union {
  struct advance *advance;
  struct counter *counter;
  struct government *govern;
  const struct impr_type *building;
  struct nation_type *nation;
  struct nation_type *nationality;
  struct nation_type *origowner;
  struct specialist *specialist;
  struct terrain *terrain;
  struct unit_class *uclass;
  const struct unit_type *utype;
  struct extra_type *extra;
  struct achievement *achievement;
  struct nation_group *nationgroup;
  struct nation_style *style;
  struct action *action;
  struct goods_type *good;

  enum ai_level ai_level;
  enum citytile_type citytile;
  enum citystatus_type citystatus;
  int minsize;
  int minculture;
  int minforeignpct;
  int minyear;
  int mincalfrag;
  Output_type_id outputtype;
  int terrainclass;			/* enum terrain_class */
  int terrainalter;                     /* enum terrain_alteration */
  int unitclassflag;			/* enum unit_class_flag_id */
  int unitflag;				/* enum unit_flag_id */
  int terrainflag;                      /* enum terrain_flag_id */
  int techflag;                         /* enum tech_flag_id */
  int roadflag;                         /* enum road_flag_id */
  int extraflag;
  int diplrel;                          /* enum diplstate_type or
                                           enum diplrel_other */
  enum ustate_prop unit_state;
  enum unit_activity activity;
  enum impr_genus_id impr_genus;
  enum impr_flag_id impr_flag;
  int minmoves;
  int max_tile_units;
  int minveteran;
  int min_hit_points;
  int age;
  int min_techs;
  int latitude;

  enum topo_flag topo_property;
  enum wrap_flag wrap_property;
  ssetv ssetval;
} universals_u;

/* The kind of universals_u (value_union_type was req_source_type).
 * Used in the network protocol. */
#define SPECENUM_NAME universals_n
#define SPECENUM_VALUE0 VUT_NONE
#define SPECENUM_VALUE0NAME "None"
#define SPECENUM_VALUE1 VUT_ADVANCE
#define SPECENUM_VALUE1NAME "Tech"
#define SPECENUM_VALUE2 VUT_GOVERNMENT
#define SPECENUM_VALUE2NAME "Gov"
#define SPECENUM_VALUE3 VUT_IMPROVEMENT
#define SPECENUM_VALUE3NAME "Building"
#define SPECENUM_VALUE4 VUT_TERRAIN
#define SPECENUM_VALUE4NAME "Terrain"
#define SPECENUM_VALUE5 VUT_NATION
#define SPECENUM_VALUE5NAME "Nation"
#define SPECENUM_VALUE6 VUT_UTYPE
#define SPECENUM_VALUE6NAME "UnitType"
#define SPECENUM_VALUE7 VUT_UTFLAG
#define SPECENUM_VALUE7NAME "UnitFlag"
#define SPECENUM_VALUE8 VUT_UCLASS
#define SPECENUM_VALUE8NAME "UnitClass"
#define SPECENUM_VALUE9 VUT_UCFLAG
#define SPECENUM_VALUE9NAME "UnitClassFlag"
#define SPECENUM_VALUE10 VUT_OTYPE
#define SPECENUM_VALUE10NAME "OutputType"
#define SPECENUM_VALUE11 VUT_SPECIALIST
#define SPECENUM_VALUE11NAME "Specialist"
/* Minimum size: at city range means city size */
#define SPECENUM_VALUE12 VUT_MINSIZE
#define SPECENUM_VALUE12NAME "MinSize"
/* AI level of the player */
#define SPECENUM_VALUE13 VUT_AI_LEVEL
#define SPECENUM_VALUE13NAME "AI"
/* More generic terrain type currently "Land" or "Ocean" */
#define SPECENUM_VALUE14 VUT_TERRAINCLASS
#define SPECENUM_VALUE14NAME "TerrainClass"
#define SPECENUM_VALUE15 VUT_MINYEAR
#define SPECENUM_VALUE15NAME "MinYear"
/* Terrain alterations that are possible */
#define SPECENUM_VALUE16 VUT_TERRAINALTER
#define SPECENUM_VALUE16NAME "TerrainAlter"
/* Target tile is used by city. */
#define SPECENUM_VALUE17 VUT_CITYTILE
#define SPECENUM_VALUE17NAME "CityTile"
#define SPECENUM_VALUE18 VUT_GOOD
#define SPECENUM_VALUE18NAME "Good"
#define SPECENUM_VALUE19 VUT_TERRFLAG
#define SPECENUM_VALUE19NAME "TerrainFlag"
#define SPECENUM_VALUE20 VUT_NATIONALITY
#define SPECENUM_VALUE20NAME "Nationality"
#define SPECENUM_VALUE21 VUT_ROADFLAG
#define SPECENUM_VALUE21NAME "RoadFlag"
#define SPECENUM_VALUE22 VUT_EXTRA
#define SPECENUM_VALUE22NAME "Extra"
#define SPECENUM_VALUE23 VUT_TECHFLAG
#define SPECENUM_VALUE23NAME "TechFlag"
#define SPECENUM_VALUE24 VUT_ACHIEVEMENT
#define SPECENUM_VALUE24NAME "Achievement"
#define SPECENUM_VALUE25 VUT_DIPLREL
#define SPECENUM_VALUE25NAME "DiplRel"
#define SPECENUM_VALUE26 VUT_MAXTILEUNITS
#define SPECENUM_VALUE26NAME "MaxUnitsOnTile"
#define SPECENUM_VALUE27 VUT_STYLE
#define SPECENUM_VALUE27NAME "Style"
#define SPECENUM_VALUE28 VUT_MINCULTURE
#define SPECENUM_VALUE28NAME "MinCulture"
#define SPECENUM_VALUE29 VUT_UNITSTATE
#define SPECENUM_VALUE29NAME "UnitState"
#define SPECENUM_VALUE30 VUT_MINMOVES
#define SPECENUM_VALUE30NAME "MinMoveFrags"
#define SPECENUM_VALUE31 VUT_MINVETERAN
#define SPECENUM_VALUE31NAME "MinVeteran"
#define SPECENUM_VALUE32 VUT_MINHP
#define SPECENUM_VALUE32NAME "MinHitPoints"
#define SPECENUM_VALUE33 VUT_AGE
#define SPECENUM_VALUE33NAME "Age"
#define SPECENUM_VALUE34 VUT_NATIONGROUP
#define SPECENUM_VALUE34NAME "NationGroup"
#define SPECENUM_VALUE35 VUT_TOPO
#define SPECENUM_VALUE35NAME "Topology"
#define SPECENUM_VALUE36 VUT_IMPR_GENUS
#define SPECENUM_VALUE36NAME "BuildingGenus"
#define SPECENUM_VALUE37 VUT_ACTION
#define SPECENUM_VALUE37NAME "Action"
#define SPECENUM_VALUE38 VUT_MINTECHS
#define SPECENUM_VALUE38NAME "MinTechs"
#define SPECENUM_VALUE39 VUT_EXTRAFLAG
#define SPECENUM_VALUE39NAME "ExtraFlag"
#define SPECENUM_VALUE40 VUT_MINCALFRAG
#define SPECENUM_VALUE40NAME "MinCalFrag"
#define SPECENUM_VALUE41 VUT_SERVERSETTING
#define SPECENUM_VALUE41NAME "ServerSetting"
#define SPECENUM_VALUE42 VUT_CITYSTATUS
#define SPECENUM_VALUE42NAME "CityStatus"
#define SPECENUM_VALUE43 VUT_MINFOREIGNPCT
#define SPECENUM_VALUE43NAME "MinForeignPct"
#define SPECENUM_VALUE44 VUT_ACTIVITY
#define SPECENUM_VALUE44NAME "Activity"
#define SPECENUM_VALUE45 VUT_DIPLREL_TILE
#define SPECENUM_VALUE45NAME "DiplRelTile"
#define SPECENUM_VALUE46 VUT_DIPLREL_TILE_O
#define SPECENUM_VALUE46NAME "DiplRelTileOther"
#define SPECENUM_VALUE47 VUT_DIPLREL_UNITANY
#define SPECENUM_VALUE47NAME "DiplRelUnitAny"
#define SPECENUM_VALUE48 VUT_DIPLREL_UNITANY_O
#define SPECENUM_VALUE48NAME "DiplRelUnitAnyOther"
#define SPECENUM_VALUE49 VUT_MINLATITUDE
#define SPECENUM_VALUE49NAME "MinLatitude"
#define SPECENUM_VALUE50 VUT_MAXLATITUDE
#define SPECENUM_VALUE50NAME "MaxLatitude"
#define SPECENUM_VALUE51 VUT_COUNTER
#define SPECENUM_VALUE51NAME "Counter"
#define SPECENUM_VALUE52 VUT_ORIGINAL_OWNER
#define SPECENUM_VALUE52NAME "OriginalOwner"
#define SPECENUM_VALUE53 VUT_IMPR_FLAG
#define SPECENUM_VALUE53NAME "BuildingFlag"
#define SPECENUM_VALUE54 VUT_WRAP
#define SPECENUM_VALUE54NAME "Wrap"

/* Keep this last. */
#define SPECENUM_COUNT VUT_COUNT
#include "specenum_gen.h"

/* Used in the network protocol. */
struct universal {
  universals_u value;
  enum universals_n kind;		/* formerly .type and .is_unit */
};

/* Used in the network protocol. */
BV_DEFINE(bv_extras, MAX_EXTRA_TYPES);
BV_DEFINE(bv_special, MAX_EXTRA_TYPES);
BV_DEFINE(bv_bases, MAX_BASE_TYPES);
BV_DEFINE(bv_roads, MAX_ROAD_TYPES);
BV_DEFINE(bv_startpos_nations, MAX_NUM_STARTPOS_NATIONS);

/* Used in the network protocol. */
#define SPECENUM_NAME gui_type
/* Used for options which do not belong to any gui. */
#define SPECENUM_VALUE0 GUI_STUB
#define SPECENUM_VALUE0NAME "stub"
/* GUI_GTK2 remains for now for keeping client options alive until
 * user has migrated them to gtk3-client */
#define SPECENUM_VALUE1 GUI_GTK2
#define SPECENUM_VALUE1NAME "gtk2"
#define SPECENUM_VALUE2 GUI_GTK3
#define SPECENUM_VALUE2NAME "gtk3"
#define SPECENUM_VALUE3 GUI_GTK3_22
#define SPECENUM_VALUE3NAME "gtk3.22"
/* GUI_SDL remains for now for keeping client options alive until
 * user has migrated them to sdl2-client */
#define SPECENUM_VALUE4 GUI_SDL
#define SPECENUM_VALUE4NAME "sdl"
#define SPECENUM_VALUE5 GUI_QT
#define SPECENUM_VALUE5NAME "qt"
#define SPECENUM_VALUE6 GUI_SDL2
#define SPECENUM_VALUE6NAME "sdl2"
#define SPECENUM_VALUE7 GUI_WEB
#define SPECENUM_VALUE7NAME "web"
#define SPECENUM_VALUE8 GUI_GTK4
#define SPECENUM_VALUE8NAME "gtk4"
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME airlifting_style
#define SPECENUM_BITWISE
/* Like classical Freeciv.  One unit per turn. */
#define SPECENUM_ZERO   AIRLIFTING_CLASSICAL
/* Allow airlifting from allied cities. */
#define SPECENUM_VALUE0 AIRLIFTING_ALLIED_SRC
/* Allow airlifting to allied cities. */
#define SPECENUM_VALUE1 AIRLIFTING_ALLIED_DEST
/* Unlimited units to airlift from the source (but always needs an Airport
 * or equivalent). */
#define SPECENUM_VALUE2 AIRLIFTING_UNLIMITED_SRC
/* Unlimited units to airlift to the destination (doesn't require any
 * Airport or equivalent). */
#define SPECENUM_VALUE3 AIRLIFTING_UNLIMITED_DEST
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME caravan_bonus_style
#define SPECENUM_VALUE0 CBS_CLASSIC
#define SPECENUM_VALUE0NAME "Classic"
#define SPECENUM_VALUE1 CBS_LOGARITHMIC
#define SPECENUM_VALUE1NAME "Logarithmic"
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME persistent_ready
#define SPECENUM_VALUE0  PERSISTENTR_DISABLED
#define SPECENUM_VALUE0NAME "Disabled"
#define SPECENUM_VALUE1  PERSISTENTR_CONNECTED
#define SPECENUM_VALUE1NAME "Connected"
#include "specenum_gen.h"

#define SPECENUM_NAME reveal_map
#define SPECENUM_BITWISE
/* Reveal only the area around the first units at the beginning. */
#define SPECENUM_ZERO   REVEAL_MAP_NONE
/* Reveal the (fogged) map at the beginning of the game. */
#define SPECENUM_VALUE0 REVEAL_MAP_START
/* Reveal (and unfog) the map for dead players. */
#define SPECENUM_VALUE1 REVEAL_MAP_DEAD
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME gameloss_style
#define SPECENUM_BITWISE
/* Like classical Freeciv. No special effects. */
#define SPECENUM_ZERO   GAMELOSS_STYLE_CLASSICAL
/* Remaining cities are taken by barbarians. */
#define SPECENUM_VALUE0 GAMELOSS_STYLE_BARB
#define SPECENUM_VALUE0NAME "Barbarians"
/* Try civil war. */
#define SPECENUM_VALUE1 GAMELOSS_STYLE_CWAR
#define SPECENUM_VALUE1NAME "CivilWar"
/* Do some looting */
#define SPECENUM_VALUE2 GAMELOSS_STYLE_LOOT
#define SPECENUM_VALUE2NAME "Loot"
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME tech_upkeep_style
/* No upkeep */
#define SPECENUM_VALUE0 TECH_UPKEEP_NONE
#define SPECENUM_VALUE0NAME "None"
/* Normal tech upkeep */
#define SPECENUM_VALUE1 TECH_UPKEEP_BASIC
#define SPECENUM_VALUE1NAME "Basic"
/* Tech upkeep multiplied by number of cities */
#define SPECENUM_VALUE2 TECH_UPKEEP_PER_CITY
#define SPECENUM_VALUE2NAME "Cities"
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME trade_revenue_style
#define SPECENUM_VALUE0 TRS_CLASSIC
#define SPECENUM_VALUE0NAME "Classic"
#define SPECENUM_VALUE1 TRS_SIMPLE
#define SPECENUM_VALUE1NAME "Simple"
#include "specenum_gen.h"

/* Used in the network protocol. */
/* Numerical values used in savegames */
#define SPECENUM_NAME phase_mode_type
#define SPECENUM_VALUE0 PMT_CONCURRENT
#define SPECENUM_VALUE0NAME "Concurrent"
#define SPECENUM_VALUE1 PMT_PLAYERS_ALTERNATE
#define SPECENUM_VALUE1NAME "Players Alternate"
#define SPECENUM_VALUE2 PMT_TEAMS_ALTERNATE
#define SPECENUM_VALUE2NAME "Teams Alternate"
#include "specenum_gen.h"

/* Phase mode change has changed meaning of the phase numbers */
#define PHASE_INVALIDATED -1
/* Phase was never known */
#define PHASE_UNKNOWN     -2

/* Used in the network protocol. */
enum borders_mode {
  BORDERS_DISABLED = 0,
  BORDERS_ENABLED,
  BORDERS_SEE_INSIDE,
  BORDERS_EXPAND
};

enum trait_dist_mode {
  TDM_FIXED = 0,
  TDM_EVEN
};

/* Used in the network protocol. */
enum diplomacy_mode {
  DIPLO_FOR_ALL,
  DIPLO_FOR_HUMANS,
  DIPLO_FOR_AIS,
  DIPLO_NO_AIS,
  DIPLO_NO_MIXED,
  DIPLO_FOR_TEAMS,
  DIPLO_DISABLED,
};

/* Server setting types. */
#define SPECENUM_NAME sset_type
#define SPECENUM_VALUE0 SST_BOOL
#define SPECENUM_VALUE1 SST_INT
#define SPECENUM_VALUE2 SST_STRING
#define SPECENUM_VALUE3 SST_ENUM
#define SPECENUM_VALUE4 SST_BITWISE
#define SPECENUM_COUNT  SST_COUNT
#include "specenum_gen.h"

/* Mark server setting id's. */
typedef int server_setting_id;

/* Used in the network protocol. */
#define SPECENUM_NAME extra_category
#define SPECENUM_VALUE0 ECAT_INFRA
#define SPECENUM_VALUE0NAME "Infra"
#define SPECENUM_VALUE1 ECAT_NATURAL
#define SPECENUM_VALUE1NAME "Natural"
#define SPECENUM_VALUE2 ECAT_NUISANCE
#define SPECENUM_VALUE2NAME "Nuisance"
#define SPECENUM_VALUE3 ECAT_BONUS
#define SPECENUM_VALUE3NAME "Bonus"
#define SPECENUM_VALUE4 ECAT_RESOURCE
#define SPECENUM_VALUE4NAME "Resource"
#define SPECENUM_COUNT ECAT_COUNT
#include "specenum_gen.h"
#define ECAT_NONE ECAT_COUNT

/* Used in the network protocol.
 * When adding new cause types here, consider also adding them to the
 * order of pillage preference in get_preferred_pillage() */
#define SPECENUM_NAME extra_cause
#define SPECENUM_VALUE0 EC_IRRIGATION
#define SPECENUM_VALUE0NAME "Irrigation"
#define SPECENUM_VALUE1 EC_MINE
#define SPECENUM_VALUE1NAME "Mine"
#define SPECENUM_VALUE2 EC_ROAD
#define SPECENUM_VALUE2NAME "Road"
#define SPECENUM_VALUE3 EC_BASE
#define SPECENUM_VALUE3NAME "Base"
#define SPECENUM_VALUE4 EC_POLLUTION
#define SPECENUM_VALUE4NAME "Pollution"
#define SPECENUM_VALUE5 EC_FALLOUT
#define SPECENUM_VALUE5NAME "Fallout"
#define SPECENUM_VALUE6 EC_HUT
#define SPECENUM_VALUE6NAME "Hut"
#define SPECENUM_VALUE7 EC_APPEARANCE
#define SPECENUM_VALUE7NAME "Appear"
#define SPECENUM_VALUE8 EC_RESOURCE
#define SPECENUM_VALUE8NAME "Resource"
#define SPECENUM_COUNT EC_COUNT
#define SPECENUM_BITVECTOR bv_causes
#include "specenum_gen.h"
#define EC_NONE EC_COUNT
#define EC_SPECIAL (EC_NONE + 1)
#define EC_DEFENSIVE (EC_NONE + 2)
#define EC_NATURAL_DEFENSIVE (EC_NONE + 3)
#define EC_NOT_AGGRESSIVE (EC_NONE + 4)
#define EC_LAST (EC_NONE + 5)

/* struct extra_type reserve 16 bits (0-15) for these. */
FC_STATIC_ASSERT(EC_COUNT < 16, extra_causes_over_limit);

/* Used in the network protocol. */
#define SPECENUM_NAME extra_rmcause
#define SPECENUM_VALUE0 ERM_PILLAGE
#define SPECENUM_VALUE0NAME "Pillage"
#define SPECENUM_VALUE1 ERM_CLEAN
#define SPECENUM_VALUE1NAME "Clean"
#define SPECENUM_VALUE2 ERM_CLEANFALLOUT
#define SPECENUM_VALUE2NAME "CleanFallout"
#define SPECENUM_VALUE3 ERM_DISAPPEARANCE
#define SPECENUM_VALUE3NAME "Disappear"
#define SPECENUM_VALUE4 ERM_ENTER
#define SPECENUM_VALUE4NAME "Enter"
#define SPECENUM_VALUE5 ERM_CLEANPOLLUTION
#define SPECENUM_VALUE5NAME "CleanPollution"
#define SPECENUM_COUNT ERM_COUNT
#define SPECENUM_BITVECTOR bv_rmcauses
#include "specenum_gen.h"
#define ERM_NONE ERM_COUNT

/* struct extra_type reserve 8 bits (0-7) for these. */
FC_STATIC_ASSERT(ERM_COUNT < 8, extra_rmcauses_over_limit);

#define SPECENUM_NAME extra_unit_seen_type
#define SPECENUM_VALUE0 EUS_NORMAL
#define SPECENUM_VALUE0NAME "Normal"
#define SPECENUM_VALUE1 EUS_HIDDEN
#define SPECENUM_VALUE1NAME "Hidden"
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME achievement_type
#define SPECENUM_VALUE0 ACHIEVEMENT_SPACESHIP
#define SPECENUM_VALUE0NAME "Spaceship"
#define SPECENUM_VALUE1 ACHIEVEMENT_MAP
#define SPECENUM_VALUE1NAME "Map_Known"
#define SPECENUM_VALUE2 ACHIEVEMENT_MULTICULTURAL
#define SPECENUM_VALUE2NAME "Multicultural"
#define SPECENUM_VALUE3 ACHIEVEMENT_CULTURED_CITY
#define SPECENUM_VALUE3NAME "Cultured_City"
#define SPECENUM_VALUE4 ACHIEVEMENT_CULTURED_NATION
#define SPECENUM_VALUE4NAME "Cultured_Nation"
#define SPECENUM_VALUE5 ACHIEVEMENT_LUCKY
#define SPECENUM_VALUE5NAME "Lucky"
#define SPECENUM_VALUE6 ACHIEVEMENT_HUTS
#define SPECENUM_VALUE6NAME "Huts"
#define SPECENUM_VALUE7 ACHIEVEMENT_METROPOLIS
#define SPECENUM_VALUE7NAME "Metropolis"
#define SPECENUM_VALUE8 ACHIEVEMENT_LITERATE
#define SPECENUM_VALUE8NAME "Literate"
#define SPECENUM_VALUE9 ACHIEVEMENT_LAND_AHOY
#define SPECENUM_VALUE9NAME "Land_Ahoy"
#define SPECENUM_VALUE10 ACHIEVEMENT_KILLER
#define SPECENUM_VALUE10NAME "Killer"
#define SPECENUM_COUNT ACHIEVEMENT_COUNT
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME mood_type
#define SPECENUM_VALUE0 MOOD_PEACEFUL
#define SPECENUM_VALUE0NAME "Peaceful"
#define SPECENUM_VALUE1 MOOD_COMBAT
#define SPECENUM_VALUE1NAME "Combat"
#define SPECENUM_COUNT MOOD_COUNT
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME action_decision
/* Doesn't need the player to decide what action to take. */
#define SPECENUM_VALUE0 ACT_DEC_NOTHING
#define SPECENUM_VALUE0NAME N_("nothing")
/* Wants a decision because of something done to the actor. */
#define SPECENUM_VALUE1 ACT_DEC_PASSIVE
#define SPECENUM_VALUE1NAME N_("passive")
/* Wants a decision because of something the actor did. */
#define SPECENUM_VALUE2 ACT_DEC_ACTIVE
#define SPECENUM_VALUE2NAME N_("active")
#define SPECENUM_COUNT ACT_DEC_COUNT
#include "specenum_gen.h"

/*
 * Action probability
 *
 * An action probability is the probability that an action will be
 * successful under the given circumstances. It is an interval that
 * includes the end points. An end point goes from 0% to 100%.
 * Alternatively it can signal a special case.
 *
 * End point values from 0 up to and including 200 should be understood as
 * the chance of success measured in half percentage points. In other words:
 * The value 3 indicates that the chance is 1.5%. The value 10 indicates
 * that the chance is 5%. The probability of a minimum may be rounded down
 * to the nearest half percentage point. The probability of a maximum may
 * be rounded up to the nearest half percentage point.
 *
 * Values with a higher minimum than maximum are special case values. All
 * special cases should be declared and documented below. An undocumented
 * value in this range should be considered a bug. If a special value for
 * internal use is needed please avoid the range from and including 0 up
 * to and including 255.
 *
 * [0, 0]     ACTPROB_IMPOSSIBLE is another way of saying that the
 *            probability is 0%. It isn't really a special value since it
 *            is in range.
 *
 * [200, 200] ACTPROB_CERTAIN is another way of saying that the probability
 *            is 100%. It isn't really a special value since it is in range.
 *
 * [253, 0]   ACTPROB_NA indicates that no probability should exist.
 *
 * [254, 0]   ACTPROB_NOT_IMPLEMENTED indicates that support for finding
 *            this probability currently is missing.
 *
 * [0, 200]   ACTPROB_NOT_KNOWN indicates that the player don't know enough
 *            to find out. It is caused by the probability depending on a
 *            rule that depends on game state the player don't have access
 *            to. It may be possible for the player to later gain access to
 *            this game state. It isn't really a special value since it is
 *            in range.
 */
struct act_prob {
  int min;
  int max;
};

enum test_result {
  TR_SUCCESS,
  TR_OTHER_FAILURE,
  TR_ALREADY_SOLD
};

/* Road type compatibility with old specials based roads.
 * Used in the network protocol. */
enum road_compat { ROCO_ROAD, ROCO_RAILROAD, ROCO_RIVER, ROCO_NONE };

/*
 * Maximum number of trade routes a city can have in any situation.
 * Changing this changes network protocol.
 */
#define MAX_TRADE_ROUTES        20

/* Used in the network protocol. */
#define SPECENUM_NAME goods_selection_method
#define SPECENUM_VALUE0 GSM_LEAVING
#define SPECENUM_VALUE0NAME "Leaving"
#define SPECENUM_VALUE1 GSM_ARRIVAL
#define SPECENUM_VALUE1NAME "Arrival"
#include "specenum_gen.h"

enum victory_condition_type
{
  VC_SPACERACE = 0,
  VC_ALLIED,
  VC_CULTURE
};

enum environment_upset_type
{
  EUT_GLOBAL_WARMING = 0,
  EUT_NUCLEAR_WINTER
};

enum revolen_type {
  REVOLEN_FIXED = 0,
  REVOLEN_RANDOM,
  REVOLEN_QUICKENING,
  REVOLEN_RANDQUICK
};

enum happyborders_type {
  HB_DISABLED = 0,
  HB_NATIONAL,
  HB_ALLIANCE
};

/* Used in network protocol. */
enum spaceship_place_type {
  SSHIP_PLACE_STRUCTURAL,
  SSHIP_PLACE_FUEL,
  SSHIP_PLACE_PROPULSION,
  SSHIP_PLACE_HABITATION,
  SSHIP_PLACE_LIFE_SUPPORT,
  SSHIP_PLACE_SOLAR_PANELS
};

/* Used in the network protocol. */
#define SPECENUM_NAME tech_cost_style
#define SPECENUM_VALUE0 TECH_COST_CIV1CIV2
#define SPECENUM_VALUE0NAME "Civ I|II"
#define SPECENUM_VALUE1 TECH_COST_CLASSIC
#define SPECENUM_VALUE1NAME "Classic"
#define SPECENUM_VALUE2 TECH_COST_CLASSIC_PRESET
#define SPECENUM_VALUE2NAME "Classic+"
#define SPECENUM_VALUE3 TECH_COST_EXPERIMENTAL
#define SPECENUM_VALUE3NAME "Experimental"
#define SPECENUM_VALUE4 TECH_COST_EXPERIMENTAL_PRESET
#define SPECENUM_VALUE4NAME "Experimental+"
#define SPECENUM_VALUE5 TECH_COST_LINEAR
#define SPECENUM_VALUE5NAME "Linear"
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME tech_leakage_style
#define SPECENUM_VALUE0 TECH_LEAKAGE_NONE
#define SPECENUM_VALUE0NAME "None"
#define SPECENUM_VALUE1 TECH_LEAKAGE_EMBASSIES
#define SPECENUM_VALUE1NAME "Embassies"
#define SPECENUM_VALUE2 TECH_LEAKAGE_PLAYERS
#define SPECENUM_VALUE2NAME "All Players"
#define SPECENUM_VALUE3 TECH_LEAKAGE_NO_BARBS
#define SPECENUM_VALUE3NAME "Normal Players"
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME gold_upkeep_style
#define SPECENUM_VALUE0 GOLD_UPKEEP_CITY
#define SPECENUM_VALUE0NAME "City"
#define SPECENUM_VALUE1 GOLD_UPKEEP_MIXED
#define SPECENUM_VALUE1NAME "Mixed"
#define SPECENUM_VALUE2 GOLD_UPKEEP_NATION
#define SPECENUM_VALUE2NAME "Nation"
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME vision_layer
#define SPECENUM_VALUE0 V_MAIN
#define SPECENUM_VALUE0NAME "Main"
#define SPECENUM_VALUE1 V_INVIS
#define SPECENUM_VALUE1NAME "Stealth"
#define SPECENUM_VALUE2 V_SUBSURFACE
#define SPECENUM_VALUE2NAME "Subsurface"
#define SPECENUM_COUNT V_COUNT
#include "specenum_gen.h"

typedef float adv_want;
#define ADV_WANT_PRINTF "%f"

/* Used in the network protocol. */
#define SPECENUM_NAME setting_default_level
#define SPECENUM_VALUE0 SETDEF_INTERNAL
#define SPECENUM_VALUE0NAME "Internal"
#define SPECENUM_VALUE1 SETDEF_RULESET
#define SPECENUM_VALUE1NAME "Ruleset"
#define SPECENUM_VALUE2 SETDEF_CHANGED
#define SPECENUM_VALUE2NAME "Changed"
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME capital_type
#define SPECENUM_VALUE0 CAPITAL_NOT
#define SPECENUM_VALUE0NAME "Not"
#define SPECENUM_VALUE1 CAPITAL_SECONDARY
#define SPECENUM_VALUE1NAME "Secondary"
#define SPECENUM_VALUE2 CAPITAL_PRIMARY
#define SPECENUM_VALUE2NAME "Primary"
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME wonder_visib_type
#define SPECENUM_VALUE0 WV_ALWAYS
#define SPECENUM_VALUE0NAME "Always"
#define SPECENUM_VALUE1 WV_NEVER
#define SPECENUM_VALUE1NAME "Never"
#define SPECENUM_VALUE2 WV_EMBASSY
#define SPECENUM_VALUE2NAME "Embassy"
#include "specenum_gen.h"

/* Used in the network protocol. */
#define SPECENUM_NAME transp_def_type
#define SPECENUM_VALUE0 TDT_ALIGHT
#define SPECENUM_VALUE0NAME "Alight"
#define SPECENUM_VALUE1 TDT_BLOCKED
#define SPECENUM_VALUE1NAME "Blocked"
#include "specenum_gen.h"

#ifdef __cplusplus
}
#endif /* __cplusplus */

#endif /* FC__FC_TYPES_H */
