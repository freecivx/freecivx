#!/bin/bash
# Startup script for running all processes of Freeciv-web

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd ${SCRIPT_DIR}

export FREECIV_WEB_DIR="${SCRIPT_DIR}/.."
export FREECIV_DATA_PATH="${HOME}/freeciv/share/freeciv/"
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export LANGUAGE=en_US.UTF-8

echo "export JAVA_HOME=\"/usr/lib/jvm/java-21-openjdk-amd64\"" | sudo tee /var/lib/tomcat11/bin/setenv.sh > /dev/null
sudo chmod +x /var/lib/tomcat11/bin/setenv.sh

if [ ! -f ${SCRIPT_DIR}/configuration.sh ]; then
    echo "ERROR: configuration.sh not found. Copy configuration.sh.dist to configuration.sh and update it with your settings."
    exit 2
fi
. ./configuration.sh

echo "Starting up Freeciv-web: nginx, tomcat, publite2, websockify."

mkdir -p ${FREECIV_WEB_DIR}/logs
if [ ! -f /etc/nginx/sites-enabled/freeciv-web ]; then
    # Not enabled. Try to enable Freeciv-web.
    sudo ln -f /etc/nginx/sites-available/freeciv-web /etc/nginx/sites-enabled/freeciv-web
fi

# Start Freeciv-web's dependency services according to the users
# configuration.
bash ./dependency-services-start.sh
if [ "${TOMCATMANAGER}" = "Y" ]; then
    if [ -z "${TOMCATMANAGER_PASSWORD}" ]; then
        echo "Please enter tomcat-manager password for ${TOMCATMANAGER_USER}"
        read TOMCATMANAGER_PASSWORD
    fi
    curl -LsSg -K - << EOF
url="http://${TOMCATMANAGER_USER}:${TOMCATMANAGER_PASSWORD}@localhost:8080/manager/text/start?path=/freeciv-web"
EOF
fi

echo "Starting Freecivx-server-java" && \
(cd ${FREECIV_WEB_DIR}/freecivx-server/ && \
sh civserver.sh) && \

echo "Starting publite2" && \
(cd ${FREECIV_WEB_DIR}/publite2/ && \
sh run.sh) && \
echo "Publite2 started" && \
bash ${FREECIV_WEB_DIR}/scripts/status-freeciv-web.sh
echo "FreecivX started!"
