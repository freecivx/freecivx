#!/bin/bash
###############################################################################
# Freeciv Standalone Client - Development Setup Script
#
# This script automates the initial setup for developing the Freeciv
# standalone client with GitHub Copilot.
#
# Usage:
#   ./dev-setup.sh [OPTIONS]
#
# Options:
#   --docker         Use Docker for development (default: local)
#   --skip-build     Skip the initial Maven build
#   --help           Show this help message
#
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
USE_DOCKER=false
SKIP_BUILD=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo ""
    echo -e "${BLUE}===================================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}===================================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "  $1"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

###############################################################################
# Parse Arguments
###############################################################################

while [[ $# -gt 0 ]]; do
    case $1 in
        --docker)
            USE_DOCKER=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help)
            head -n 16 "$0" | tail -n +2 | sed 's/^# //'
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

###############################################################################
# Main Setup
###############################################################################

print_header "Freeciv Standalone Client - Development Setup"

echo "This script will set up your development environment for the"
echo "Freeciv standalone client with GitHub Copilot."
echo ""

###############################################################################
# Check Prerequisites
###############################################################################

print_header "Step 1: Checking Prerequisites"

PREREQS_OK=true

if [ "$USE_DOCKER" = true ]; then
    print_info "Docker mode selected"
    if ! check_command docker; then
        print_error "Docker is required for --docker mode"
        PREREQS_OK=false
    fi
    if ! check_command docker-compose; then
        print_warning "docker-compose not found, will try 'docker compose' instead"
    fi
else
    print_info "Local development mode selected"
    
    # Check Java
    if check_command java; then
        JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}' | awk -F '.' '{print $1}')
        if [ "$JAVA_VERSION" -ge 17 ]; then
            print_info "Java version: $JAVA_VERSION (minimum: 17)"
        else
            print_error "Java version $JAVA_VERSION is too old (minimum: 17)"
            PREREQS_OK=false
        fi
    else
        PREREQS_OK=false
    fi
    
    # Check Maven
    if check_command mvn; then
        MVN_VERSION=$(mvn --version | head -n 1 | awk '{print $3}')
        print_info "Maven version: $MVN_VERSION"
    else
        PREREQS_OK=false
    fi
    
    # Check Python (for local server)
    if check_command python3; then
        PY_VERSION=$(python3 --version | awk '{print $2}')
        print_info "Python version: $PY_VERSION"
    else
        print_warning "python3 not found - you'll need another web server"
    fi
fi

# Check git
if ! check_command git; then
    print_error "git is required"
    PREREQS_OK=false
fi

if [ "$PREREQS_OK" = false ]; then
    echo ""
    print_error "Some prerequisites are missing. Please install them and try again."
    exit 1
fi

print_success "All prerequisites are met!"

###############################################################################
# Docker Setup
###############################################################################

if [ "$USE_DOCKER" = true ]; then
    print_header "Step 2: Setting Up Docker Environment"
    
    if [ -f docker-compose.yml ]; then
        print_info "docker-compose.yml found"
    else
        print_error "docker-compose.yml not found in $SCRIPT_DIR"
        exit 1
    fi
    
    print_info "Building Docker images (this may take a few minutes)..."
    if command -v docker-compose &> /dev/null; then
        docker-compose build
    else
        docker compose build
    fi
    
    print_success "Docker environment ready!"
    
    echo ""
    print_header "Setup Complete!"
    echo ""
    echo "To start the development server:"
    echo -e "  ${GREEN}docker-compose up${NC}"
    echo ""
    echo "Then open in your browser:"
    echo -e "  ${BLUE}http://localhost:8080/freeciv-web-standalone.html${NC}"
    echo ""
    
    exit 0
fi

###############################################################################
# Local Setup
###############################################################################

print_header "Step 2: Setting Up Project Directory"

# Check if we're in the right directory
if [ ! -f "freeciv-web/pom.xml" ]; then
    print_error "freeciv-web/pom.xml not found"
    print_info "Please run this script from the freecivworld repository root"
    exit 1
fi

print_success "Project directory structure verified"

###############################################################################
# Validate Standalone Files
###############################################################################

print_header "Step 3: Validating Standalone Files"

VALIDATION_OK=true

# Check main HTML file
if [ -f "freeciv-web/src/main/webapp/freeciv-web-standalone.html" ]; then
    print_success "freeciv-web-standalone.html found"
