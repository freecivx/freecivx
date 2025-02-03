# FreecivX Web Runner

FreecivX Web Runner allows running Freeciv-Web entirely in Tomcat on Java, making it platform-independent and easy to deploy.

## Prerequisites
Ensure you have the following installed before proceeding:
- Java 21 or newer
- Apache Maven

## Building and Running FreecivX

### Step 1: Build Freeciv-Web
```
cd freeciv-web
./build-native.sh
cp target/freeciv-web.war ../freecivx-web-runner
```

### Step 2: Build and Run FreecivX Web Runner
```
cd freecivx-web-runner
mvn clean package
java -jar target/freecivx-web-runner-1.0.jar
```

### Step 3: Build and Run FreecivX Server
```
cd freecivx-server
mvn clean package
java -jar target/freecivx-server-1.0.jar
```

### Step 4: Open Freecivx in browser:
Freecivx is now available on:  
http://localhost:8080/?action=local  

## Notes
- Ensure that the Freeciv-Web `.war` file is correctly copied to `freecivx-web-runner/target` before running.

## TODO
- Enable H2 database

## License
This project is licensed under the AGPL license.


