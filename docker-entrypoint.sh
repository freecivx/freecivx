#!/bin/bash

/docker/scripts/start-freeciv-web.sh

exec "$@"

while true; do
  echo "Freecivx running"
  sleep 10
done
