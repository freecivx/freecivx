## Process this file with automake to produce Makefile.in

if AI_MOD_STATIC_RUST
noinst_LTLIBRARIES = librustai.la
else
aimodule_LTLIBRARIES = fc_ai_rust.la
endif

AM_CPPFLAGS = \
	-I$(top_srcdir)/utility \
	-I$(top_srcdir)/common \
	-I$(top_srcdir)/common/aicore \
	-I$(top_srcdir)/common/networking \
	-I$(top_srcdir)/server \
	-I$(top_srcdir)/server/advisors \
	-I$(top_srcdir)/ai/default \
	-I$(top_srcdir)/dependencies/tinycthread

# Build Rust library before C code
RUST_TARGET = target/release/librustai.a

$(RUST_TARGET):
	@echo "============================================"
	@echo "Compiling Freeciv Rust Deity AI"
	@rustc --version || echo "Rust not found"
	@cargo --version || echo "Cargo not found"
	@echo "============================================"
	cd $(srcdir) && cargo build --release

if AI_MOD_STATIC_RUST
librustai_la_SOURCES = rustai.c
librustai_la_LIBADD = $(RUST_TARGET)
librustai_la_DEPENDENCIES = $(RUST_TARGET)
else
fc_ai_rust_la_SOURCES = rustai.c
fc_ai_rust_la_LDFLAGS = -module
fc_ai_rust_la_LIBADD = $(RUST_TARGET)
fc_ai_rust_la_DEPENDENCIES = $(RUST_TARGET)
endif

# Clean Rust build artifacts
clean-local:
	cd $(srcdir) && cargo clean || true

