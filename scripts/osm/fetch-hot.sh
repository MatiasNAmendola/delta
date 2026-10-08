#!/usr/bin/env bash
# Alternative to fetch-delta.sh when the Overpass API is not reachable:
# downloads the Humanitarian OpenStreetMap Team country export for Argentina
# (waterway lines and polygons + sea ports, refreshed from Geofabrik snapshots) and cuts it to
# the Delta bbox, producing the same scripts/osm/delta-tigre.overpass.json
# (or the output file given).
#
# Usage: scripts/osm/fetch-hot.sh [south west north east [output.json]]
# HOT_CACHE=<dir> keeps the downloads there, to cut several sections from one download.
# Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
set -euo pipefail
cd "$(dirname "$0")"

S="${1:--34.43}"; W="${2:--58.66}"; N="${3:--34.27}"; E="${4:--58.42}"
OUT="${5:-delta-tigre.overpass.json}"
BUCKET="https://production-raw-data-api.s3.amazonaws.com/ISO3/ARG"
if [ -n "${HOT_CACHE:-}" ]; then
  TMP="$HOT_CACHE"
  mkdir -p "$TMP"
else
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
fi

# Downloads once per cache; the S3 export is rebuilt now and then, so retry a 404
get() {
  [ -s "$TMP/$1.zip" ] && return 0
  for attempt in 1 2 3 4; do
    curl -sS --fail --connect-timeout 20 --max-time 900 -o "$TMP/$1.zip" "$BUCKET/$2" && break
    [ "$attempt" = 4 ] && return 1
    sleep $((attempt * 5))
  done
  unzip -q -o "$TMP/$1.zip" -d "$TMP/$1"
}
echo "Downloading HOT OSM exports for Argentina (~145 MB)..."
get lines waterways/lines/hotosm_arg_waterways_lines_geojson.zip
get polygons waterways/polygons/hotosm_arg_waterways_polygons_geojson.zip
get ports sea_ports/hotosm_arg_sea_ports_osm_geojson.zip

python3 -I hot_to_overpass.py "$TMP"/lines/*.geojson "$OUT" "$S" "$W" "$N" "$E"
python3 -I hot_add_ports.py "$TMP/ports/sea_ports.geojson" "$OUT" "$S" "$W" "$N" "$E"
python3 -I hot_polygons.py "$TMP"/polygons/*.geojson "$OUT" "$S" "$W" "$N" "$E"
echo "Saved scripts/osm/$OUT"
