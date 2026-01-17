# Copilot Improvement Plan for FreecivWorld Development

## Overview

This document outlines strategies for improving FreecivWorld development using GitHub Copilot, including best practices for code exploration, development workflows, testing, and running the game in a Copilot environment.

## Table of Contents

- [Repository Structure](#repository-structure)
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
// - freeciv-web/src/main/webapp/javascript/webgl/ - 3D rendering
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
vim freeciv-web/src/main/webapp/javascript/webgl/models.js

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

**Last Updated**: January 2026
**Maintainers**: FreecivWorld Development Team
**License**: GNU Affero General Public License v3.0
