#!/bin/bash

# Script to replace 'tomcat11' with 'tomcat11' starting from one directory up

# Path to the current script
SCRIPT_PATH="$(realpath $0)"

# Find and replace in all files except the script itself
find ../ -type f ! -path "$SCRIPT_PATH" -exec sed -i 's/tomcat11/tomcat11/g' {} +

echo "now update scripts/install/ext-install.sh manually"

