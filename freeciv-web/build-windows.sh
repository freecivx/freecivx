#!/bin/bash

echo "Building Freeciv-web war file for Freecivx-web-runner on Windows."
echo "Requires Python 3 and Pillow already installed."

cp ../config/config.dist src/main/webapp/WEB-INF/config.properties
mkdir -p src/derived/webapp
cd ..
cd scripts
./sync-js-hand.sh -f ../freeciv/freeciv -i /tmp/ -o ../freeciv-web/src/derived/webapp/ -d /tmp
echo "Build completed. Result is in target\freeciv-web.war"

