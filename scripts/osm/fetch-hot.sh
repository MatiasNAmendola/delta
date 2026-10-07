#!/usr/bin/env bash
# Alternative to fetch-delta.sh when the Overpass API is not reachable:
# downloads the Humanitarian OpenStreetMap Team country export for Argentina
# (waterways + sea ports, refreshed from Geofabrik snapshots) and cuts it to
# the Delta bbox, producing the same scripts/osm/delta-tigre.overpass.json.
#
# Usage: scripts/osm/fetch-hot.sh [south west north east]
# Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
set -euo pipefail
cd "$(dirname "$0")"

S="${1:--34.43}"; W="${2:--58.66}"; N="${3:--34.27}"; E="${4:--58.42}"
BUCKET="https://production-raw-data-api.s3.amazonaws.com/ISO3/ARG"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading HOT OSM exports for Argentina (~80 MB)..."
curl -sS --fail -o "$TMP/lines.zip" "$BUCKET/waterways/lines/hotosm_arg_waterways_lines_geojson.zip"
curl -sS --fail -o "$TMP/ports.zip" "$BUCKET/sea_ports/hotosm_arg_sea_ports_osm_geojson.zip"
unzip -q -o "$TMP/lines.zip" -d "$TMP/lines"
unzip -q -o "$TMP/ports.zip" -d "$TMP/ports"

python3 -I hot_to_overpass.py "$TMP"/lines/*.geojson delta-tigre.overpass.json "$S" "$W" "$N" "$E"
python3 -I hot_add_ports.py "$TMP/ports/sea_ports.geojson" delta-tigre.overpass.json "$S" "$W" "$N" "$E"
echo "Saved scripts/osm/delta-tigre.overpass.json"
