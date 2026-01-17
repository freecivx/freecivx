./stop-freeciv-web.sh
cd ..
mvn -B -T 1C package -pl freecivx-server
cd scripts
./start-freeciv-web.sh


