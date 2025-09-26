#!/bin/bash
cd "$(dirname "$0")"
java -jar target/freecivx-server-1.0.jar 7800 > ../logs/freecivx-server.log & 
