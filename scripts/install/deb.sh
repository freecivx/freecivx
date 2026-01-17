#!/bin/bash

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

echo "==== Installing Node.js ===="
# Check if npm is available, if not install it
if ! command -v npm >/dev/null ; then
  if [ "${INSTALLED_NODEJS}" = N ]; then
    NODE_MAJOR=20
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
    sudo ${APT_GET} update
    sudo ${APT_GET} install --no-install-recommends nodejs npm
  else
    sudo ${APT_GET} install --no-install-recommends npm
  fi
fi

# Install node-opener if available
if apt-get --simulate install node-opener &> /dev/null ; then
  sudo ${APT_GET} install --no-install-recommends node-opener
fi

# Populate ~/.config with current user
npm help > /dev/null

export MESON_VER="0.60.3"

echo "==== Installing Meson ===="
if ! sudo ${APT_GET} satisfy "meson (>= ${MESON_VER})" ; then
  ext_install_meson
fi

