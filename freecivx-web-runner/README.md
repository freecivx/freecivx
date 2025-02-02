# FreecivX Web Runner

FreecivX Web Runner allows running Freeciv-Web entirely on Java, making it platform-independent and easy to deploy.

## Prerequisites
Ensure you have the following installed before proceeding:
- Java 21 or newer
- Apache Maven

## Building and Running FreecivX

### Step 1: Build Freeciv-Web
```
cd freeciv-web
mvn clean package
cp target/freeciv-web.war ../freecivx-web-runner/target
```
TODO: Step 1 currently needs to be run on Linux on a normal full install of Freecivx.

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
- Adjust Java memory settings as needed using `-Xmx` flags for larger maps or high-load scenarios.

## License
This project is licensed under the AGPL license.


