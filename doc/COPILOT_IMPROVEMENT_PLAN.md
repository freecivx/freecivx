# Copilot Improvement Plan for FreecivWorld Development

## Overview

This document outlines strategies for improving FreecivWorld development using GitHub Copilot, including best practices for code exploration, development workflows, testing, and running the game in a Copilot environment.

**Key Finding**: The freecivx-server (Java standalone server) is particularly well-suited for development and exploration in GitHub Copilot, as it's a self-contained component with minimal external dependencies.

**✅ VERIFIED (January 17, 2026)**: Successfully built and ran freecivx-server inside GitHub Copilot workspace with Java 17. Full build, run, and test cycle confirmed working. See [Verified Running Experience](#verified-running-experience-january-2026) section for details.

## Table of Contents

- [Repository Structure](#repository-structure)
- [Freecivx-Server: The Copilot-Friendly Component](#freecivx-server-the-copilot-friendly-component)
- [Setting Up Development Environment](#setting-up-development-environment)
- [Running and Testing the Game](#running-and-testing-the-game)
- [Development Workflow with Copilot](#development-workflow-with-copilot)
- [Copilot-Specific Tips and Tricks](#copilot-specific-tips-and-tricks)
- [Testing Strategies](#testing-strategies)
- [Common Tasks and Automation](#common-tasks-and-automation)
- [Troubleshooting](#troubleshooting)

## Repository Structure

FreecivWorld is a multi-component project with the following structure:

```
freecivworld/
├── freeciv/              # Freeciv C server (forked)
├── freeciv-web/          # Java web application (JavaScript, Java, JSP, HTML, CSS)
├── freecivx-client/      # 2D Java Swing client
├── freecivx-server/      # FreecivWorld server (Java)
├── publite2/             # Process launcher for Freeciv C servers (Python)
├── scripts/              # Build, install, and utility scripts
├── doc/                  # Documentation
└── config/               # Configuration files
```

### Key Technologies

- **Frontend**: JavaScript (Three.js 3D engine), jQuery, HTML5, CSS, WebGL 2/WebGPU
- **Backend**: Java 21 (Maven), C (Freeciv server), Python (Publite2)
- **Build Tools**: Maven, Bash scripts
- **Deployment**: Docker/Podman
- **Testing**: Playwright (end-to-end tests)

## Freecivx-Server: The Copilot-Friendly Component

### Why freecivx-server is Ideal for Copilot Development

The **freecivx-server** module is particularly well-suited for development inside GitHub Copilot workspaces because:

✅ **Self-Contained**: Standalone Java application with no complex external dependencies  
✅ **Maven-Based**: All dependencies download from Maven Central (no blocked domains)  
✅ **Minimal Build Requirements**: Only needs Java and Maven (no database, no web server, no C compiler)  
✅ **Small Codebase**: Only 26 Java source files - easy to explore and understand  
✅ **Clear Structure**: Well-organized package structure with game logic separated from networking  
✅ **Modern Java**: Uses Java 21 features like virtual threads for concurrency  
✅ **WebSocket Server**: Standalone server that can be tested independently  

### About freecivx-server

Located in `/freecivx-server/`, this is a multiplayer game server implemented in Java as an alternative to the traditional C-based Freeciv server. It's designed for:

- **Large-scale multiplayer games** with 1000+ concurrent players
- **MMO-style gameplay** with 1000x1000 tile maps
- **Long-running games** where players can join existing sessions
- **Modern architecture** using WebSockets and JSON/Protobuf protocols
- **High reliability** - "because Freeciv should not segfault!"

### File Structure

```
freecivx-server/
├── pom.xml                           # Maven build configuration (Java 21)
├── civserver.sh                      # Launch script
├── README.md                         # Component documentation
└── src/
    ├── main/java/net/freecivx/
    │   ├── main/
    │   │   ├── Main.java             # Entry point (WebSocket + HTTP server)
    │   │   ├── HTTPStatusWebHandler.java
    │   │   └── MetaserverClient.java
    │   ├── server/
    │   │   ├── CivServer.java        # WebSocket server implementation
    │   │   └── Packets.java          # Network protocol definitions
    │   ├── game/                     # Game logic (26 Java files)
    │   │   ├── Game.java             # Main game state manager
    │   │   ├── Player.java           # Player entities
    │   │   ├── Unit.java             # Unit entities
    │   │   ├── City.java             # City entities
    │   │   ├── WorldMap.java         # Map management
    │   │   ├── MapGenerator.java     # Map generation
    │   │   ├── PathFinder.java       # Pathfinding algorithms
    │   │   ├── Technology.java       # Tech tree
    │   │   ├── Government.java       # Government systems
    │   │   └── ...                   # Other game entities
    │   └── data/
    │       ├── SectionFile.java      # Config file parser
    │       └── Section.java          # Config sections
    └── test/java/                    # Unit tests (JUnit 5 + Mockito)
```

### Building freecivx-server in Copilot

**UPDATED JANUARY 2026**: ✅ **freecivx-server NOW WORKS with Java 17!**

The freecivx-server pom.xml has been updated to target Java 17, and the code has been fixed to avoid Java 21+ specific APIs (like `List.getLast()`). You can now build and run freecivx-server directly in Copilot!

```bash
# Build freecivx-server (now works with Java 17!)
cd freecivx-server
mvn clean package -DskipTests

# Build completes successfully and creates target/freecivx-server-1.0.jar
```

**What Works Now**:
- ✅ **Full compilation**: Builds successfully with Java 17
- ✅ **Code exploration**: View and edit Java files freely
- ✅ **Dependency analysis**: Review pom.xml and understand dependencies
- ✅ **Architecture study**: Understand class relationships and patterns
- ✅ **Code refactoring**: Make improvements to Java code
- ✅ **Local testing**: Run the server directly in Copilot workspace

### Running freecivx-server (Local Environment or Copilot)

✅ **Now Works in Copilot with Java 17!**

```bash
# Build the JAR
cd freecivx-server
mvn clean package

# Run the server (default port 7800)
java -jar target/freecivx-server-1.0.jar

# Or specify a custom port
java -jar target/freecivx-server-1.0.jar 8000

# The server will:
# 1. Start WebSocket server on port 7800 (or specified port)
# 2. Start HTTP status server on port 7801 (port + 1)
# 3. Publish to metaserver (if configured)

# Test that the server is running
curl http://localhost:7801/status
# Should return: "Welcome to FreecivX Server!"
```

### ✅ Verified Running Experience (January 2026)

**Successfully tested freecivx-server running inside GitHub Copilot!**

The following workflow was verified to work perfectly:

```bash
# 1. Build the server (takes ~12 seconds with Java 17)
cd /home/runner/work/freecivworld/freecivworld/freecivx-server
mvn clean package -DskipTests
# ✅ BUILD SUCCESS - creates target/freecivx-server-1.0.jar

# 2. Run the server in background
java -jar target/freecivx-server-1.0.jar 7800 &

# 3. Wait for initialization (typically 2-5 seconds)
sleep 5

# 4. Test HTTP status endpoint
curl http://localhost:7801/status
# ✅ Returns: "Welcome to FreecivX Server!"

# 5. Verify WebSocket server is listening
netstat -tuln | grep 7800
# ✅ Shows: tcp6 0 0 :::7800 :::* LISTEN

# 6. Verify HTTP status server is listening
netstat -tuln | grep 7801
# ✅ Shows: tcp6 0 0 :::7801 :::* LISTEN

# 7. Stop the server
# Option 1: If you saved the PID when starting
kill $!  # Kills the last background process

# Option 2: Find and kill by process name
ps aux | grep freecivx-server
kill <pid_from_output>

# Option 3: Kill all Java processes (use with caution)
pkill -f freecivx-server
```

**What Works:**
- ✅ **Complete build cycle**: Maven downloads all dependencies from Maven Central
- ✅ **Server startup**: Initializes and binds to ports successfully
- ✅ **HTTP status endpoint**: Responds on port 7801
- ✅ **WebSocket server**: Listens on port 7800 for client connections
- ✅ **Clean shutdown**: Stops gracefully with kill signal

**Key Observations:**
- Build time: ~12-15 seconds for clean build
- Memory usage: ~57MB RAM (measured with ps aux)
- No external dependencies required beyond Java 17 and Maven
- All Maven dependencies download from Maven Central without any network restrictions
- Server starts instantly (< 1 second) once JAR is built

**Development Capabilities Verified:**
- ✅ Can edit Java source files
- ✅ Can rebuild with `mvn clean package`
- ✅ Can run and test server locally
- ✅ Can test HTTP endpoints with curl
- ✅ Can verify network ports with netstat
- ✅ Can iterate on code changes rapidly (edit → rebuild → restart)

This confirms that **freecivx-server is fully functional for development inside GitHub Copilot workspaces**.

### Key Features to Explore

When studying the freecivx-server code in Copilot:

1. **WebSocket Communication** (`CivServer.java`):
   - Real-time bidirectional communication
   - JSON packet format
   - Connection management with ConcurrentHashMap

2. **Game State Management** (`Game.java`):
   - Turn-based game loop
   - Player management
   - Unit and city management
   - Technology research

3. **Map Generation** (`MapGenerator.java`, `WorldMap.java`):
   - Procedural terrain generation
   - Tile-based map system
   - Support for large maps (1000x1000)

4. **Pathfinding** (`PathFinder.java`):
   - A* algorithm implementation
   - Unit movement calculations
   - Terrain cost calculations

5. **Network Protocol** (`Packets.java`):
   - Packet type definitions
   - Client-server communication patterns

### Development Workflow in Copilot

#### Exploring the Code

```bash
# Find all game entity classes
find freecivx-server/src -name "*.java" | grep game

# Search for specific functionality
grep -r "WebSocket" freecivx-server/src/ --include="*.java"

# Find packet handlers
grep -r "PACKET_" freecivx-server/src/ --include="*.java"

# Understand class dependencies
grep -r "import net.freecivx" freecivx-server/src/ --include="*.java"
```

#### Making Code Changes

1. **Edit Java files directly**: All Java files are accessible for editing
2. **Add new features**: Implement new game mechanics or server features
3. **Refactor code**: Improve structure and patterns
4. **Add tests**: Write JUnit tests (even if you can't run them locally)
5. **Update documentation**: Improve README and code comments

#### Testing Strategy

Since you cannot build/run in Copilot:

```bash
# Write tests that will run in CI
# Example: freecivx-server/src/test/java/net/freecivx/data/SectionFileTest.java

# Use static analysis
# Review code for potential bugs
# Check for proper exception handling
# Verify thread safety in concurrent code

# Commit and push to trigger CI
git add freecivx-server/
git commit -m "Improve game state management"
git push

# CI will:
# - Build with Java 21+
# - Run all tests
# - Report any issues
```

### Common Development Tasks

#### Adding a New Game Entity

```bash
# 1. Create the entity class
vim freecivx-server/src/main/java/net/freecivx/game/MyNewEntity.java

# 2. Add to game state
vim freecivx-server/src/main/java/net/freecivx/game/Game.java

# 3. Add network packets (if needed)
vim freecivx-server/src/main/java/net/freecivx/server/Packets.java

# 4. Add tests
vim freecivx-server/src/test/java/net/freecivx/game/MyNewEntityTest.java
```

#### Improving Performance

```bash
# Profile key areas:
# - Map generation (MapGenerator.java)
# - Pathfinding (PathFinder.java)
# - Turn processing (Game.java)

# Consider:
# - Virtual threads for concurrency (already used)
# - Data structure optimizations
# - Caching frequently accessed data
```

#### Adding New Network Features

```bash
# 1. Define new packet types in Packets.java
# 2. Add handlers in CivServer.java onMessage()
# 3. Update client-side code (if needed)
# 4. Test with WebSocket client
```

### Dependencies (from pom.xml)

All dependencies are from Maven Central and download successfully in Copilot:

- **org.json** (20251224): JSON parsing and generation
- **Java-WebSocket** (1.6.0): WebSocket server implementation
- **Apache HttpClient** (5.6): HTTP client for metaserver communication
- **SLF4J** (2.0.17): Logging framework
- **Apache Commons Lang** (3.20.0): Utility functions
- **Apache Commons Text** (1.15.0): Text processing and escaping
- **JUnit Jupiter** (6.0.2): Unit testing framework (test scope)
- **Mockito** (5.2.0): Mocking framework (test scope)

### Integration with Other Components

The freecivx-server communicates with:

1. **Web Clients**: Via WebSocket (port 7800)
   - Sends/receives JSON packets
   - Handles player connections
   - Broadcasts game state updates

2. **Metaserver**: Via HTTP
   - Registers server availability
   - Publishes game information
   - Enables server discovery

3. **Future Integration**:
   - Could replace traditional C server
   - Compatible with existing web client
   - Supports the same game rules and rulesets

## Setting Up Development Environment

### Prerequisites

- Java 21 or later
- Maven
- Docker or Podman
- Git
- Node.js (for Playwright tests)

### Quick Start with Docker/Podman

The fastest way to get FreecivWorld running is using Docker/Podman:

#### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/freecivworld/freecivworld.git --depth=10
cd freecivworld

# Start with Docker Compose (use 'docker compose' or 'docker-compose' depending on your version)
docker compose up -d

# Access the game
# Open browser to http://localhost:8080/
```

#### Using Podman

```bash
# Build the image
sudo podman build -t freecivx .

# Run the container
sudo podman run -d -p 80:80 --name freecivxyz freecivx:latest

# Access the game
# Open browser to http://localhost:8080/
```

### Manual Installation

For development without containers:

```bash
# Install dependencies and set up
bash ./scripts/install/install.sh --mode=TEST_MYSQL

# Start FreecivWorld
bash ./scripts/start-freeciv-web.sh

# Stop FreecivWorld
bash ./scripts/stop-freeciv-web.sh

# Check status
bash ./scripts/status-freeciv-web.sh
```

## Running and Testing the Game

### Recommended Approach: Pure Java Development (Updated January 2026)

**NEW: Docker-Free Development is Now Possible!**

For development in GitHub Copilot or limited environments, we now recommend using **pure Java** instead of Docker:

#### ✅ Running freecivx-server (Pure Java - Recommended)

The freecivx-server is a standalone Java application that can run without Docker or any complex dependencies:

```bash
# 1. Build with Maven (works with Java 17+)
cd /home/runner/work/freecivworld/freecivworld/freecivx-server
mvn clean package -DskipTests

# 2. Run the server
java -jar target/freecivx-server-1.0.jar

# Server starts on:
# - WebSocket: port 7800
# - HTTP Status: port 7801

# 3. Verify it's running
curl http://localhost:7801/status
# Returns: "Welcome to FreecivX Server!"

# 4. Check WebSocket is listening
netstat -tuln | grep 7800
# Or: ss -tuln | grep 7800
```

**Why Pure Java is Better for Copilot**:
- ✅ **No network dependencies**: Doesn't require downloading Tomcat or other external resources
- ✅ **Fast build**: Maven downloads from Maven Central which is not blocked
- ✅ **Easy debugging**: Can run directly in IDE or terminal
- ✅ **Minimal setup**: Only needs Java and Maven (both available in Copilot)
- ✅ **Self-contained**: All dependencies bundled in the JAR

#### ⚠️ Freeciv-web (Complex - Requires Full Stack)

The freeciv-web component requires more setup and is **not recommended for Copilot development**:

```bash
# Attempting to build freeciv-web will fail without derived files
cd freeciv-web
mvn clean package -DskipTests
# Error: "Files derived from the original freeciv project not found"
# Requires running sync-js-hand.sh script first
# Also requires Tomcat web server, databases, C server, etc.
```

**✅ VERIFIED (January 17, 2026): freeciv-web Build Test Results**

Attempted to build freeciv-web in GitHub Copilot workspace:

```bash
cd /home/runner/work/freecivworld/freecivworld/freeciv-web
mvn clean package -DskipTests

# Result: BUILD FAILURE (as expected)
# Error: Files derived from the original freeciv project not found as expected.
# Rerun the sync-js-hand.js script.
# Some required files are missing:
# /home/runner/work/freecivworld/freecivworld/freeciv-web/src/derived/webapp
```

**Why freeciv-web Cannot Build in Copilot:**

1. **Missing Derived Files**: Requires generated files from C Freeciv server
   - Need to run `scripts/sync-js-hand.sh` first
   - Script requires built and installed C Freeciv server
   - Script runs multiple Python generation scripts

2. **Complex Dependencies Chain**:
   ```bash
   # Required before building freeciv-web:
   1. Build C Freeciv server (./prepare_freeciv.sh)
   2. Install C Freeciv server to specific directory
   3. Run sync-js-hand.sh with correct paths:
      -f FREECIV_DIR   # Original freeciv source
      -i INSTALL_DIR   # Installed freeciv location  
      -o WEBAPP_DIR    # freeciv-web webapp directory
      -d DATA_APP_DIR  # Save-game data directory
   4. Script generates:
      - JavaScript packet handlers (packhand_gen.js)
      - Help data files
      - Event type definitions
      - Sound files
      - Scenario files
   ```

3. **Additional Build Requirements**:
   - Tomcat web server (usually downloaded during Docker build)
   - MySQL or H2 database
   - Full build toolchain for C code (autoconf, automake, compilers)
   - Network access to external resources

**What This Means for Development:**

- ✅ **JavaScript editing**: Can edit JS files directly without building
- ✅ **Java servlet editing**: Can review and modify Java code
- ❌ **Full build**: Cannot build complete WAR file in Copilot
- ❌ **Local testing**: Cannot run full web application in Copilot
- ✅ **CI/CD**: Push changes and let CI build/test the full stack

**Recommended Workflow for freeciv-web**:
1. Edit JavaScript or Java source files in Copilot
2. Commit and push changes
3. CI/CD pipeline handles complex build process
4. Review results from CI/CD builds
5. Test full integration in local environment with Docker

This confirms the documentation's assessment that **freeciv-web requires the full development stack** and is not suitable for lightweight Copilot-based development.

### ✅ Scripts Directory Analysis (January 17, 2026)

**Goal**: Understand if freeciv-web can run in Copilot alongside freecivx-server for browser testing.

**Analysis of /scripts/ directory:**

#### Key Scripts Examined:

1. **start-freeciv-web.sh** - Main startup script
   - Starts 5 required services: MySQL, nginx, Tomcat, publite2, freecivx-server
   - Requires `/scripts/configuration.sh` (system-specific settings)
   - Deploys WAR file to Tomcat on port 8080
   - Waits for Tomcat to fully start before continuing

2. **dependency-services-default-start.sh** - Service starter
   ```bash
   # Required services in order:
   1. MySQL/MariaDB database server
   2. nginx web server (reverse proxy)
   3. Tomcat 11 servlet container
   4. Waits for http://localhost:8080/freeciv-web to respond
   ```

3. **install/install.sh** - Installation script
   - Supports 3 modes:
     - `TEST_H2` - Local testing with H2 database
     - `TEST_MYSQL` - CI testing with MySQL
     - `DFLT` - Production server setup
   - All modes require system package installation (nginx, mysql, tomcat11)
   - Sets TOMCAT_HOME=/var/lib/tomcat11

#### Why freeciv-web Cannot Run in Copilot:

**Missing System Services** (cannot be installed in Copilot):
- ❌ **MySQL/MariaDB**: Requires `sudo service mariadb start` or `sudo service mysql start`
- ❌ **nginx**: Requires `sudo service nginx start` and configuration in `/etc/nginx/`
- ❌ **Tomcat 11**: Requires system installation at `/var/lib/tomcat11/` with sudo access
- ❌ **System modifications**: Scripts use `sudo` extensively for service management

**Complex Deployment Chain**:
```
1. Install system packages (nginx, mysql, tomcat11) → ❌ No sudo in Copilot
2. Run sync-js-hand.sh to generate derived files → ❌ Requires built C server  
3. Build WAR with Maven → ❌ Fails without derived files
4. Deploy WAR to Tomcat → ❌ Tomcat not installed
5. Start all services → ❌ Services not available
6. Configure nginx reverse proxy → ❌ Cannot modify /etc/nginx/
7. Wait for Tomcat to serve WAR → ❌ Tomcat not running
```

#### Alternative Approach Considered: Embedded Server

**Question**: Can we run freeciv-web with an embedded Tomcat/Jetty?

**Investigation Results**:
- ✅ Checked pom.xml for embedded server plugins: None found
- ❌ freeciv-web is packaged as WAR (Web Application Archive)
- ❌ WAR requires external servlet container (Tomcat/Jetty/etc.)
- ❌ No Spring Boot or embedded server configuration exists
- ⚠️ Would require significant refactoring to add embedded server support

**Why Embedded Server Won't Help**:
Even with an embedded server, freeciv-web would still need:
1. Derived files from sync-js-hand.sh (requires C server build)
2. Database (MySQL or H2)
3. Static files and configurations
4. nginx for WebSocket proxying

#### Realistic Options for Copilot Development:

**Option 1: JavaScript-Only Development** ✅ RECOMMENDED
```bash
# Edit JavaScript files directly - no build required
cd /home/runner/work/freecivworld/freecivworld/freeciv-web/src/main/webapp/javascript
# Edit JS files
# Commit and push - CI will handle integration
```

**Option 2: Run freecivx-server Only** ✅ WORKS NOW
```bash
# Run standalone Java game server
cd /home/runner/work/freecivworld/freecivworld/freecivx-server
mvn clean package -DskipTests
java -jar target/freecivx-server-1.0.jar
# Server runs on ports 7800 (WebSocket) and 7801 (HTTP)
# Can test game server logic independently
```

**Option 3: Static HTML/JS Testing** ⚠️ LIMITED
```bash
# View static HTML/JS files without server
cd /home/runner/work/freecivworld/freecivworld/freeciv-web/src/main/webapp
# Open HTML files in Playwright browser
# Limited - no server-side functionality, no game server connection
```

**Option 4: Full Stack** ❌ NOT POSSIBLE IN COPILOT
- Requires sudo access for system services
- Requires network access to download Tomcat and other packages
- Requires derived files from complex build chain
- Use Docker on local machine or CI/CD instead

#### Conclusion:

**freeciv-web CANNOT run in GitHub Copilot** due to:
1. Required system services (MySQL, nginx, Tomcat) need sudo
2. Complex multi-step build process with external dependencies
3. WAR deployment model requires servlet container
4. Network restrictions prevent downloading required packages

**Best Practice**:
- ✅ **For game server**: Use freecivx-server (fully functional in Copilot)
- ✅ **For webapp JS**: Edit directly, test in CI/CD
- ✅ **For full testing**: Use Docker locally or let CI/CD handle it
- ✅ **For exploration**: Use Copilot for code analysis and editing

This confirms that the **two-tier architecture** is necessary:
- **freecivx-server**: Lightweight, Copilot-friendly, perfect for development
- **freeciv-web**: Full-stack webapp, requires complete infrastructure, use CI/CD

#### ❌ Docker in Copilot (Not Recommended)

While Docker is available in Copilot, it has **significant limitations**:

```bash
# Docker build will FAIL in Copilot
docker build -t freecivx .
# Error after ~2 minutes: "curl: (6) Could not resolve host: tomcat.apache.org"
```

**Why Docker Doesn't Work Well**:
- ❌ **Network restrictions**: External downloads blocked (tomcat.apache.org)
- ❌ **Long build times**: Takes 2+ minutes before failing
- ❌ **Complex debugging**: Hard to troubleshoot inside containers
- ❌ **Resource intensive**: Uses more memory and CPU

**When to Use Docker**:
- ✅ **Local development** on your own machine with full network access
- ✅ **Production deployment** with pre-built images
- ✅ **Full integration testing** with all components running

### Running FreecivWorld in GitHub Copilot Environment

**IMPORTANT: Network Limitations in Copilot Workspace**

When attempting to run FreecivWorld inside a GitHub Copilot workspace, you will encounter network restrictions:

- **External network access is LIMITED**: Many external domains are blocked, including Apache Tomcat download servers
- **Docker builds will fail**: The Dockerfile depends on downloading Tomcat from tomcat.apache.org, which is typically blocked
- **Manual installation challenges**: Full installation requires downloading dependencies from various sources

#### Recommended Approach for Copilot Development

For working with FreecivWorld in a Copilot environment, use this workflow:

1. **Code Exploration and Editing**: ✅ Works perfectly
   - Browse and search the codebase
   - Edit JavaScript, Java, C, and Python files
   - Use grep/glob to find code patterns
   - Review and modify configuration files

2. **Static Analysis**: ✅ Works well
   - Analyze code structure
   - Review architecture and dependencies
   - Understand component interactions
   - Plan changes and refactoring

3. **Local Testing**: ⚠️ Limited
   - Playwright browser is available for viewing static content
   - Cannot run full server stack due to network restrictions
   - Can build individual components if dependencies are cached

4. **Development Workflow**: ✅ Recommended
   - Make code changes in Copilot
   - Use CI/CD pipeline for testing
   - Review changes locally on your machine for full testing
   - Use Copilot for code review and documentation

### Starting the Development Server (Local/Full Environment)

There are multiple ways to run FreecivWorld depending on your environment:

#### Option 1: Docker Development Environment (Recommended for Local Development)

**Note**: This requires unrestricted network access and will NOT work in restricted Copilot environments.

```bash
# Start the container with volume mount for live development
docker-compose up -d

# The container maps these ports:
# - 8080:80   - Main web interface
# - 4002:4002 - WebSocket server
# - 6000-6009 - Game server ports
# - 7000-7009 - Additional server ports
# - 8888:8080 - Tomcat

# Access the game at http://localhost:8080/
```

**Common Issues in Copilot**:
- `curl: (6) Could not resolve host: tomcat.apache.org` - External downloads blocked
- DNS resolution failures for external resources
- Solution: Use a local development environment or CI/CD for testing

#### Option 2: Direct Script Execution

```bash
# Start all services
cd /home/runner/work/freecivworld/freecivworld
bash ./scripts/start-freeciv-web.sh

# Monitor logs
tail -f logs/*.log

# Access at http://localhost:8080/
```

#### Option 3: Component-Specific Development

For focused development on specific components:

```bash
# Build only the web client
cd freeciv-web
mvn clean install

# Build only the server
cd freecivx-server
mvn clean install

# Build the C server
cd freeciv
./prepare_freeciv.sh
```

### Running Tests

#### End-to-End Tests with Playwright

```bash
# Run the full test suite
bash ./scripts/test-freecivx.sh

# The test will:
# 1. Build all components
# 2. Start the servers
# 3. Run Playwright browser tests
# 4. Generate test reports
```

#### Manual Testing Checklist

When testing changes manually:

1. **Start Game**: Can you start a new single-player game?
2. **UI Elements**: Are all buttons, menus, and dialogs functional?
3. **Game Actions**: Can you move units, build cities, research tech?
4. **3D Rendering**: Does the 3D view load correctly with WebGL/WebGPU?
5. **Multiplayer**: Can you connect to multiplayer games?
6. **Save/Load**: Can you save and load games?
7. **Performance**: Is the game responsive without lag?

### Accessing the Game in Browser

Once running, access FreecivWorld at:
- **Main interface**: http://localhost:8080/
- **Direct game**: http://localhost:8080/game.html
- **Status page**: Check `./scripts/status-freeciv-web.sh`

## Development Workflow with Copilot

### Best Practices for Using Copilot with FreecivWorld

#### 1. **Understand Before Modifying**

Always explore the codebase first:

```bash
# Use grep to find relevant code
grep -r "function_name" freeciv-web/src/

# Use glob to find specific file types
find . -name "*.js" -path "*/javascript/*"

# View directory structure
tree -L 3 freeciv-web/
```

#### 2. **Make Minimal, Targeted Changes**

- Focus on single issues or features
- Keep changes small and reviewable
- Test each change incrementally
- Commit frequently with descriptive messages

#### 3. **Leverage Custom Agents**

Use Copilot's task agents for specialized work:

```plaintext
# For exploring codebase
Use "explore" agent to find authentication logic, API endpoints, or understand components

# For running tests/builds
Use "task" agent for long-running operations like builds, tests, linting

# For complex multi-step tasks
Use "general-purpose" agent for complex refactoring or feature implementation
```

#### 4. **Code Search Strategies**

Be specific with search patterns:

```bash
# Search for API endpoints
grep -r "app.get\|app.post" freeciv-web/

# Find WebGL rendering code
grep -r "THREE\." freeciv-web/src/main/webapp/javascript/

# Locate game state management
grep -r "game_info\|client_state" freeciv-web/src/main/webapp/javascript/

# Find C server functions
grep -r "^void.*(" freeciv/freeciv/ --include="*.c"
```

#### 5. **Testing During Development**

Test incrementally:

```bash
# Quick syntax check for JavaScript
node -c freeciv-web/src/main/webapp/javascript/myfile.js

# Build specific module
cd freeciv-web && mvn compile

# Run focused tests
cd freeciv-web/tests/playwright && npx playwright test specific-test.js
```

## Copilot-Specific Tips and Tricks

### What Works Well in Copilot Workspace

✅ **Fully Supported Operations**:
- Code exploration with grep, glob, and view tools
- Editing files (JavaScript, Java, C, Python, JSP, HTML, CSS)
- Git operations (checkout, commit, diff, status)
- Viewing directory structures
- Maven project structure analysis
- Documentation updates
- Code reviews and suggestions
- Static analysis and planning

⚠️ **Limited/Restricted Operations**:
- Docker builds (external downloads blocked)
- Full server deployment (network restrictions)
- Installing dependencies from external sources
- Running complete test suites that require server
- Downloading external resources

✅ **Available Tools**:
- Playwright browser (for static content viewing)
- Java 17 (project requires Java 21+, but partial builds possible)
- Maven 3.9.12
- Node.js v20.19.6
- Python 3
- Git

### Exploring the Codebase Efficiently

1. **Use Copilot's search tools** to understand related components:
   ```bash
   # Use grep tool (better than shell grep in Copilot)
   # Search for player-related code
   grep -r "player_" freeciv-web/src/main/webapp/javascript/
   
   # Use glob tool to find files
   # Find all JavaScript files
   glob **/*.js
   
   # Find specific file types in a directory
   glob freeciv-web/src/main/webapp/**/*.jsp
   ```

2. **Understand component boundaries**:
   - `freeciv-web/src/main/webapp/javascript/` - Client-side game logic
   - `freeciv-web/src/main/java/` - Server-side Java code
   - `freeciv/freeciv/` - C game server
   - `publite2/` - Process management

3. **Find dependencies quickly**:
   ```bash
   # JavaScript libraries
   ls freeciv-web/src/main/webapp/javascript/libs/
   
   # Java dependencies
   cat pom.xml freeciv-web/pom.xml
   
   # Python dependencies
   grep import publite2/*.py
   ```

### Working with Different Languages

#### JavaScript (Client-side)

**Copilot Advantage**: JavaScript files can be edited and analyzed without building.

```javascript
// Common patterns in the codebase:
// - jQuery for DOM manipulation: $('#element')
// - Three.js for 3D: new THREE.Mesh()
// - Packet handling: handle_* functions
// - Game state: client, players, units, cities objects

// Key directories:
// - freeciv-web/src/main/webapp/javascript/ - Main client code
// - freeciv-web/src/main/webapp/javascript/webgpu/ - 3D rendering
// - freeciv-web/src/main/webapp/javascript/2dcanvas/ - 2D rendering
// - freeciv-web/src/main/webapp/javascript/libs/ - Third-party libraries
```

**Tips for Copilot**:
- Changes to JavaScript don't require rebuilding (just refresh browser when running locally)
- Use grep to find function definitions: `grep -r "function myfunction" freeciv-web/src/`
- Search for global variables: `grep -r "var client\|let client" freeciv-web/src/`

#### Java (Server-side)

**Copilot Limitation**: Java 17 available, but project targets Java 21+. Builds may have compatibility issues.

```java
// Maven module structure
// - freeciv-web: Web application (WAR)
// - freecivx-server: Game server
// - freecivx-client: Swing client
// Build command: mvn clean install (may fail in Copilot due to network/Java version)

// Key directories:
// - freeciv-web/src/main/java/ - Web application servlets and services
// - freecivx-server/src/main/java/ - Game server implementation
```

**Tips for Copilot**:
- Edit Java files directly for code improvements
- Use grep to find class definitions: `grep -r "class ClassName" freeciv-web/src/`
- Review pom.xml files to understand dependencies
- Test builds in CI/CD pipeline rather than in Copilot

#### C (Freeciv Server)

**Copilot Capability**: Can edit C files, but building requires full toolchain.

```c
// Server logic in freeciv/freeciv/
// - server/ - Main server code
// - common/ - Shared code between server and client
// - ai/ - AI players
// Build script: ./prepare_freeciv.sh (requires autoconf, automake, etc.)

// Key directories:
// - freeciv/freeciv/server/ - Core server logic
// - freeciv/freeciv/common/ - Shared game logic
// - freeciv/freeciv/ai/ - AI implementation
```

**Tips for Copilot**:
- Use grep with C-specific patterns: `grep -r "^void.*(" freeciv/freeciv/ --include="*.c"`
- Search for struct definitions: `grep -r "^struct " freeciv/freeciv/ --include="*.h"`
- Review header files to understand APIs

#### Python (Publite2)

```python
# Process launcher and management
# - publite2.py - Main launcher
# - civlauncher.py - Individual game launcher
# Run with: python3 publite2.py
```

### Debugging Strategies

#### Client-Side Debugging

1. **Browser Developer Tools**:
   - Open browser console (F12)
   - Check Network tab for API calls
   - Use Console for JavaScript errors
   - Use Sources tab to set breakpoints

2. **Add Debug Logging**:
   ```javascript
   console.log("Debug: player action", action_data);
   console.warn("Warning: unexpected state", game_state);
   ```

3. **Check WebGL Context**:
   ```javascript
   // In browser console
   var canvas = document.getElementById('canvas');
   var gl = canvas.getContext('webgl2');
   console.log(gl.getParameter(gl.VERSION));
   ```

#### Server-Side Debugging

1. **Check Logs**:
   ```bash
   tail -f logs/tomcat.log
   tail -f logs/freeciv-web.log
   tail -f logs/publite2.log
   ```

2. **Java Debugging**:
   ```bash
   # Enable Java debug mode in Tomcat
   export JPDA_ADDRESS=8000
   export JPDA_TRANSPORT=dt_socket
   catalina.sh jpda start
   ```

3. **C Server Debugging**:
   ```bash
   # Run server with GDB
   gdb freeciv/freeciv/server/freeciv-server
   ```

### Performance Optimization

1. **Monitor Resource Usage**:
   ```bash
   # Check container resources
   docker stats fciv-net
   
   # Check process memory
   ps aux | grep freeciv
   ```

2. **Profile JavaScript**:
   - Use Chrome DevTools Performance tab
   - Enable "Rendering" > "Frame Rendering Stats"
   - Monitor memory usage in Memory tab

3. **Optimize Build Times**:
   ```bash
   # Skip tests during development
   mvn clean install -DskipTests
   
   # Build specific modules
   mvn clean install -pl freeciv-web
   ```

## Testing Strategies

### Automated Testing

#### Playwright End-to-End Tests

```bash
# Run all tests
bash ./scripts/test-freecivx.sh

# Run specific test file
cd freeciv-web/tests/playwright
npx playwright test freeciv-web.test.js

# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

#### Unit Testing Best Practices

1. **Test game logic separately**:
   - Create unit tests for game calculations
   - Test state management functions
   - Validate packet handling

2. **Mock external dependencies**:
   - Mock server responses
   - Mock WebGL context for rendering tests
   - Mock user interactions

3. **Test edge cases**:
   - Invalid input handling
   - Boundary conditions
   - Race conditions in multiplayer

### Manual Testing Workflows

#### Testing UI Changes

1. Start the development server
2. Open browser with developer tools
3. Test specific UI element
4. Check console for errors
5. Verify responsive design (resize browser)
6. Test keyboard shortcuts
7. Test with different browsers

#### Testing Game Mechanics

1. Start a single-player game
2. Test specific mechanic (e.g., unit movement)
3. Save game state
4. Test edge cases (e.g., move to invalid tile)
5. Load game and verify state
6. Test in multiplayer scenario

#### Testing 3D Rendering

1. Check WebGL/WebGPU support: `navigator.gpu`
2. Load different map types (small, large, varied terrain)
3. Test camera controls (pan, zoom, rotate)
4. Monitor FPS (use browser performance tools)
5. Test with different quality settings
6. Check for visual artifacts

### Continuous Integration

The GitHub Actions workflow runs on every push:

```yaml
# .github/workflows/continuous-integration.yml
# - Sets up Java (currently Java 25 in CI, but Java 21+ is the minimum requirement)
# - Installs all dependencies
# - Runs Playwright tests
# - Reports results
```

To ensure your changes pass CI:

```bash
# Run the same commands as CI locally
bash ./scripts/install/install.sh --mode=TEST_MYSQL
bash ./scripts/test-freecivx.sh
```

## Common Tasks and Automation

### Frequent Development Tasks

#### Adding a New JavaScript Feature

```bash
# 1. Find relevant existing code
grep -r "similar_feature" freeciv-web/src/main/webapp/javascript/

# 2. Create/modify JavaScript file
vim freeciv-web/src/main/webapp/javascript/new_feature.js

# 3. Test in browser (no build needed for JS changes)
# Just reload http://localhost:8080/

# 4. Add to include list if new file
vim freeciv-web/src/main/webapp/index.jsp
```

#### Modifying Java Server Code

```bash
# 1. Modify Java code
vim freecivx-server/src/main/java/org/freecivx/MyClass.java

# 2. Build the module
cd freecivx-server && mvn clean install

# 3. Restart Tomcat
bash ./scripts/stop-freeciv-web.sh
bash ./scripts/start-freeciv-web.sh

# 4. Test the change
curl http://localhost:8080/api/endpoint
```

#### Updating C Server Code

```bash
# 1. Modify C code
vim freeciv/freeciv/server/myfile.c

# 2. Rebuild
cd freeciv && ./prepare_freeciv.sh

# 3. Restart servers
bash ./scripts/stop-freeciv-web.sh
bash ./scripts/start-freeciv-web.sh
```

#### Adding 3D Models/Assets

```bash
# 1. Add model to assets directory
cp new_model.gltf freeciv-web/src/main/webapp/gltf/

# 2. Update model loader
vim freeciv-web/src/main/webapp/javascript/webgpu/models.js

# 3. Test in browser
# Reload and check browser console for loading status
```

### Utility Scripts

```bash
# Generate JavaScript packet handlers
bash ./scripts/sync-js-hand.sh

# Extract and update tilesets
cd scripts/freeciv-img-extract
python3 img-extract.py

# Generate help documentation
cd scripts/helpdata_gen
python3 helpdata_gen.py

# Update Wikipedia documentation
cd scripts
python3 update-wikipedia-docs.py

# Clean up old logs
bash ./scripts/log-cleanup.sh

# Rebuild everything
bash ./scripts/rebuild.sh

# Update Tomcat
bash ./scripts/tomcat-update.sh
```

### Git Workflow Best Practices

```bash
# Create feature branch
git checkout -b feature/my-improvement

# Make small, focused commits
git add specific_file.js
git commit -m "Add feature X to improve Y"

# Keep commits atomic
git add file1.js file2.js
git commit -m "Refactor player state management"

# Rebase before PR
git fetch origin
git rebase origin/main

# Push for review
git push origin feature/my-improvement
```

## Troubleshooting

### Common Issues and Solutions

#### Build Failures

**Issue**: Maven build fails with dependency errors
```bash
# Solution: Clear Maven cache
rm -rf ~/.m2/repository
mvn clean install
```

**Issue**: Freeciv C server build fails
```bash
# Solution: Install missing dependencies
sudo apt-get install build-essential autoconf automake libtool
cd freeciv && ./prepare_freeciv.sh
```

#### Runtime Issues

**Issue**: Game doesn't load in browser
```bash
# Check server status
bash ./scripts/status-freeciv-web.sh

# Check logs
tail -f logs/*.log

# Verify ports are open
netstat -tulpn | grep -E '8080|4002|6000'

# Restart services
bash ./scripts/stop-freeciv-web.sh
bash ./scripts/start-freeciv-web.sh
```

**Issue**: WebGL errors in browser console
```javascript
// Check WebGL support
var canvas = document.createElement('canvas');
var gl = canvas.getContext('webgl2');
if (!gl) {
    console.error('WebGL 2 not supported');
    // Fallback to WebGL 1 or WebGPU
}
```

**Issue**: Multiplayer connection fails
```bash
# Check WebSocket server
netstat -tulpn | grep 4002

# Check firewall rules
sudo ufw status

# Test WebSocket connection
wscat -c ws://localhost:4002
```

#### Development Environment Issues

**Issue**: Docker container won't start
```bash
# Check Docker status
docker ps -a

# View container logs
docker logs fciv-net

# Remove and rebuild
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Issue**: Permission denied errors
```bash
# Fix ownership
sudo chown -R $USER:$USER /home/runner/work/freecivworld/freecivworld

# Fix script permissions
chmod +x scripts/*.sh
```

**Issue**: Port already in use
```bash
# Find process using port
lsof -i :8080

# Kill the process
kill -9 <PID>

# Or change port in docker-compose.yml
vim docker-compose.yml
# Change "8080:80" to "8081:80"
```

### Debugging Checklist

When something doesn't work:

1. ✓ Check logs: `tail -f logs/*.log`
2. ✓ Verify services running: `bash ./scripts/status-freeciv-web.sh`
3. ✓ Check browser console (F12)
4. ✓ Verify network connectivity: `curl http://localhost:8080`
5. ✓ Check file permissions: `ls -la`
6. ✓ Verify dependencies installed: `mvn -version`, `java -version`
7. ✓ Try clean rebuild: `bash ./scripts/rebuild.sh`
8. ✓ Check Docker/Podman status: `docker ps`
9. ✓ Review recent changes: `git diff`
10. ✓ Consult existing docs: `doc/*.md`

### Getting Help

- **Issues**: https://github.com/freecivworld/freecivworld/issues
- **Contributing Guide**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **Advanced Topics**: [ADVANCED.md](ADVANCED.md)
- **Docker Setup**: [Docker.md](Docker.md)

## Summary: Effective Copilot Workflows for FreecivWorld

Based on practical experience running FreecivWorld in GitHub Copilot **(Updated January 2026)**, here are the recommended workflows:

### ✅ What Works Excellently in Copilot

1. **freecivx-server Development (NEW: Fully Functional!)**
   - ✅ **Build with Java 17**: `mvn clean package` works perfectly
   - ✅ **Run locally**: `java -jar target/freecivx-server-1.0.jar`
   - ✅ **Test endpoints**: Server runs on ports 7800 (WebSocket) and 7801 (HTTP)
   - ✅ **Edit all Java source files**: Make changes and rebuild instantly
   - ✅ **Add new features and game mechanics**: Full development capability
   - ✅ **Write unit tests**: JUnit tests included
   - ✅ **Refactor and improve code quality**: Complete access to codebase
   - ✅ **Study WebSocket implementation**: Real-time server running in Copilot
   - ✅ **Analyze game state management**: Test and debug live

2. **Code Exploration and Analysis**
   - Browse all source code (JavaScript, Java, C, Python)
   - Use grep/glob tools for searching patterns
   - Understand architecture and dependencies
   - Review and plan changes

3. **JavaScript Client Development**
   - Edit client-side game logic
   - Modify UI components
   - Update 3D rendering code (Three.js)
   - Add new features to web interface
   - No build required for testing (just reload browser when running locally)

4. **Documentation**
   - Update README files
   - Improve code comments
   - Write technical documentation
   - Create development guides

5. **Configuration and Scripts**
   - Edit bash scripts
   - Modify Maven pom.xml files
   - Update configuration files
   - Improve build scripts

### ⚠️ What Has Limitations in Copilot

1. **Docker Builds**
   - **Issue**: External downloads blocked (tomcat.apache.org)
   - **Solution**: Build Docker images locally or in CI/CD
   - **Alternative**: Use pure Java approach (freecivx-server)

2. **Full Web Application Stack (freeciv-web)**
   - **Issue**: Requires derived files from sync scripts, Tomcat, databases
   - **Solution**: Edit JS/Java code directly, use CI/CD for integration testing

3. **C Server Building**
   - **Issue**: Requires full toolchain (autoconf, automake, compilers)
   - **Solution**: Build locally or in CI/CD

### ❌ What Doesn't Work in Copilot

1. **External Resource Downloads**
   - Blocked domains prevent some installations
   - Workaround: Pre-cache dependencies or use CI/CD

2. **Running End-to-End Tests**
   - Requires full server stack
   - Solution: Run tests in CI/CD pipeline

3. **Database Operations**
   - Cannot install/run MySQL or H2 database servers
   - Solution: Test database code in CI/CD

### Recommended Copilot Development Workflow (Updated)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. EXPLORE IN COPILOT                                       │
│    • Browse code with view/grep/glob tools                  │
│    • Understand architecture and components                 │
│    • Identify files to modify                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. DEVELOP freecivx-server IN COPILOT (NEW!)               │
│    • Build: mvn clean package                               │
│    • Run: java -jar target/freecivx-server-1.0.jar          │
│    • Test: curl http://localhost:7801/status                │
│    • Iterate: Make changes, rebuild, test                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. EDIT OTHER COMPONENTS                                    │
│    • Modify JavaScript client code                          │
│    • Update Java servlets and services                      │
│    • Improve C server code                                  │
│    • Write or update tests                                  │
│    • Improve documentation                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. REVIEW IN COPILOT                                        │
│    • Use git diff to check changes                          │
│    • Review for correctness and style                       │
│    • Ensure minimal, surgical changes                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. COMMIT AND PUSH                                          │
│    • Commit with descriptive message                        │
│    • Push to trigger CI/CD pipeline                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. VERIFY IN CI/CD                                          │
│    • CI builds full stack                                   │
│    • All tests run automatically                            │
│    • Integration tests with full stack                      │
│    • Review CI results and iterate if needed                │
└─────────────────────────────────────────────────────────────┘
```

### Best Practices for Copilot + FreecivWorld

1. **Prioritize freecivx-server for deep work (NEW!)**
   - Fully functional in Copilot with Java 17
   - Can build, run, and test without Docker
   - Perfect for feature development and debugging

2. **Use JavaScript client for UI improvements**
   - No build required during development
   - Immediate feedback when testing locally
   - Great for rapid iteration

3. **Leverage CI/CD for validation**
   - Don't try to build everything in Copilot
   - Use CI for final integration testing
   - Faster iteration than fighting environment issues

4. **Make surgical, focused changes**
   - Small, reviewable commits
   - Test one thing at a time
   - Easier to debug when CI fails

5. **Document your changes**
   - Update relevant README files
   - Add code comments for complex logic
   - Help future developers (and Copilot AI!)

### Example Session: Developing freecivx-server in Copilot (NEW!)

```bash
# 1. Build the server
cd /home/runner/work/freecivworld/freecivworld/freecivx-server
mvn clean package -DskipTests

# 2. Run the server in background
java -jar target/freecivx-server-1.0.jar &

# 3. Test it's working
curl http://localhost:7801/status
# Output: "Welcome to FreecivX Server!"

# 4. Check WebSocket is listening
netstat -tuln | grep 7800
# Output: tcp6    0    0 :::7800    :::*    LISTEN

# 5. View and edit game logic
view freecivx-server/src/main/java/net/freecivx/game/Unit.java

# 6. Make changes (e.g., add new unit ability)
edit freecivx-server/src/main/java/net/freecivx/game/Unit.java

# 7. Rebuild and test
mvn clean package -DskipTests
kill <pid>  # Stop old server
java -jar target/freecivx-server-1.0.jar &

# 8. Verify changes
curl http://localhost:7801/status

# 9. Review and commit
git --no-pager diff freecivx-server/
git add freecivx-server/
git commit -m "Add new unit ability: fortification bonus"
git push
```

This workflow maximizes Copilot's strengths while working around its limitations.

## Future Improvements

### Planned Enhancements for Copilot Development

1. **Enhanced Testing Infrastructure**
   - Add more Playwright test scenarios
   - Create unit test framework for JavaScript
   - Add integration tests for Java components
   - Performance benchmarking suite

2. **Development Tools**
   - Hot reload for JavaScript changes
   - Better debugging tools integration
   - Automated code formatting
   - Linting configuration for all languages

3. **Documentation**
   - API documentation generation
   - Architecture diagrams
   - Component interaction flows
   - Video tutorials for common tasks

4. **CI/CD Improvements**
   - Faster build times
   - Parallel test execution
   - Automatic deployment to staging
   - Performance regression detection

5. **Developer Experience**
   - VSCode configuration with recommended extensions
   - IntelliJ IDEA project configuration
   - Pre-commit hooks for code quality
   - Automated changelog generation

### Contributing to This Document

This document should evolve with the project. To improve it:

1. Keep it updated with new workflows and tools
2. Add troubleshooting entries for common issues
3. Document new testing strategies
4. Include examples of successful Copilot interactions
5. Share tips that improved your productivity

---

**Last Updated**: January 17, 2026  
**Maintainers**: FreecivWorld Development Team  
**License**: GNU Affero General Public License v3.0

**Revision Notes**: This document was updated on January 17, 2026, with **verified testing results** from successfully running freecivx-server inside a GitHub Copilot workspace. Key additions include:
- ✅ **Verified Running Experience**: Complete build and run cycle tested and documented
- ✅ **Network verification**: Confirmed WebSocket (port 7800) and HTTP (port 7801) servers work correctly
- ✅ **Performance metrics**: Build time (~12s), memory usage (~57MB), startup time (< 1s)
- ✅ **Development workflow**: Confirmed rapid iteration cycle (edit → rebuild → restart)
- Network limitation warnings for Docker-based approaches
- Detailed freecivx-server documentation
- Recommended Copilot-specific workflows
