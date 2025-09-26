#!/bin/bash

/docker/scripts/start-freeciv-web.sh

while true; do
  echo "FreecivX running"
  sleep 10
done


exec "$@"

while true; do
  echo "FreecivX running"
  sleep 10
done
