# FreecivX Java Swing Client

The **FreecivX Java Swing Client** is the client application to play Freeciv on Freecivx servers. 

Goal:
=====
![bilde](https://github.com/user-attachments/assets/15cbd485-8269-4eb9-b25b-125171c9c07c)

## Goals
- **Cross-Platform Compatibility**: Run on any system with Java 21+.
- **User-Friendly Interface**: Provide a clean, modern, and intuitive UI for players.
- **Seamless Server Communication**: Use modern protocols like HTTP and Protocol Buffers to connect with the FreecivX server.
- **Performance Optimization**: Minimize resource usage while maintaining a smooth experience.
- **Extensibility**: Easily add new features or enhancements in the future.

## Repository Structure
This repository contains:
- **freecivx-server**: The backend server that powers the FreecivX game logic.
- **freecivx-client**: The Java Swing client that connects to the server and provides the user interface.

## Requirements
- Java 21 or later

## Quick Start

1. Build the Freecivx Java server:
   ```bash
   cd freecivx-server
   mvn clean package
   ```

2. Build the Swing client:
   ```bash
   cd freecivx-client
   mvn clean package
   ```

3. Run the Swing client:
   ```bash
   java -jar target/freecivx-client-1.0.0.jar
   ```

## Contributing
Contributions are welcome! Feel free to submit issues or pull requests to improve the project.

## License
This project is licensed under the AGPL license.
