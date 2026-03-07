#!/bin/bash

/docker/scripts/start-freeciv-web.sh

exec "$@"

while true; do
  echo "FreecivWorld running"
  sleep 10
done
