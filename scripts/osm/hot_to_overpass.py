"""Used by fetch-hot.sh. Filter a HOT OSM export GeoJSON (one feature per line) to a bbox and emit
Overpass-style JSON elements (way + geometry) for scripts/osm/import.ts."""
import json, sys
src, out, s, w, n, e = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:7])
els = []
def inside(lon, lat): return w <= lon <= e and s <= lat <= n
with open(src, encoding="utf-8") as f:
    for line in f:
        line = line.strip().rstrip(",")
        if not line.startswith('{ "type": "Feature"'): continue
        feat = json.loads(line)
        g = feat["geometry"]; p = feat["properties"]
        if not g: continue
        lines = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"] if g["type"] == "MultiLineString" else []
        for i, coords in enumerate(lines):
            if not any(inside(lon, lat) for lon, lat in coords): continue
            tags = {k: str(v) for k, v in p.items() if v is not None and k not in ("osm_id", "osm_type")}
            els.append({"type": "way", "id": int(p.get("osm_id") or 0) * 10 + i, "tags": tags,
                        "geometry": [{"lat": lat, "lon": lon} for lon, lat in coords]})
json.dump({"generator": "HOT OSM export (Geofabrik snapshot) via hot_to_overpass.py", "elements": els}, open(out, "w"), ensure_ascii=False)
print(len(els), "ways kept")
