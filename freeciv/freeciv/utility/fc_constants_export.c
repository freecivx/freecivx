/***********************************************************************
 Freeciv - Copyright (C) 2024 - The Freeciv Project
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
 * fc_constants_export: A utility to export Freeciv C constants as JSON
 * 
 * This program outputs Freeciv constants (enums, #defines) in JSON format
 * so they can be consumed by build tools like gen_fc_types.py to generate
 * JavaScript constants without hardcoding values.
 *
 * Usage: ./fc_constants_export > constants.json
 */

#ifdef HAVE_CONFIG_H
#include <freeciv_config.h>
#endif

#include <stdio.h>

/* utility */
#include "shared.h"

/* common */
#include "fc_types.h"

static void print_json_header(void)
{
  printf("{\n");
  printf("  \"_comment\": \"Freeciv C constants exported by fc_constants_export\",\n");
  printf("  \"constants\": {\n");
}

static void print_json_footer(void)
{
  printf("  }\n");
  printf("}\n");
}

static int first_constant = 1;

static void print_constant(const char *name, int value)
{
  if (!first_constant) {
    printf(",\n");
  }
  printf("    \"%s\": %d", name, value);
  first_constant = 0;
}

static void export_fc_tristate(void)
{
  print_constant("TRI_NO", (int)TRI_NO);
  print_constant("TRI_YES", (int)TRI_YES);
  print_constant("TRI_MAYBE", (int)TRI_MAYBE);
}

static void export_defines(void)
{
  print_constant("FC_INFINITY", FC_INFINITY);
  print_constant("MAX_LEN_ADDR", MAX_LEN_ADDR);
  print_constant("MAX_LEN_PATH", MAX_LEN_PATH);
}

static void export_identity_numbers(void)
{
  print_constant("IDENTITY_NUMBER_ZERO", IDENTITY_NUMBER_ZERO);
}

int main(int argc, char *argv[])
{
  print_json_header();
  
  /* Export simple defines */
  export_defines();
  
  /* Export enums */
  export_fc_tristate();
  export_identity_numbers();
  
  printf("\n");
  print_json_footer();
  
  return 0;
}
