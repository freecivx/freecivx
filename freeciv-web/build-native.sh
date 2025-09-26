#!/bin/bash

echo "Building Freeciv-web war file for Freecivx-web-runner to run natively on Windows or Linux."
echo "Requires Python 3 and Pillow already installed."

cp ../config/config.dist src/main/webapp/WEB-INF/config.properties
mkdir -p src/derived/webapp

cd ..
cd scripts

./sync-js-hand.sh -f ../freeciv/freeciv -i /tmp/ -o ../freeciv-web/src/derived/webapp/ -d /tmp

cd ..
cd freeciv-web

mvn clean package

echo "Build completed. Result is in target\freeciv-web.war"

