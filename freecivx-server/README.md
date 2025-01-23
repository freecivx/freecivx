# Freecivx Server (Java)

**freecivx-server** is a multiplayer server implemented in Java for [Freecivx.net](https://freecivx.net). It supports large-scale multiplayer games with modern Java features.

License: GNU Affero General Public License

## Features

- **Multiplayer-focused**: Designed for hosting large-scale multiplayer games.
- **Scalability**:
  - Supports many concurrent players.
  - Handles massive maps for MMO-style gameplay.
  - Designed for long-running games.
- **Modern Java Features**:
  - Requires **Java 21** or later.
  - Utilizes **virtual threads** for high concurrency and lightweight task management.
- **Protocols**:
  - **WebSockets** for real-time communication.
  - **JSON** or **Protocol Buffers** (Protobuf) for efficient data exchange.

## Getting Started

### Prerequisites

- **Java 21** or later.
- **Maven** for building the project.

### Build and Run

   ```bash
   mvn clean package
  java -jar target/freecivx-server-1.0.jar
```