else
    print_error "freeciv-web-standalone.html not found"
    VALIDATION_OK=false
fi

# Check standalone JS
if [ -f "freeciv-web/src/main/webapp/javascript/standalone.js" ]; then
    print_success "standalone.js found"
else
    print_error "standalone.js not found"
    VALIDATION_OK=false
fi

# Run full validation script if it exists
if [ -f "scripts/validate-standalone.sh" ]; then
    print_info "Running full validation..."
    if bash scripts/validate-standalone.sh > /dev/null 2>&1; then
        print_success "Full validation passed"
    else
        print_warning "Some validation checks failed (this may be OK for development)"
    fi
fi

if [ "$VALIDATION_OK" = false ]; then
    print_error "Critical files are missing"
    exit 1
fi

###############################################################################
# Build Project
###############################################################################

if [ "$SKIP_BUILD" = true ]; then
    print_warning "Skipping build (--skip-build specified)"
else
    print_header "Step 4: Building Project"
    
    cd freeciv-web
    
    print_info "Running Maven compile (this may take a few minutes)..."
    print_info "Note: JavaScript minification will be skipped for faster builds"
    
    # Detect Java version and adjust build command
    if [ "$JAVA_VERSION" -ge 21 ]; then
        print_info "Java 21+ detected - running full build with minification"
        if mvn clean compile -DskipTests=true; then
            print_success "Build completed successfully!"
        else
            print_error "Build failed. Check the error messages above."
            exit 1
        fi
    else
        print_info "Java $JAVA_VERSION detected - running build without minification"
        if mvn clean compile -DskipTests=true -Dskip-minify-js=true; then
            print_success "Build completed successfully!"
        else
            print_error "Build failed. Check the error messages above."
            exit 1
        fi
    fi
    
    cd ..
fi

###############################################################################
# Create Helper Scripts
###############################################################################

print_header "Step 5: Creating Helper Scripts"

# Create run-standalone.sh script
cat > run-standalone.sh << 'EOF'
#!/bin/bash
# Quick script to run the standalone client

echo "Starting Freeciv standalone client..."
echo ""
echo "Server will start at: http://localhost:8080"
echo "Open: http://localhost:8080/freeciv-web-standalone.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd freeciv-web/target/freeciv-web || exit 1

if command -v python3 &> /dev/null; then
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8080
elif command -v php &> /dev/null; then
    php -S localhost:8080
else
    echo "Error: No suitable web server found (python3, python, or php required)"
    exit 1
fi
EOF

chmod +x run-standalone.sh
print_success "Created run-standalone.sh"

# Create quick-build.sh script
cat > quick-build.sh << 'EOF'
#!/bin/bash
# Quick rebuild script for development

echo "Quick rebuilding Freeciv-web (JavaScript only)..."

cd freeciv-web || exit 1

if [ -f build-js.sh ]; then
    ./build-js.sh
else
    mvn compile -DskipTests=true -Dskip-minify-js=true
fi

echo ""
echo "Build complete! Refresh your browser to see changes."
EOF

chmod +x quick-build.sh
print_success "Created quick-build.sh"

###############################################################################
# Setup Complete
###############################################################################

print_header "Setup Complete! 🎉"

echo ""
echo "Your development environment is ready for the Freeciv standalone client."
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo ""
echo "1. Start the development server:"
echo -e "   ${BLUE}./run-standalone.sh${NC}"
echo ""
echo "2. Open your browser to:"
echo -e "   ${BLUE}http://localhost:8080/freeciv-web-standalone.html${NC}"
echo ""
echo "3. For quick rebuilds during development:"
echo -e "   ${BLUE}./quick-build.sh${NC}"
echo ""
echo -e "${GREEN}Documentation:${NC}"
echo "  - Quick Start Guide: QUICKSTART.md"
echo "  - Development Guide: DEVELOPMENT.md"
echo "  - Contributing: doc/CONTRIBUTING.md"
echo ""
echo -e "${GREEN}Tips for GitHub Copilot:${NC}"
echo "  - Use browser DevTools Console for debugging"
echo "  - Check standalone.js for all mock data initialization"
echo "  - Hard refresh (Ctrl+Shift+R) to clear browser cache"
echo "  - See DEVELOPMENT.md for detailed architecture info"
echo ""
echo "Happy coding! 🚀"
echo ""
