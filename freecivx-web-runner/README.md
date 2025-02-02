Freecivx-web-runner
===================

Freecivx-web-runner allows running Freeciv-web 100% on Java on any platform natively.

1. Build Freeciv-web:
cd freeciv-web
mvn clean package
cp target/freeciv-web.war ../freecivx-web-runner/target


2. Build and run Freecivx-web-runner:
cd freecivx-web-runner
mvn clean package
java -jar target\freecivx-web-runner-1.0.jar

3. Build and run Freecivx-server:
cd freecivx-server
mvn clean package
java -jar target\freecivx-server-1.0.jar
