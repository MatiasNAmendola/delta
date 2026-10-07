"""Used by fetch-hot.sh. Appends navigable water polygons from a HOT OSM export
GeoJSON (one feature per line) that intersect a bbox to an Overpass-style JSON,
as {"type": "area", "rings": [outer, *holes]} elements."""
import json, sys

src, target, s, w, n, e = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:7])
NAVIGABLE = {None, "river", "canal", "harbour", "oxbow", "lagoon", "stream"}

doc = json.load(open(target))
doc["elements"] = [el for el in doc["elements"] if el.get("type") != "area"]  # idempotent re-runs
added = 0
with open(src, encoding="utf-8") as f:
    for line in f:
        line = line.strip().rstrip(",")
        if not line.startswith('{ "type": "Feature"'):
            continue
        feat = json.loads(line)
        g, p = feat["geometry"], feat["properties"]
        if not g or g["type"] not in ("Polygon", "MultiPolygon"):
            continue
        if not (p.get("waterway") == "riverbank" or (p.get("natural") == "water" and p.get("water") in NAVIGABLE)):
            continue
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for i, poly in enumerate(polys):
            xs = [c[0] for c in poly[0]]
            ys = [c[1] for c in poly[0]]
            if max(xs) < w or min(xs) > e or max(ys) < s or min(ys) > n:
                continue
            tags = {k: str(v) for k, v in p.items() if v is not None and k in ("name", "natural", "water", "waterway")}
            doc["elements"].append({
                "type": "area",
                "id": int(p.get("osm_id") or 0) * 10 + i,
                "tags": tags,
                "rings": [[{"lat": lat, "lon": lon} for lon, lat in ring] for ring in poly],
            })
            added += 1
json.dump(doc, open(target, "w"), ensure_ascii=False)
print(added, "water polygons added")
