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

/* This header is generated from gen_headers/meson_freeciv_config.h.in.
 * It contains values to specific freeciv build, but only such
 * values that should not conflict with configuration headers from
 * other, typically autotools based, projects. This is meant to be usable
 * for external projects building against some freeciv components. */

/* This header file is shipped in some binary distributions.
 * It is included purely for reference as to how the executables were built,
 * and changing it will have no functional effect on pre-built binaries. */

#ifndef FC__FREECIV_CONFIG_H
#define FC__FREECIV_CONFIG_H

/* Is this freeciv-web instead of regular build */
#define FREECIV_WEB 1

/* Version tag to follow */
/* #undef FOLLOWTAG */

/* nullptr available at C */
/* #undef FREECIV_HAVE_C23_NULLPTR */

/* nullptr available at C++ */
#define FREECIV_HAVE_CXX_NULLPTR 1

/* C++20 capture this supported */
#define FREECIV_HAVE_CXX20_CAPTURE_THIS 1

/* __builtin_unreachable() available */
#define FREECIV_HAVE_UNREACHABLE 1

/* Use pthreads as thread implementation */
#define FREECIV_HAVE_PTHREAD 1

/* Use tinycthread as thread implementation */
/* #undef FREECIV_HAVE_TINYCTHR */

/* Has thread condition variable implementation */
#define FREECIV_HAVE_THREAD_COND

/* Max number of AI modules */
#define FREECIV_AI_MOD_LAST 3

/* Have socklen_t type defined */
#define FREECIV_HAVE_SOCKLEN_T

/* Location for freeciv to store its information */
#define FREECIV_STORAGE_DIR "~/.freeciv"

/* Metaserver URL */
#define FREECIV_META_URL "https://meta.freeciv.org/metaserver.php"

#ifndef __EMSCRIPTEN__
#define FREECIV_META_ENABLED
#endif /* __EMSCRIPTEN__ */

/* Default modpack list URL */
/* #undef MODPACK_LIST_URL */

/* IPv6 Support built in */
#define FREECIV_IPV6_SUPPORT 1

/* MS Windows host */
/* #undef FREECIV_MSWINDOWS */

/* Native language support enabled */
/* #undef FREECIV_ENABLE_NLS */

/* This is crosser-based build */
/* #undef FREECIV_CROSSER */

/* MagickWand version 7 API in use */
/* #undef FREECIV_MWAND7 */

/* Produce debug version */
#define FREECIV_DEBUG 1

/* Testmatic integration enabled */
/* #undef FREECIV_TESTMATIC */

/* Winsock available */
/* #undef FREECIV_HAVE_WINSOCK */

/* locale.h available */
#define FREECIV_HAVE_LOCALE_H 1

/* libintl.h available */
#define FREECIV_HAVE_LIBINTL_H 1

/* inttypes.h available */
#define FREECIV_HAVE_INTTYPES_H 1

/* stdint.h available */
#define FREECIV_HAVE_STDINT_H 1

/* ws2tcpip.h available */
/* #undef FREECIV_HAVE_WS2TCPIP_H */

/* sys/types.h available */
#define FREECIV_HAVE_SYS_TYPES_H 1

/* unistd.h available */
#define FREECIV_HAVE_UNISTD_H 1

/* sys/time.h available */
#define FREECIV_HAVE_SYS_TIME_H 1

/* sys/socket.h available */
#define FREECIV_HAVE_SYS_SOCKET_H 1

/* sys/select.h available */
#define FREECIV_HAVE_SYS_SELECT_H 1

/* netinet/in.h available */
#define FREECIV_HAVE_NETINET_IN_H 1

/* dirent.h available */
#define FREECIV_HAVE_DIRENT_H 1

/* stdbool.h available */
#define FREECIV_HAVE_STDBOOL_H 1

/* Readline support */
#define FREECIV_HAVE_LIBREADLINE 1

/* liblzma is available */
#define FREECIV_HAVE_LIBLZMA 1

/* libzstd is available */
#define FREECIV_HAVE_LIBZSTD 1

/* winsock2.h available */
/* #undef FREECIV_HAVE_WINSOCK2_H */

#ifdef FREECIV_HAVE_WINSOCK2_H
#define FREECIV_HAVE_WINSOCK2 1
#endif

/* socket zero isn't same as stdin */
/* #undef FREECIV_SOCKET_ZERO_NOT_STDIN */

/* jansson network protocol in use */
#define FREECIV_JSON_CONNECTION 1

/* Json Connection TCP Port; Default of the raw-protocol + 1000 */
#define FREECIV_JSON_PORT 6556

/* Delta protocol enabled */
/* #undef FREECIV_DELTA_PROTOCOL */

#endif /* FC__FREECIV_CONFIG_H */
