# Freecivx Java Server 

**freecivx-server** is a multiplayer server implemented in Java for [Freecivx.net](https://freecivx.net). It supports large-scale multiplayer games with modern Java features.

"FreecivX Java server - because Freeciv should not segfault!"

License: GNU Affero General Public License

## Current state
<img src="https://github.com/freecivx/freecivx/blob/main/doc/img/freecivx-java-logo.png" alt="FreecivX Java Logo" width="300"> <img src="https://github.com/freecivx/freecivx/blob/main/doc/img/freecivx-java-server.png" alt="FreecivX Java Logo" width="580">
 - Games can be started, there is now a real game state, units can move, and the end turn button works.
   

## Features

- **Freeciv game rules and ruleset compatibility**: Maintain compatibility with existing Freeciv game rules and rulesets.
- **Multiplayer-focused**: Designed for hosting large-scale multiplayer games.
- **Scalability**:
  - Supports many concurrent players, more than 1000 players.
  - Handle large maps for MMO-style gameplay. 1000 x 1000 map tiles.
  - Designed for long-running games, where players can join existing games.
- **Modern Java Features**:
  - Requires **Java 21** or later.
  - Utilizes **virtual threads** for high concurrency and lightweight task management.
- **Protocols**:
  - **WebSockets** for real-time communication.
  - **JSON** or **Protocol Buffers** (Protobuf) for efficient data exchange.
- **Security:** Java is significantly more secure than C.


## Getting Started

### Prerequisites

- **Java 21** or later.
- **Maven** for building the project.

### Build and Run

   ```bash
   mvn clean package
  java -jar target/freecivx-server-1.0.jar
```




