"""Used by fetch-hot.sh. Append ferry terminals from a HOT sea_ports GeoJSON (bbox-filtered) to an Overpass-style JSON."""
import json, sys
ports_file, target, s, w, n, e = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:7])
doc = json.load(open(target))
gj = json.load(open(ports_file, encoding="utf-8"))
added = 0
for ft in gj["features"]:
    p, g = ft["properties"], ft["geometry"]
    if p.get("amenity") != "ferry_terminal" or not g: continue
    c = g["coordinates"]
    while isinstance(c[0], list): c = c[0]
    lon, lat = c[0], c[1]
    if not (w <= lon <= e and s <= lat <= n): continue
    tags = {"amenity": "ferry_terminal"}
    if p.get("name"): tags["name"] = p["name"]
    doc["elements"].append({"type": "node", "id": hash(p.get("id")) & 0x7fffffff, "tags": tags, "lat": lat, "lon": lon})
    added += 1
json.dump(doc, open(target, "w"), ensure_ascii=False)
print(added, "ferry terminals added")
