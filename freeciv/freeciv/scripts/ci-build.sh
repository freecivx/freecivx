#!/bin/bash
#
# Freeciv CI Script
#
# https://github.com/freeciv/freeciv/actions
echo "Running CI job $1 for Freeciv."
basedir=$(pwd)
logfile="${basedir}/freeciv-CI.log"


# Redirect copy of output to a log file.
exec > >(tee ${logfile})
exec 2>&1
set -e

uname -a

case $1 in
"dist")
mkdir build
cd build
../autogen.sh \
 || (let config_exit_status=$? \
     && echo "Config exit status: $config_exit_status" \
     && cat config.log \
     && exit $config_exit_status)
make -s -j$(nproc) distcheck
echo "Freeciv distribution check successful!"
;;

"meson")

# Minimum version to have Qt6 detection actually working
FC_MESON_VER="0.62.2"
if test "$FC_MESON_VER" != "" ; then
  mkdir meson-install
  cd meson-install
  wget "https://github.com/mesonbuild/meson/releases/download/${FC_MESON_VER}/meson-${FC_MESON_VER}.tar.gz"
  tar xzf "meson-${FC_MESON_VER}.tar.gz"
  ln -s meson.py "meson-${FC_MESON_VER}/meson"
  export PATH="$(pwd)/meson-${FC_MESON_VER}:$PATH"
  cd ..
fi

mkdir build
cd build
meson setup .. \
  -Dprefix=${HOME}/freeciv/meson \
  -Ddebug=true \
  -Dclients='gtk3.22','qt','sdl2','gtk4','stub' \
  -Dfcmp='gtk3','qt','cli','gtk4' \
  -Dqtver=qt6
ninja
ninja install
;;

"os_x")
# gcc is an alias for clang on OS X

export PATH="$(brew --prefix llvm)/bin:$(brew --prefix gettext)/bin:$(brew --prefix icu4c)/bin:$(brew --prefix qt@6)/bin:$(brew --prefix mysql-client)/bin:$PATH"
export CPPFLAGS="-I$(brew --prefix gettext)/include -I$(brew --prefix icu4c)/include -I$(brew --prefix qt@6)/include -I$(brew --prefix readline)/include -I$(brew --prefix unixodbc)/include"
export LDFLAGS="-L$(brew --prefix gettext)/lib -L$(brew --prefix icu4c)/lib -L$(brew --prefix qt@6)/lib -L$(brew --prefix readline)/lib -L$(brew --prefix unixodbc)/lib"
export PKG_CONFIG_PATH="$(brew --prefix icu4c)/lib/pkgconfig"

export MOCCMD=$(find /usr/local/Cellar/qt -name "moc" | head -n 1)

mkdir build
cd build
../autogen.sh --no-configure-run
../configure \
 CC="clang" CXX="clang++" \
 --enable-debug \
 --enable-sys-lua --with-qtver=qt6 \
 --enable-client=gtk3.22,sdl2,qt,gtk4 \
 --enable-fcmp=gtk3,gtk4,qt,cli \
 --enable-fcdb=sqlite3,mysql,postgres,odbc \
 --enable-freeciv-manual \
 --with-followtag="macos" \
 --prefix=${HOME}/freeciv/mac-at \
 || (let config_exit_status=$? \
     && echo "Config exit status: $config_exit_status" \
     && cat config.log \
     && exit $config_exit_status)
make -j$(sysctl -n hw.logicalcpu)
make install

echo "Running Freeciv server autogame"
cd ${HOME}/freeciv/mac-at/bin/
./freeciv-server --Announce none -e -F --read ${basedir}/scripts/test-autogame.serv

echo "Freeciv server autogame successful!"
;;

"mac-meson")

export CPPFLAGS="-I$(brew --prefix readline)/include"
export LDFLAGS="-L$(brew --prefix icu4c)/lib -L$(brew --prefix readline)/lib"
export PKG_CONFIG_PATH="$(brew --prefix icu4c)/lib/pkgconfig"

