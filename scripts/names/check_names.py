#!/usr/bin/env python3
"""
Cross-checks the river and arroyo names of the game's maps against
independent sources (docs/investigacion/07, ADR 0016):
  - GeoNames (gazetteer, CC BY 4.0): the Argentina dump, hydrographic features
  - Wikidata (CC0): watercourses with coordinates in the Delta's bbox
  - IGN Argentina (WFS): watercourse layers, if its server answers
Writes names-report.md / names-report.json: for each name in our worlds,
which sources know it (exact or after normalising accents and prefixes),
and the closest spelling each source has.
Runs on GitHub Actions (the dev machine cannot reach these servers).
"""
import difflib, glob, io, json, os, re, sys, unicodedata, urllib.parse, urllib.request, zipfile

BBOX = (-34.52, -59.05, -33.85, -58.30)  # south, west, north, east
UA = {"User-Agent": "DeltaGame-names/1.0 (+https://github.com/MatiasNAmendola/delta)"}
PREFIX = re.compile(r"^(r[ií]o|arroyo|aguaje|canal|riacho|zanj[oó]n|zanja|pasaje|brazo|boca|ayo\.?)\s+(de(l| la| los| las)?\s+)?", re.I)


def norm(name):
    s = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode().lower().strip()
    s = PREFIX.sub("", s)
    return re.sub(r"[^a-z0-9 ]", "", s).strip()


def get(url, timeout=120):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def inside(lat, lon):
    return BBOX[0] <= lat <= BBOX[2] and BBOX[1] <= lon <= BBOX[3]


def geonames():
    out = []
    data = get("https://download.geonames.org/export/dump/AR.zip", 300)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for line in io.TextIOWrapper(z.open("AR.txt"), encoding="utf-8"):
            f = line.rstrip("\n").split("\t")
            if len(f) < 9 or f[6] != "H":
                continue
            lat, lon = float(f[4]), float(f[5])
            if not inside(lat, lon):
                continue
            names = [f[1]] + [a for a in f[3].split(",") if a]
            out.append({"name": f[1], "alt": names, "code": f[7], "lat": lat, "lon": lon})
    return out


def wikidata():
    q = f"""
    SELECT ?item ?itemLabel ?coord WHERE {{
      ?item wdt:P31/wdt:P279* wd:Q355304 .
      SERVICE wikibase:box {{
        ?item wdt:P625 ?coord .
        bd:serviceParam wikibase:cornerSouthWest "Point({BBOX[1]} {BBOX[0]})"^^geo:wktLiteral .
        bd:serviceParam wikibase:cornerNorthEast "Point({BBOX[3]} {BBOX[2]})"^^geo:wktLiteral .
      }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "es,en". }}
    }}"""
    url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q)
    rows = json.loads(get(url))["results"]["bindings"]
    return [{"name": r["itemLabel"]["value"], "alt": [r["itemLabel"]["value"]], "id": r["item"]["value"].rsplit("/", 1)[-1]} for r in rows]


def ign():
    base = "https://wms.ign.gob.ar/geoserver/ows"
    caps = get(base + "?service=WFS&version=2.0.0&request=GetCapabilities", 120).decode("utf-8", "ignore")
    layers = sorted(set(re.findall(r"<(?:wfs:)?Name>([^<]*(?:curso|agua|hidro|rio|arroyo)[^<]*)</(?:wfs:)?Name>", caps, re.I)))
    print("IGN capas candidatas:", layers)
    out = []
    for layer in layers[:6]:
        url = (base + "?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326"
               f"&typeNames={urllib.parse.quote(layer)}&bbox={BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]},EPSG:4326&count=5000")
        try:
            fc = json.loads(get(url, 180))
        except Exception as e:  # noqa: BLE001
            print("IGN", layer, "falló:", e)
            continue
        for feat in fc.get("features", []):
            props = feat.get("properties") or {}
            for k in ("nam", "fna", "gna", "nombre", "name", "NAM", "FNA"):
                v = props.get(k)
                if isinstance(v, str) and v.strip():
                    out.append({"name": v.strip(), "alt": [v.strip()], "layer": layer, "field": k})
                    break
    return out


