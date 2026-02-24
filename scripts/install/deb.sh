#   Copyright (C) 2018  The Freeciv-web project
#
#   This program is free software: you can redistribute it and/or modify
#   it under the terms of the GNU Affero General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#
#   This program is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU Affero General Public License for more details.
#
#   You should have received a copy of the GNU Affero General Public License
#   along with this program.  If not, see <http://www.gnu.org/licenses/>.

dependencies="\
  openjdk-21-jdk-headless \
  acl \
  meson \
  wget \
  build-essential \
  curl \
  git \
  gnupg \
  imagemagick \
  libcurl4-openssl-dev \
  libicu-dev \
  libjansson-dev \
  liblzma-dev \
  libmagickcore.*extra \
  libmagickwand-dev \
  libsqlite3-dev \
  libtool \
  maven \
  nodejs \
  default-mysql-server \
  nginx \
  patch \
  pkg-config \
  procps \
  python3-minimal \
  python3-pip \
  python3-setuptools \
  python3-tornado \
  python3-pillow \
  python3-dev \
  python3-wheel \
  sed \
  tar \
  unzip \
  zlib1g-dev \
  rsync \
  websockify \
"

# TODO: Add back python wikipedia package.

INSTALLED_TOMCAT=N
INSTALLED_NODEJS=N
APT_GET='DEBIAN_FRONTEND=noninteractive apt-get -y -qq -o=Dpkg::Use-Pty=0'

sudo ${APT_GET} update

if [ "$DEB_NO_TOMCAT" != "Y" ] && apt-get --simulate install tomcat11 &> /dev/null; then
  dependencies="${dependencies} tomcat11 tomcat11-admin"
  INSTALLED_TOMCAT=Y
else
  INSTALLED_TOMCAT=N
fi

# Install lua-5.4, if available. Otherwise it will be built from the copy
# included with the server.
if apt-get --simulate install liblua5.4-dev &> /dev/null; then
  dependencies="${dependencies} liblua5.4-dev"
fi

echo "==== Installing Dependencies ===="
echo "mysql setup..."
sudo debconf-set-selections <<< "mysql-server mysql-server/root_password password ${DB_ROOT_PASSWORD}"
sudo debconf-set-selections <<< "mysql-server mysql-server/root_password_again password ${DB_ROOT_PASSWORD}"
echo "apt-get install dependencies"
sudo ${APT_GET} install --no-install-recommends ${dependencies}

if [ "${INSTALLED_TOMCAT}" = N ]; then
  ext_install_tomcat11
fi

TMPINSTDIR=$(mktemp -d)

echo "==== Installing Rust and Cargo ===="
if ! command -v rustc &> /dev/null || ! command -v cargo &> /dev/null; then
  echo "Rust not found, installing via rustup..."
  # Note: Using official rustup installation method from https://rustup.rs
  # This is the standard and recommended way to install Rust
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  source "$HOME/.cargo/env"
  echo "Rust and Cargo installed successfully"
else
  echo "Rust and Cargo already installed"
  rustc --version
  cargo --version
fi