mkdir build
cd build
meson setup .. \
  -Ddebug=true \
  -Druledit=true \
  -Dsyslua=true \
  -Dclients=gtk3.22,sdl2,gtk4,qt,stub \
  -Dfcmp=gtk3,gtk4,qt,cli \
  -Dfollowtag=macos \
  -Dprefix=${HOME}/freeciv/mac-meson \
  || (let meson_exit_status=$? \
      && echo "meson.log:" \
      && cat meson-logs/meson-log.txt \
      && exit $meson_exit_status)
ninja
ninja install

echo "Running Freeciv server autogame"
cd ${HOME}/freeciv/mac-meson/bin/
./freeciv-server --Announce none -e -F --read ${basedir}/scripts/test-autogame.serv

echo "Freeciv server autogame successful!"
;;

"clang_debug")
# Configure and build Freeciv
mkdir build
cd build
../autogen.sh \
 CC="clang" \
 CXX="clang++" \
 --enable-debug \
 --enable-sys-lua \
 --enable-sys-tolua-cmd \
 --disable-fcdb \
 --with-qtver=qt6 \
 --enable-client=gtk3.22,qt,sdl2,gtk4,stub \
 --enable-fcmp=cli,gtk3,qt,gtk4 \
 --enable-fcdb=sqlite3,mysql,postgres,odbc \
 --enable-freeciv-manual \
 --enable-ai-static=classic,tex,stub \
 --prefix=${HOME}/freeciv/clang \
 || (let config_exit_status=$? \
     && echo "Config exit status: $config_exit_status" \
     && cat config.log \
     && exit $config_exit_status)
make -s -j$(nproc)
make install
;;

tcc)

mkdir build
cd build
../autogen.sh \
 CC="tcc" \
 LD="tcc" \
 --enable-debug \
 --enable-client=gtk3.22,stub,gtk4 \
 --enable-fcmp=cli,gtk3,gtk4 \
 --enable-fcdb=sqlite3,mysql,odbc \
 --disable-ruledit \
 --disable-sdl-mixer \
 --prefix=${HOME}/freeciv/tcc \
 || (let config_exit_status=$? \
     && echo "Config exit status: $config_exit_status" \
     && cat config.log \
     && exit $config_exit_status)
make -s -j$(nproc)
make install
echo "Freeciv build successful!"
;;

*)
# Fetch S3_2 in the background for the ruleset upgrade test
git fetch --no-tags --quiet https://github.com/freeciv/freeciv.git S3_2:S3_2 &

# Configure and build Freeciv
mkdir build
cd build
../autogen.sh \
 CFLAGS="-O3" \
 CXXFLAGS="-O3" \
 --with-qtver=qt6 \
 --enable-client=gtk3.22,qt,sdl2,gtk4,stub \
 --enable-fcmp=cli,gtk3,qt,gtk4 \
 --enable-fcdb=sqlite3,mysql,postgres,odbc \
 --enable-freeciv-manual \
 --enable-ruledit=experimental \
 --enable-ai-static=classic,tex,stub \
 --prefix=${HOME}/freeciv/default \
 || (let config_exit_status=$? \
     && echo "Config exit status: $config_exit_status" \
     && cat config.log \
     && exit $config_exit_status)
make -s -j$(nproc)
make install
echo "Freeciv build successful!"

# Check that each ruleset loads
echo "Checking rulesets"
./tests/rulesets_not_broken.sh

# Check ruleset saving
echo "Checking ruleset saving"
./tests/rulesets_save.sh

# Check ruleset upgrade
echo "Ruleset upgrade"
echo "Preparing test data"
../tests/rs_test_res/upgrade_ruleset_sync.bash
echo "Checking ruleset upgrade"
./tests/rulesets_upgrade.sh

# Check ruleset autohelp generation
echo "Checking ruleset auto help generation"
./tests/rulesets_autohelp.sh

echo "Running Freeciv server autogame"
cd ${HOME}/freeciv/default/bin/
./freeciv-server --Announce none -e -F --read ${basedir}/scripts/test-autogame.serv

echo "Freeciv server autogame successful!"
;;
esac
