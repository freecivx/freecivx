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

# Installation of out-of-package-manager components

declare -a ext_installed

ext_install_tomcat11 () {
  local TOMCAT_URL
  local TMPFILE

  echo "==== Installing tomcat11 ===="

  TOMCAT_URL=$(curl -LsS 'https://tomcat.apache.org/download-11.cgi' | sed -n 's/^.*href="\([^"]*bin\/apache-tomcat-[0-9.]*tar\.gz\)".*/\1/p' | head -n 1)
  if [ -z "${TOMCAT_URL}" ]; then
    echo >&2 "Couldn't fetch download URL"
    exit 1
  fi

  echo "Downloading tomcat11 from ${TOMCAT_URL}"
  TMPFILE=$(mktemp -t tomcat11.XXXX.tar.gz)
  curl -LsS -o "${TMPFILE}" "${TOMCAT_URL}"

  cd /var/lib
  sudo tar -xzf "${TMPFILE}"
  sudo rm tomcat11 -rf
  sudo mv apache-tomcat-11.* tomcat11
  rm "${TMPFILE}"

  if ! getent group tomcat > /dev/null 2>&1 ; then
    sudo groupadd --system tomcat
  fi
  if ! id tomcat > /dev/null 2>&1 ; then
    sudo useradd --system --home /var/lib/tomcat11 -g tomcat --shell /bin/false tomcat
  fi

  sudo chgrp -R tomcat /var/lib/tomcat11
  sudo chmod -R g+r /var/lib/tomcat11/conf
  sudo chmod g+x /var/lib/tomcat11/conf
  sudo chown -R tomcat /var/lib/tomcat11/{webapps,work,temp,logs}
  sudo chown tomcat /var/lib/tomcat11/bin/catalina.sh
  sudo chmod u+s /var/lib/tomcat11/bin/catalina.sh
  sudo setfacl -m d:g:tomcat:rwX /var/lib/tomcat11/webapps

  ls -ltra /usr/lib/jvm/

  echo "export CATALINA_HOME=\"/var/lib/tomcat11\"" >> ~/.bashrc
  ext_installed[${#ext_installed[@]}]="tomcat11"
}


