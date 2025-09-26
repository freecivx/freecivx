./stop-freeciv-web.sh
cd ..
cd freecivx-server
mvn package
cd ..
cd scripts
./start-freeciv-web.sh


