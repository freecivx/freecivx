#!/bin/sh

# ./create-freeciv-gtk4-nsi.sh <freeciv files dir> <output dir> <version> <win32|win64|win>

./create-freeciv-gtk-qt-nsi.sh "$1" "$2" "$3" "gtk4" "GTK4" "$4" "gtk4"
