#!/bin/bash
# Shutdown script for Freeciv-web

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd ${SCRIPT_DIR}

export FREECIV_WEB_DIR="${SCRIPT_DIR}/.."

if [ ! -f ${SCRIPT_DIR}/configuration.sh ]; then
    echo "ERROR: configuration.sh not found. Copy configuration.sh.dist to configuration.sh and update it with your settings."
    exit 2
fi
. ./configuration.sh

echo "Shutting down Freeciv-web: nginx, tomcat, publite-go, websockify."

if [ "${TOMCATMANAGER}" = "Y" ]; then
    if [ -z "${TOMCATMANAGER_PASSWORD}" ]; then
        echo "Please enter tomcat-manager password for ${TOMCATMANAGER_USER}"
        read TOMCATMANAGER_PASSWORD
    fi
    curl -LsSg -K - << EOF
url="http://${TOMCATMANAGER_USER}:${TOMCATMANAGER_PASSWORD}@localhost:8080/manager/text/stop?path=/freeciv-web"
EOF
fi

if [ ! "${NGINX_DISABLE_ON_SHUTDOW}" = "N" ]; then
    sudo rm -f /etc/nginx/sites-enabled/freeciv-web
fi

# Shutdown Freeciv-web's dependency services according to the users
# configuration.
. ./dependency-services-stop.sh

#3. publite-go
ps aux | grep -ie publite-go | grep -v grep | awk '{print $2}' | xargs kill -9 || true
killall -9 freeciv-web || true

#4. freecivx-server (Java server started by publite-go)
ps aux | grep -ie "freecivx-server" | grep -v grep | awk '{print $2}' | xargs kill -9 || true

#5. freeciv-scores-go
ps aux | grep -ie freeciv-scores-go | grep -v grep | awk '{print $2}' | xargs kill -9 || true

#6. websockify
ps aux | grep -ie websockify | grep -v grep | awk '{print $2}' | xargs kill -9 || true


# Clean up server list in metaserver database.
echo "delete from servers" | mysql -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}"
