#!/usr/bin/env bash
# Downloads the real waterways and boat stops of the Delta de Tigre from
# OpenStreetMap (Overpass API) into scripts/osm/delta-tigre.overpass.json.
#
# Usage: scripts/osm/fetch-delta.sh [south west north east]
# Default bbox: Primera Sección de islas del Delta de Tigre.
# Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
set -euo pipefail
cd "$(dirname "$0")"

BBOX="${1:--34.43},${2:--58.66},${3:--34.27},${4:--58.42}"
OUT="delta-tigre.overpass.json"
ENDPOINT="${OVERPASS_URL:-https://overpass-api.de/api/interpreter}"

QUERY="[out:json][timeout:180];
(
  way[\"waterway\"~\"^(river|canal|stream|ditch|tidal_channel)$\"](${BBOX});
  way[\"natural\"=\"water\"](${BBOX});
  relation[\"natural\"=\"water\"](${BBOX});
  way[\"waterway\"=\"riverbank\"](${BBOX});
  nwr[\"amenity\"=\"ferry_terminal\"](${BBOX});
  nwr[\"man_made\"=\"pier\"][\"name\"](${BBOX});
  nwr[\"public_transport\"=\"stop_position\"][\"ferry\"=\"yes\"](${BBOX});
);
out geom;"

echo "Querying ${ENDPOINT} for bbox ${BBOX}..."
curl -sS --fail --connect-timeout 20 --max-time 300 --data-urlencode "data=${QUERY}" "${ENDPOINT}" -o "${OUT}"
echo "Saved $(wc -c < "${OUT}") bytes to scripts/osm/${OUT}"
