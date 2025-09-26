# Check for the presence of C99 features. Generally the check will fail
# if the feature isn't present (a C99 compiler isn't that much to ask,
# right?).

# Check C99-style variadic macros (required):
#
#  #define PRINTF(msg, ...) (printf(msg, __VA_ARGS__)
#
AC_DEFUN([FC_C99_VARIADIC_MACROS],
[
  dnl Check for variadic macros
  AC_CACHE_CHECK([for C99 variadic macros],
    [ac_cv_c99_variadic_macros],
     [AC_COMPILE_IFELSE([AC_LANG_PROGRAM([[#include <stdio.h>
           #define MSG(...) fprintf(stderr, __VA_ARGS__)
          ]], [[MSG("foo");
           MSG("%s", "foo");
           MSG("%s%d", "foo", 1);]])],[ac_cv_c99_variadic_macros=yes],[ac_cv_c99_variadic_macros=no])])
  if test "x${ac_cv_c99_variadic_macros}" != "xyes"; then
    AC_MSG_ERROR([A compiler supporting C99 variadic macros is required])
  fi
])


# Check C99-style variable-sized arrays (required)
# We don't use AC_C_VARARRAYS() as it's stricter than what we need
# and want - it would leave out compilers that are just fine for freeciv
# compilation.
#
#   char concat_str[strlen(s1) + strlen(s2) + 1];
#
AC_DEFUN([FC_C99_VARIABLE_ARRAYS],
[
  dnl Check for variable arrays
  AC_CACHE_CHECK([for C99 variable arrays],
    [ac_cv_c99_variable_arrays],
    [AC_COMPILE_IFELSE([AC_LANG_PROGRAM([[
#include <string.h>
#include <stdio.h>
]], [[char *s1 = "foo", *s2 = "bar";
         char s3[strlen(s1) + strlen(s2) + 1];
         sprintf(s3, "%s%s", s1, s2);]])],[ac_cv_c99_variable_arrays=yes],[ac_cv_c99_variable_arrays=no])])
  if test "x${ac_cv_c99_variable_arrays}" != "xyes"; then
    AC_MSG_ERROR([A compiler supporting C99 variable arrays is required])
  fi
])

# Check C99-style initializers (required):
#
# Examples:
#   struct timeval tv = {.tv_sec = 0, .tv_usec = 500000};
#   int fibonacci[6] = {[0] = 0, [1] = 1, [2] = 1, [3] = 2, [4] = 3, [5] = 5};
# Note we do not check for multi-field initializers like
#   struct { struct { int b; } a; } = {.a.b = 5}
# which are not supported by many compilers.  It is best to avoid this
# problem by writing these using nesting.  The above case becomes
#   struct { struct { int b; } a; } = {.a = {.b = 5}}
AC_DEFUN([FC_C99_INITIALIZERS],
[
  dnl Check for C99 initializers
  AC_CACHE_CHECK([for C99 initializers],
    [ac_cv_c99_initializers],
    [AC_COMPILE_IFELSE([AC_LANG_PROGRAM([[struct foo {
           int an_integer;
           char *a_string;
           int an_array[5];
           union {int x, y;} a_union;
         };
        ]], [[struct foo bar = {.an_array = {0, [3] = 2, [2] = 1, [4] = 3},
                           .an_integer = 999,
                           .a_string = "does it work?",
                           .a_union = {.y = 243}};]])],[ac_cv_c99_initializers=yes],[ac_cv_c99_initializers=no])])
  if test "${ac_cv_c99_initializers}" != "yes"; then
    AC_MSG_ERROR([A compiler supporting C99 initializers is required])
  fi
])

# Check C99-style compound literals (required):
#
AC_DEFUN([FC_C99_COMPOUND_LITERALS],
[
  dnl Check for C99 compound literals
  AC_CACHE_CHECK([for C99 compound literals],
    [ac_cv_c99_compound_literals],
    [AC_COMPILE_IFELSE([AC_LANG_PROGRAM([[struct foo {
           int a; char *b; float c; };
           void foobar(struct foo *);
         ]],
         [[struct foo bar;
           bar = (struct foo) {.b = "text", .c = 0.1 };
           foobar(&bar);]])], [ac_cv_c99_compound_literals=yes],
          [ac_cv_c99_compound_literals=no])])
  if test "${ac_cv_c99_compound_literals}" != "yes"; then
    AC_MSG_ERROR([A compiler supporting C99 compound literals is required])
  fi
])

# Check C99-style stdint.h (required)
AC_DEFUN([FC_C99_STDINT_H],
[
  AC_CHECK_HEADERS([stdint.h])
  dnl Check for C99 stdint.h
  AC_CACHE_CHECK([for C99 stdint.h],
    [ac_cv_c99_stdint_h],
    [ac_cv_c99_stdint_h=$ac_cv_header_stdint_h])
  if test "${ac_cv_c99_stdint_h}" != "yes"; then
    AC_MSG_ERROR([A compiler supporting C99's stdint.h is required])
  fi
])

# Check that token concenation works as we expect
#
AC_DEFUN([FC_C99_TOKEN_CONCENATION],
[
AC_CACHE_CHECK([whether preprocessor token concenation works],
  [ac_cv_c99_token_concenation],
  [AC_COMPILE_IFELSE([AC_LANG_PROGRAM([[#define COMBINE(a, b) a ## b
  #define CALLER(...) COMBINE(, __VA_ARGS__)]],
    [[CALLER();
    char *text = CALLER("string");]])],
  [ac_cv_c99_token_concenation=yes],[ac_cv_c99_token_concenation=no])])
  if test "x${ac_cv_c99_token_concenation}" != "xyes" ; then
    AC_MSG_ERROR([A preprocessor supporting token concenation is required])
  fi
])

AC_DEFUN([FC_C99_VA_COPY],
[
dnl Check for C99 va_copy()
AC_CACHE_CHECK([for C99 va_copy],
  [ac_cv_c99_va_copy],
  [AC_COMPILE_IFELSE([AC_LANG_PROGRAM([[#include <stdarg.h>]],
     [[va_list orig;
       va_list copy;
       va_copy(copy, orig);]])],
  [ac_cv_c99_va_copy=yes], [ac_cv_c99_va_copy=no])])
  if test "x${ac_cv_c99_va_copy}" = "xyes" ; then
    AC_DEFINE([HAVE_VA_COPY], [1], [va_copy() available])
  else
    AC_MSG_WARN([lack of va_copy() support is going to be mandatory soon])
  fi
])
