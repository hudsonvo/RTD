#!/bin/bash
set -e

OTP_VERSION="2.6.0"
OTP_JAR="otp-${OTP_VERSION}-shaded.jar"
OTP_URL="https://github.com/opentripplanner/OpenTripPlanner/releases/download/v${OTP_VERSION}/${OTP_JAR}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../otp-data"

echo "Setting up OpenTripPlanner ${OTP_VERSION}..."
mkdir -p "$DATA_DIR"

# Download OTP jar
if [ ! -f "$DATA_DIR/$OTP_JAR" ]; then
  echo "Downloading OTP jar (~100 MB)..."
  curl -L --progress-bar "$OTP_URL" -o "$DATA_DIR/$OTP_JAR"
  echo "✓ OTP jar downloaded"
else
  echo "✓ OTP jar already present"
fi

# Download RTD GTFS
if [ ! -f "$DATA_DIR/google_transit.zip" ]; then
  echo "Downloading RTD GTFS data..."
  curl -L --progress-bar "https://www.rtd-denver.com/files/gtfs/google_transit.zip" -o "$DATA_DIR/google_transit.zip"
  echo "✓ GTFS data downloaded"
else
  echo "✓ GTFS data already present"
fi

# Download Colorado OSM
if [ ! -f "$DATA_DIR/colorado-latest.osm.pbf" ]; then
  echo "Downloading Colorado OSM street network (~400 MB)..."
  curl -L --progress-bar "https://download.geofabrik.de/north-america/us/colorado-latest.osm.pbf" -o "$DATA_DIR/colorado-latest.osm.pbf"
  echo "✓ OSM data downloaded"
else
  echo "✓ OSM data already present"
fi

# Write OTP config files
cat > "$DATA_DIR/build-config.json" << 'EOF'
{
  "transitServiceStart": "-P1Y",
  "transitServiceEnd": "P3Y"
}
EOF

cat > "$DATA_DIR/router-config.json" << 'EOF'
{
  "routingDefaults": {
    "walkSpeed": 1.4,
    "numItineraries": 3
  }
}
EOF

echo ""
echo "✓ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Build the routing graph (5–10 min, requires ~4 GB RAM):"
echo "     npm run otp:build"
echo ""
echo "  2. Start the OTP server:"
echo "     npm run otp:serve"
echo ""
echo "  3. In a separate terminal, start the dev server:"
echo "     npm run dev"
