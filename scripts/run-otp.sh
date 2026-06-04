#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../otp-data"
JAR=$(ls "$DATA_DIR"/otp-*-shaded.jar 2>/dev/null | head -1)

if [ -z "$JAR" ]; then
  echo "OTP jar not found. Run: npm run otp:setup"
  exit 1
fi

if [ ! -f "$DATA_DIR/graph.obj" ]; then
  echo "Routing graph not built yet. Run: npm run otp:build"
  exit 1
fi

echo "Starting OpenTripPlanner at http://localhost:8080 ..."
exec java -Xmx2G -jar "$JAR" --load --serve "$DATA_DIR"
