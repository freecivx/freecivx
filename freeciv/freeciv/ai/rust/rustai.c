/***********************************************************************
 Freeciv - Copyright (C) 1996 - A Kjeldberg, L Gregersen, P Unold
   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; either version 2, or (at your option)
   any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.
***********************************************************************/

/*
 * This is the Rust AI module for Freeciv. It wraps the default AI
 * implementation and provides a foundation for porting AI logic to Rust.
 */

#ifdef HAVE_CONFIG_H
#include <fc_config.h>
#endif

/* common */
#include "ai.h"
#include "city.h"
#include "map.h"
#include "player.h"

/* server/advisors */
#include "advdata.h"

/* ai/default */
#include "aiferry.h"
#include "aihand.h"
#include "aitools.h"
#include "daicity.h"
#include "daidata.h"
#include "daidiplomacy.h"
#include "daidomestic.h"
#include "dailog.h"
#include "daimilitary.h"
#include "daiplayer.h"
#include "daisettler.h"
#include "daiunit.h"

/* Rust FFI declarations */
extern void *rust_ai_player_init(int player_id);
extern void rust_ai_player_free(void *data);
extern int rust_ai_get_aggression(void *data);
extern void rust_ai_set_aggression(void *data, int level);
extern void rust_ai_log(const char *message);
extern int rust_ai_evaluate_tile(int x, int y, int terrain_type);
extern const char *rust_ai_get_version(void);

const char *fc_ai_rust_capstr(void);
bool fc_ai_rust_setup(struct ai_type *ai);

static struct ai_type *self = NULL;

/**********************************************************************//**
  Set pointer to ai type of the rust ai.
**************************************************************************/
static void rust_ai_set_self(struct ai_type *ai)
{
  self = ai;
}

/**********************************************************************//**
  Get pointer to ai type of the rust ai.
**************************************************************************/
static struct ai_type *rust_ai_get_self(void)
{
  return self;
}

/**********************************************************************//**
  Return module capability string
**************************************************************************/
const char *fc_ai_rust_capstr(void)
{
  return FC_AI_MOD_CAPSTR;
}