NAME_RE = re.compile(r"\b((?:R[ií]o|Arroyo|Aº|Ayo\.?|Canal|Riacho|Zanj[oó]n|Pasaje|Brazo)\s+(?:(?:de|del|de la|de las|de los|la|las|los|el)\s+)?[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñü.'-]*(?:\s+(?:de|del|la|las|los|el|[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñü.'-]*)){0,3})")


def page_names(url):
    """River and arroyo names written on a public web page (maps, guides)."""
    html = get(url, 60).decode("utf-8", "ignore")
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", "\n", text)
    import html as h
    text = h.unescape(text)
    found = sorted({m.group(1).strip(" .,;:") for line in text.splitlines() for m in NAME_RE.finditer(line.strip())})
    print(f"{url}: {len(found)} nombres", found[:400])
    return [{"name": n, "alt": [n]} for n in found]


def viatigre():
    return page_names("https://viatigre.com.ar/tigre/delta/mapa/")


def satellites_pro():
    return page_names("https://satellites.pro/plano/mapa_de_Delta_del_Tigre.Argentina")


def ign_geoportal():
    """Finds the geoservers the IGN geoportal uses and asks them for watercourses."""
    out = []
    pages = {}
    for u in ("https://www.ign.gob.ar/", "https://geoportal.ign.gob.ar/"):
        try:
            pages[u] = get(u, 60).decode("utf-8", "ignore")
            print(u, "OK", len(pages[u]), "bytes")
        except Exception as e:  # noqa: BLE001
            print(u, "falló:", e)
    servers = set()
    for html in pages.values():
        servers |= set(re.findall(r"https?://[\w.-]*ign\.gob\.ar/[\w/.-]*(?:geoserver|wms|wfs|ows)[\w/.-]*", html, re.I))
    for js in set(re.findall(r'src="([^"]+\.js)"', pages.get("https://geoportal.ign.gob.ar/", ""))):
        try:
            url = js if js.startswith("http") else urllib.parse.urljoin("https://geoportal.ign.gob.ar/", js)
            servers |= set(re.findall(r"https?://[\w.-]*ign\.gob\.ar/[\w/.-]*(?:geoserver|wms|wfs|ows)[\w/.-]*", get(url, 60).decode("utf-8", "ignore"), re.I))
        except Exception:  # noqa: BLE001
            pass
    servers |= {"https://wms.ign.gob.ar/geoserver/ows", "https://geoservicios.ign.gob.ar/geoserver/ows", "https://imagenes.ign.gob.ar/geoserver/ows"}
    print("IGN servidores candidatos:", sorted(servers))
    for base in sorted(servers):
        base = re.sub(r"(geoserver)(/.*)?$", r"\1/ows", base)
        try:
            caps = get(base + "?service=WFS&version=2.0.0&request=GetCapabilities", 90).decode("utf-8", "ignore")
        except Exception as e:  # noqa: BLE001
            print(base, "WFS falló:", e)
            continue
        layers = sorted(set(re.findall(r"<(?:wfs:)?Name>([^<]*(?:curso|agua|hidro|rio|arroyo|canal)[^<]*)</(?:wfs:)?Name>", caps, re.I)))
        print(base, "capas:", layers)
        layers = [l for l in layers if "aguas_continentales" in l] or layers
        for layer in layers:
            fc = {"features": []}
            # Axis order differs between servers: try lat,lon and lon,lat
            for bb in (f"{BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]},urn:ogc:def:crs:EPSG::4326", f"{BBOX[1]},{BBOX[0]},{BBOX[3]},{BBOX[2]},EPSG:4326"):
                url = (base + "?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326"
                       f"&typeNames={urllib.parse.quote(layer)}&bbox={bb}&count=5000")
                try:
                    fc = json.loads(get(url, 180))
                except Exception as e:  # noqa: BLE001
                    print("  ", layer, "falló:", e)
                    continue
                if fc.get("features"):
                    break
            n0 = len(out)
            feats = fc.get("features", [])
            if feats:
                print("  ", layer, len(feats), "rasgos; campos:", {k: v for k, v in (feats[0].get("properties") or {}).items()})
            for feat in feats:
                props = feat.get("properties") or {}
                for k, v in props.items():
                    if k.lower() in ("nam", "fna", "gna", "nombre", "name", "nom", "nombre_geo") and isinstance(v, str) and v.strip() and v.strip().lower() not in ("s/n", "sin nombre"):
                        out.append({"name": v.strip(), "alt": [v.strip()], "layer": layer})
                        break
            print("  ", layer, len(out) - n0, "nombres")
        if out:
            break
    return out


