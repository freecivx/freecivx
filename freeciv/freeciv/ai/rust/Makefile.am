## Process this file with automake to produce Makefile.in

if AI_MOD_STATIC_RUST
noinst_LTLIBRARIES = librustai.la
else
aimodule_LTLIBRARIES = fc_ai_rust.la
endif

AM_CPPFLAGS = \
	-I$(top_srcdir)/utility \
	-I$(top_srcdir)/common \
	-I$(top_srcdir)/common/networking \
	-I$(top_srcdir)/dependencies/tinycthread

if AI_MOD_STATIC_RUST
librustai_la_SOURCES = rustai.c
else
fc_ai_rust_la_SOURCES = rustai.c
fc_ai_rust_la_LDFLAGS = -module
endif
