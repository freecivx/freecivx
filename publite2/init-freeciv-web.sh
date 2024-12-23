#!/bin/bash
# Starts Freeciv-web.
# This script is started by civlauncher.py in publite2.

set -euo pipefail

if [ "$#" -ne 6 ]; then
  echo "init-freeciv-web.sh error: incorrect number of parameters." >&2
  exit 1
fi

declare -a args

add_arguments() {
  local i=${#args[@]}
  for v in "$@"; do
    args[i]="${v}"
    ((i++))
  done
}

echo "init-freeciv-web.sh starting on port ${2}"

add_arguments --debug 1
add_arguments --port "${2}"
add_arguments --Announce none
add_arguments --exit-on-end
add_arguments --meta --keep --Metaserver "http://${4}"
add_arguments --type "${5}"
add_arguments --read "pubscript_${6}.serv"
add_arguments --log "../logs/freeciv-web-log-${2}-$(date +'%Y%m%d-%H%M%S').log"

if [ "${5}" = "pbem" ]; then
  add_arguments --Ranklog "/var/lib/tomcat11/webapps/data/ranklogs/rank_${2}.log"
fi

savesdir="${1}"

add_arguments --quitidle 20
add_arguments --saves "${savesdir}"

export FREECIV_SAVE_PATH="${savesdir}"
rm -f "/var/lib/tomcat11/webapps/data/scorelogs/score-${2}.log"

websockify_log="../logs/freeciv-proxy-${3}-$(date +'%Y%m%d-%H%M%S').log"
websockify "$3" "localhost:$(( $3 - 1000 ))" > "${websockify_log}" 2>&1 &
proxy_pid=$!

trap 'kill -9 $proxy_pid' EXIT

freeciv_web_log="../logs/freeciv-web-stderr-${2}-$(date +'%Y%m%d-%H%M%S').log"
"${HOME}/freeciv/bin/freeciv-web" "${args[@]}" > /dev/null 2> "${freeciv_web_log}"

rc=$?
kill -9 $proxy_pid || true
exit $rc
