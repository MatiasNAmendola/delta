#!/usr/bin/env python3
"""Looks a waterway up by name directly in OpenStreetMap (Overpass), with
retries, and prints its tags and geometry ("OSMFEATURE <json>").
Usage: osm_lookup.py Carapachay
       osm_lookup.py --way 30164212   (prints the whole element, "OSMWAY <json>",
                                       in Overpass format for scripts/osm/supplements)"""
import json, sys, time, urllib.parse, urllib.request

by_id = sys.argv[1] == "--way"
if by_id:
    q = f"[out:json][timeout:90];way({int(sys.argv[2])});out geom tags;"
else:
    name = sys.argv[1]
    q = f"""[out:json][timeout:90];
(way["name"~"{name}",i](-34.6,-58.95,-33.85,-58.3);
 relation["name"~"{name}",i](-34.6,-58.95,-33.85,-58.3););
out geom tags;"""
for endpoint in ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"):
    for attempt in range(3):
        try:
            req = urllib.request.Request(endpoint, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": "DeltaGame/1.0"})
            data = json.loads(urllib.request.urlopen(req, timeout=120).read())
            print(endpoint, len(data["elements"]), "elementos")
            for e in data["elements"]:
                if by_id:
                    e.pop("bounds", None)
                    print("OSMWAY", json.dumps(e, ensure_ascii=False, separators=(",", ":")))
                    continue
                geom = e.get("geometry") or [m for mem in e.get("members", []) for m in (mem.get("geometry") or [])]
                print("OSMFEATURE", json.dumps({"type": e["type"], "id": e["id"], "tags": e.get("tags"), "points": len(geom),
                                                 "first": geom[0] if geom else None, "last": geom[-1] if geom else None}, ensure_ascii=False))
            sys.exit(0)
        except Exception as ex:  # noqa: BLE001
            print(endpoint, "intento", attempt + 1, "falló:", ex)
            time.sleep(10)
