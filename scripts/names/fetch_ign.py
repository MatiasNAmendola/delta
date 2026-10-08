#!/usr/bin/env python3
"""
Downloads the official IGN geometry of named watercourses (WFS layer
ign:lineas_de_aguas_continentales_*) in the Delta and prints it as
compact GeoJSON lines ("IGNFEATURE <json>"), so it can be copied into
scripts/osm/supplements/ (the dev machine cannot reach the IGN).
Usage: fetch_ign.py "Río Carapachay" ["Otro nombre" ...]
Data: Instituto Geográfico Nacional (Argentina), https://www.ign.gob.ar/
"""
import json, sys, urllib.parse, urllib.request

BASE = "https://wms.ign.gob.ar/geoserver/ows"
BBOX = (-58.95, -34.52, -58.30, -33.85)  # lon/lat
LAYERS = ["ign:lineas_de_aguas_continentales_perenne", "ign:lineas_de_aguas_continentales_intermitentes",
          "ign:lineas_de_aguas_continentales_BH010", "ign:lineas_de_aguas_continentales_BH020",
          "ign:lineas_de_aguas_continentales_BH030", "ign:lineas_de_aguas_continentales_BI020",
          "ign:areas_de_aguas_continentales_perenne"]
UA = {"User-Agent": "DeltaGame-names/1.0 (+https://github.com/MatiasNAmendola/delta)"}

wanted = {n.lower() for n in sys.argv[1:]}
for layer in LAYERS:
    url = (BASE + "?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326"
           f"&typeNames={urllib.parse.quote(layer)}&bbox={BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]},EPSG:4326&count=10000")
    try:
        fc = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read())
    except Exception as e:  # noqa: BLE001
        print(layer, "falló:", e)
        continue
    for f in fc.get("features", []):
        p = f.get("properties") or {}
        name = (p.get("fna") or "").strip()
        if name.lower() in wanted:
            print("IGNFEATURE", json.dumps({"layer": layer, "properties": p, "geometry": f.get("geometry")}, ensure_ascii=False, separators=(",", ":")))
