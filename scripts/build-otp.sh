#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../otp-data"
JAR=$(ls "$DATA_DIR"/otp-*-shaded.jar 2>/dev/null | head -1)

if [ -z "$JAR" ]; then
  echo "OTP jar not found. Run: npm run otp:setup"
  exit 1
fi

# Phase 1: build + auto-save street network
if [ ! -f "$DATA_DIR/streetGraph.obj" ]; then
  echo "Phase 1: Building street network from OSM (~3-5 min)..."
  java -Xmx4G -jar "$JAR" --buildStreet "$DATA_DIR"
  echo ""
else
  echo "Phase 1: streetGraph.obj already exists, skipping."
fi

# Phase 2: load street graph + GTFS, save full graph
echo "Phase 2: Loading GTFS + building full transit graph (~5-10 min)..."
java -Xmx4G -jar "$JAR" --loadStreet --save "$DATA_DIR"

echo ""
echo "✓ Build complete. Start the server with: npm run otp:serve"
