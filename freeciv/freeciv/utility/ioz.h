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

#ifndef FC__IOZ_H
#define FC__IOZ_H

#ifdef __cplusplus
extern "C" {
#endif /* __cplusplus */

/********************************************************************** 
  An IO layer to support transparent compression/uncompression.
  (Currently only "required" functionality is supported.)
***********************************************************************/

#include <stdio.h>		/* FILE */

#include <freeciv_config.h>

#include "shared.h"		/* fc__attribute */

struct fz_FILE_s;		  /* opaque */
typedef struct fz_FILE_s fz_FILE;

/* (Possibly) supported methods (depending on freeciv_config.h). */
enum fz_method {
  FZ_PLAIN = 0,
#ifdef FREECIV_HAVE_LIBZ
  FZ_ZLIB,
#endif
#ifdef FREECIV_HAVE_LIBLZMA
  FZ_XZ,
#endif
#ifdef FREECIV_HAVE_LIBZSTD
  FZ_ZSTD,
#endif
  /* Deprecated FZ_BZIP2 moved last, so getting NULL setting name for it
   * won't terminate some iterations in the middle of the valid values. */
#ifdef FREECIV_HAVE_LIBBZ2
  FZ_BZIP2,
#endif
};

fz_FILE *fz_from_file(const char *filename, const char *in_mode,
                      enum fz_method method, int compress_level);
fz_FILE *fz_from_stream(FILE *stream);
fz_FILE *fz_from_memory(char *buffer, int size, bool control);
int fz_fclose(fz_FILE *fp);
char *fz_fgets(char *buffer, int size, fz_FILE *fp);
int fz_fprintf(fz_FILE *fp, const char *format, ...)
     fc__attribute((__format__ (__printf__, 2, 3)));

int fz_ferror(fz_FILE *fp);     
const char *fz_strerror(fz_FILE *fp);

#ifdef __cplusplus
}
#endif /* __cplusplus */

#endif  /* FC__IOZ_H */