/**********************************************************************//**
  Free resources allocated by the rust AI module
**************************************************************************/
static void rai_module_close(void)
{
  struct ai_type *rait = rust_ai_get_self();

  FC_FREE(rait->private);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_player_alloc(struct player *pplayer)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_player_alloc(rait, pplayer);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_player_free(struct player *pplayer)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_player_free(rait, pplayer);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_player_save_relations(struct player *pplayer,
                                      struct player *other,
                                      struct section_file *file,
                                      int plrno)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_player_save_relations(rait, "ai", pplayer, other, file, plrno);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_player_load_relations(struct player *pplayer,
                                      struct player *other,
                                      const struct section_file *file,
                                      int plrno)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_player_load_relations(rait, "ai", pplayer, other, file, plrno);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_gained_control(struct player *pplayer)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_gained_control(rait, pplayer);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_split_by_civil_war(struct player *original,
                                   struct player *created)
{
  struct ai_type *rait = rust_ai_get_self();

  /* Only assess danger for the original player, which is what Classic AI does */
  dai_assess_danger_player(rait, original, &(wld.map));
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_created_by_civil_war(struct player *original,
                                     struct player *created)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_player_copy(rait, original, created);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_data_phase_begin(struct player *pplayer, bool is_new_phase)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_data_phase_begin(rait, pplayer, is_new_phase);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_data_phase_finished(struct player *pplayer)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_data_phase_finished(rait, pplayer);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_city_alloc(struct city *pcity)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_city_alloc(rait, pcity);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_city_free(struct city *pcity)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_city_free(rait, pcity);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_city_save(struct section_file *file, const struct city *pcity,
                          const char *citystr)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_city_save(rait, "ai", file, pcity, citystr);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_city_load(const struct section_file *file, struct city *pcity,
                          const char *citystr)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_city_load(rait, "ai", file, pcity, citystr);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_build_adv_override(struct city *pcity, struct adv_choice *choice)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_build_adv_override(rait, pcity, choice);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_wonder_city_distance(struct player *pplayer, struct adv_data *adv)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_wonder_city_distance(rait, pplayer, adv);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_build_adv_init(struct player *pplayer)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_build_adv_init(rait, pplayer);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_build_adv_adjust(struct player *pplayer, struct city *wonder_city)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_build_adv_adjust(rait, pplayer, wonder_city);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_gov_value(struct player *pplayer, struct government *gov,
                         adv_want *val, bool *override)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_gov_value(rait, pplayer, gov, val, override);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_units_ruleset_init(void)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_units_ruleset_init(rait);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_units_ruleset_close(void)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_units_ruleset_close(rait);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_unit_init(struct unit *punit)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_unit_init(rait, punit);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_unit_close(struct unit *punit)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_unit_close(rait, punit);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_ferry_init_ferry(struct unit *ferry)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_ferry_init_ferry(rait, ferry);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_ferry_lost(struct unit *punit)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_ferry_lost(rait, punit);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_ferry_transformed(struct unit *ferry,
                                 const struct unit_type *old_type)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_ferry_transformed(rait, ferry, old_type);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_unit_turn_end(struct unit *punit)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_unit_turn_end(rait, punit);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_unit_move_or_attack(struct unit *punit,
                                    struct tile *ptile,
                                    struct pf_path *path,
                                    int step)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_unit_move_or_attack(rait, punit, ptile, path, step);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_unit_new_adv_task(struct unit *punit,
                                  enum adv_unit_task task,
                                  struct tile *ptile)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_unit_new_adv_task(rait, punit, task, ptile);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_unit_save(struct section_file *file,
                          const struct unit *punit,
                          const char *unitstr)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_unit_save(rait, "", file, punit, unitstr);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_unit_load(const struct section_file *file,
                          struct unit *punit,
                          const char *unitstr)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_unit_load(rait, "", file, punit, unitstr);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_auto_settler_reset(struct player *pplayer)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_auto_settler_reset(rait, pplayer);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_auto_settler_run(struct player *pplayer,
                                struct unit *punit,
                                struct settlermap *state)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_auto_settler_run(rait, pplayer, punit, state);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_auto_settler_cont(struct player *pplayer,
                                  struct unit *punit,
                                  struct settlermap *state)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_auto_settler_cont(rait, pplayer, punit, state);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_switch_to_explore(struct unit *punit, struct tile *target,
                                  enum override_bool *allow)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_switch_to_explore(rait, punit, target, allow);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_do_first_activities(struct player *pplayer)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_do_first_activities(rait, pplayer);
}

/**********************************************************************//**
  Restart phase - set phase done flag.
  Unlike first_activities, this just marks the phase as done.
**************************************************************************/
static void rai_restart_phase(struct player *pplayer)
{
  pplayer->ai_phase_done = TRUE;
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_diplomacy_actions(struct player *pplayer)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_diplomacy_actions(rait, pplayer);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_do_last_activities(struct player *pplayer)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_do_last_activities(rait, pplayer);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_treaty_evaluate(struct player *pplayer,
                                struct player *aplayer,
                                struct Treaty *ptreaty)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_treaty_evaluate(rait, pplayer, aplayer, ptreaty);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_treaty_accepted(struct player *pplayer,
                                struct player *aplayer,
                                struct Treaty *ptreaty)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_treaty_accepted(rait, pplayer, aplayer, ptreaty);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_diplomacy_first_contact(struct player *pplayer,
                                        struct player *aplayer)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_diplomacy_first_contact(rait, pplayer, aplayer);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_incident(enum incident_type type, struct player *violator,
                         struct player *victim)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_incident(rait, type, violator, victim);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_city_log(char *buffer, int buflength,
                         const struct city *pcity)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_city_log(rait, buffer, buflength, pcity);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_unit_log(char *buffer, int buflength,
                         const struct unit *punit)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_unit_log(rait, buffer, buflength, punit);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_consider_plr_dangerous(struct player *plr1,
                                       struct player *plr2,
                                       enum override_bool *result)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_consider_plr_dangerous(rait, plr1, plr2, result);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_consider_tile_dangerous(struct tile *ptile,
                                        struct unit *punit,
                                        enum override_bool *result)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_consider_tile_dangerous(rait, ptile, punit, result);
}

/**********************************************************************//**
  Call default ai with rust ai type as parameter.
**************************************************************************/
static void rai_consider_wonder_city(struct city *pcity, bool *result)
{
  struct ai_type *rait = rust_ai_get_self();

  dai_consider_wonder_city(rait, pcity, result);
}

/**********************************************************************//**
  Setup player ai_funcs function pointers.
**************************************************************************/
bool fc_ai_rust_setup(struct ai_type *ai)
{
  const char *version;
  
  strncpy(ai->name, "rust", sizeof(ai->name));

  rust_ai_set_self(ai);

  /* Log Rust AI initialization */
  version = rust_ai_get_version();
  rust_ai_log("Initializing Rust AI module");
  if (version) {
    rust_ai_log(version);
  }

  ai->funcs.module_close = rai_module_close;

  ai->funcs.player_alloc = rai_player_alloc;
  ai->funcs.player_free = rai_player_free;
  ai->funcs.player_save_relations = rai_player_save_relations;
  ai->funcs.player_load_relations = rai_player_load_relations;
  ai->funcs.gained_control = rai_gained_control;
  ai->funcs.split_by_civil_war = rai_split_by_civil_war;
  ai->funcs.created_by_civil_war = rai_created_by_civil_war;

  ai->funcs.phase_begin = rai_data_phase_begin;
  ai->funcs.phase_finished = rai_data_phase_finished;

  ai->funcs.city_alloc = rai_city_alloc;
  ai->funcs.city_free = rai_city_free;
  ai->funcs.city_save = rai_city_save;
  ai->funcs.city_load = rai_city_load;

  ai->funcs.choose_building = rai_build_adv_override;
  ai->funcs.build_adv_prepare = rai_wonder_city_distance;
  ai->funcs.build_adv_init = rai_build_adv_init;
  ai->funcs.build_adv_adjust_want = rai_build_adv_adjust;

  ai->funcs.gov_value = rai_gov_value;

  ai->funcs.units_ruleset_init = rai_units_ruleset_init;
  ai->funcs.units_ruleset_close = rai_units_ruleset_close;

  ai->funcs.unit_alloc = rai_unit_init;
  ai->funcs.unit_free = rai_unit_close;
  ai->funcs.unit_got = rai_ferry_init_ferry;
  ai->funcs.unit_lost = rai_ferry_lost;
  ai->funcs.unit_transformed = rai_ferry_transformed;

  ai->funcs.unit_turn_end = rai_unit_turn_end;
  ai->funcs.unit_move = rai_unit_move_or_attack;
  ai->funcs.unit_task = rai_unit_new_adv_task;
  ai->funcs.unit_save = rai_unit_save;
  ai->funcs.unit_load = rai_unit_load;

  ai->funcs.settler_reset = rai_auto_settler_reset;
  ai->funcs.settler_run = rai_auto_settler_run;
  ai->funcs.settler_cont = rai_auto_settler_cont;
  ai->funcs.want_to_explore = rai_switch_to_explore;

  ai->funcs.first_activities = rai_do_first_activities;
  ai->funcs.restart_phase = rai_restart_phase;
  ai->funcs.diplomacy_actions = rai_diplomacy_actions;
  ai->funcs.last_activities = rai_do_last_activities;

  ai->funcs.treaty_evaluate = rai_treaty_evaluate;
  ai->funcs.treaty_accepted = rai_treaty_accepted;
  ai->funcs.first_contact = rai_diplomacy_first_contact;
  ai->funcs.incident = rai_incident;

  ai->funcs.log_fragment_city = rai_city_log;
  ai->funcs.log_fragment_unit = rai_unit_log;

  ai->funcs.consider_plr_dangerous = rai_consider_plr_dangerous;
  ai->funcs.consider_tile_dangerous = rai_consider_tile_dangerous;
  ai->funcs.consider_wonder_city = rai_consider_wonder_city;

  return TRUE;
}
