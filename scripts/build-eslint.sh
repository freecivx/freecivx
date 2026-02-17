#!/bin/bash
# Script to run ESLint on JavaScript files using Maven profile

set -e

cd "$(dirname "$0")/.."

echo "Running ESLint on JavaScript files..."

cd freeciv-web
mvn validate -Peslint

echo "ESLint check completed!"
