#!/usr/bin/env bash
# Updates every section of the Delta: the Primera Sección (delta.config.json)
# and each config in scripts/osm/sections/. The HOT export is downloaded once
# and cut for every section.
# Usage: npm run map:update:all [-- --source auto|overpass|hot]
set -euo pipefail
cd "$(dirname "$0")/../.."
export HOT_CACHE="${HOT_CACHE:-$(mktemp -d)}"
for config in scripts/osm/delta.config.json scripts/osm/sections/*.config.json; do
  echo "━━ $config"
  bash scripts/osm/update-map.sh --config "$config" "$@"
done