def ours():
    names = {}
    for path in glob.glob("src/world/data/delta-*.world.json"):
        world = os.path.basename(path).replace(".world.json", "")
        d = json.load(open(path, encoding="utf-8"))
        for r in d.get("rivers", []):
            names.setdefault(r["name"], set()).add(world)
        for a in d.get("waterAreas", []):
            if a.get("name"):
                names.setdefault(a["name"], set()).add(world)
    return names


def main():
    sources = {}
    for label, fn in (("GeoNames", geonames), ("Wikidata", wikidata), ("IGN", ign_geoportal), ("ViaTigre", viatigre), ("Satellites.pro", satellites_pro)):
        try:
            sources[label] = fn()
            print(f"{label}: {len(sources[label])} nombres")
        except Exception as e:  # noqa: BLE001
            print(f"{label}: no disponible ({e})")
            sources[label] = None
    index = {}
    for label, items in sources.items():
        if not items:
            continue
        idx = {}
        for it in items:
            for n in it["alt"]:
                idx.setdefault(norm(n), set()).add(it["name"])
        index[label] = idx
    rows = []
    for name, worlds in sorted(ours().items()):
        key = norm(name)
        row = {"name": name, "worlds": sorted(worlds), "sources": {}}
        for label, idx in index.items():
            if key in idx:
                exact = name in idx[key]
                row["sources"][label] = {"match": "exacto" if exact else "normalizado", "as": sorted(idx[key])[:3]}
            else:
                close = difflib.get_close_matches(key, list(idx.keys()), n=2, cutoff=0.82)
                row["sources"][label] = {"match": "parecido" if close else "no", "as": sorted({n for c in close for n in idx[c]})[:3]}
        rows.append(row)
    # Names on those sources that our maps lack (candidates: missing rivers or other spellings)
    have = {norm(n) for n in ours()}
    extra = {l: sorted({it["name"] for it in (sources[l] or []) if norm(it["name"]) not in have}) for l in ("IGN", "ViaTigre", "Satellites.pro")}
    for l, names in extra.items():
        print(f"{l}: {len(names)} nombres que nuestros mapas no tienen:", names[:300])
    json.dump({"bbox": BBOX, "missing_in_ours": extra, "available": [k for k, v in sources.items() if v], "rows": rows}, open("names-report.json", "w"), ensure_ascii=False, indent=1)
    labels = list(index.keys())
    with open("names-report.md", "w", encoding="utf-8") as f:
        f.write(f"# Cruce de nombres\n\nFuentes disponibles: {', '.join(labels) or 'ninguna'}\n\n")
        f.write("| Nombre en el juego | Mundos | " + " | ".join(labels) + " |\n|---|---|" + "---|" * len(labels) + "\n")
        for r in rows:
            cells = []
            for l in labels:
                s = r["sources"][l]
                cells.append({"exacto": "✅", "normalizado": "≈ " + ", ".join(s["as"]), "parecido": "❓ " + ", ".join(s["as"]), "no": "—"}[s["match"]])
            f.write(f"| {r['name']} | {', '.join(r['worlds'])} | " + " | ".join(cells) + " |\n")
    found = sum(1 for r in rows if any(s["match"] in ("exacto", "normalizado") for s in r["sources"].values()))
    print(f"{found}/{len(rows)} nombres confirmados por al menos una fuente")
    print(open("names-report.md", encoding="utf-8").read())


if __name__ == "__main__":
    sys.exit(main())
