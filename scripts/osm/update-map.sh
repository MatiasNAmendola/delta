#!/usr/bin/env bash
# Updates the real Delta world from OpenStreetMap, end to end:
#   1. downloads fresh data (Overpass API, or the HOT export as fallback)
#   2. rebuilds src/world/data/delta-real.world.json
#   3. validates it (tests) and prints what changed
#
# Usage: npm run map:update [-- --source auto|overpass|hot]
# Parameters (zone, origin, scale, size) live in scripts/osm/delta.config.json.
# Data © OpenStreetMap contributors, ODbL 1.0.
set -euo pipefail
cd "$(dirname "$0")/../.."

SOURCE="auto"
while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

CONFIG=scripts/osm/delta.config.json
cfg() { node -e "const c=require('./$CONFIG'); console.log($1)"; }
BBOX=($(cfg "[c.bbox.south,c.bbox.west,c.bbox.north,c.bbox.east].join(' ')"))
ORIGIN="$(cfg "c.origin.lat+','+c.origin.lon")"
OUTPUT="$(cfg c.output)"

summary() { node -e "
const w = require('./$1');
const verts = (w.waterAreas || []).reduce((n, a) => n + a.outer.length + a.holes.reduce((m, h) => m + h.length, 0), 0);
console.log(JSON.stringify({ rivers: w.rivers.map(r => r.name), docks: w.docks.map(d => d.name), areas: (w.waterAreas || []).length, verts }));
"; }
BEFORE="$( [ -f "$OUTPUT" ] && summary "$OUTPUT" || echo '{"rivers":[],"docks":[],"areas":0,"verts":0}' )"

fetch_overpass() { scripts/osm/fetch-delta.sh "${BBOX[@]}"; }
fetch_hot() { scripts/osm/fetch-hot.sh "${BBOX[@]}"; }

echo "▶ 1/3 Downloading OpenStreetMap data (source: $SOURCE)"
case "$SOURCE" in
  overpass) fetch_overpass ;;
  hot) fetch_hot ;;
  auto) fetch_overpass || { echo "Overpass not reachable, falling back to the HOT export"; fetch_hot; } ;;
  *) echo "Unknown source: $SOURCE" >&2; exit 2 ;;
esac

echo "▶ 2/3 Building $OUTPUT"
npx tsx scripts/osm/import.ts \
  --origin "$ORIGIN" \
  --size "$(cfg c.size)" \
  --scale "$(cfg c.metersPerUnit)" \
  --id "$(cfg c.id)" \
  --name "$(cfg c.name)" \
  --out "$OUTPUT"

echo "▶ 3/3 Validating"
npx vitest run --reporter=dot

AFTER="$(summary "$OUTPUT")"
node -e "
const b = $BEFORE, a = $AFTER;
const diff = (x, y) => y.filter(n => !x.includes(n));
const line = (label, list) => list.length && console.log('  ' + label + ': ' + [...new Set(list)].join(', '));
console.log('\nMap updated: rivers ' + b.rivers.length + ' → ' + a.rivers.length +
  ' · stops ' + b.docks.length + ' → ' + a.docks.length +
  ' · water areas ' + b.areas + ' → ' + a.areas + ' (' + a.verts + ' vertices)');
line('new rivers', diff(b.rivers, a.rivers));
line('removed rivers', diff(a.rivers, b.rivers));
line('new stops', diff(b.docks, a.docks));
line('removed stops', diff(a.docks, b.docks));
"
echo "Review it with: npm run dev → http://localhost:3000/delta/?view=aerial"
