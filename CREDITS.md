# Créditos y licencias de terceros

Relevamiento: 2026-10-08. El código de Delta está bajo [Apache 2.0](LICENSE). Los datos, las fuentes y los assets de terceros conservan sus propias licencias. `[sin verificar]` señala un permiso, una licencia o una autoría que la evidencia disponible no permite confirmar.

## Datos del mapa y fuentes de contraste

| Fuente | Uso comprobado | Licencia y atribución |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/copyright), colaboradores | Geometría y nombres de los extractos `scripts/osm/*.overpass.json`, suplemento Carapachay y mapas `src/world/data/*.world.json`. Descarga mediante HOT (Humanitarian OpenStreetMap Team), snapshots Geofabrik y Overpass; ver [fetch-hot.sh](scripts/osm/fetch-hot.sh). | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). **© OpenStreetMap contributors**. Los extractos y las bases derivadas conservan ODbL; Apache 2.0 cubre el código. |
| Municipio de Tigre, Secretaría de Turismo, [Viví Tigre](https://vivitigre.gob.ar/mapa-digital/) (edición agosto 2026) | Contraste del Carapachay en el suplemento OSM. Recorridos y puntos de interés transcriptos en [doc 12](docs/investigacion/12-vivi-tigre-recorridos-y-puntos.md) y su [JSON](docs/investigacion/12-vivi-tigre-mapa.json); esa transcripción aún está pendiente de integrar al juego. Ver también [doc 07, A10](docs/investigacion/07-fuentes-del-mapa.md). | **Fuente: Municipio de Tigre – Viví Tigre**. Licencia y autorización de reutilización de la transcripción **[sin verificar]**. Las imágenes del folleto no se redistribuyen en `public/`. |
| [Instituto Geográfico Nacional de la República Argentina](https://www.ign.gob.ar/NuestrasActividades/InformacionGeoespacial/CapasSIG) | Confirmación de nombres (Canal Hondo, Arroyo Caracolas) en [name-fixes.json](scripts/osm/name-fixes.json). Referencia del Carapachay en [GeoJSON](scripts/osm/supplements/ign-rio-carapachay.geojson); su geometría no se importa al juego. | **Fuente: Instituto Geográfico Nacional de la República Argentina**. Licencia exacta y alcance del permiso **[sin verificar]**; ver [doc 07, A3–A4](docs/investigacion/07-fuentes-del-mapa.md). No se atribuye al IGN la licencia de los espejos provinciales. |
| [GeoNames](https://www.geonames.org/export/) | Volcado de Argentina para cruce de nombres y correcciones de Urión, Pay Carabi, Gelvez, Hondo y Caracolas. [Script de contraste](scripts/names/check_names.py), [doc 10](docs/investigacion/10-cruce-de-nombres.md). | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Atribución: **GeoNames**. Nombres seleccionados y normalizados para contraste. |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing) | Cursos de agua con coordenadas para validar nombres en el script de contraste. No aporta la geometría del mapa. | Datos estructurados bajo [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Fuente: **Wikidata**. |
| [ViaTigre](https://viatigre.com.ar/tigre/delta/mapa/) | Lista de ríos usada para contraste y correcciones Urión, Pay Carabi y Gelvez. | Fuente: **ViaTigre**. Licencia de reutilización de su contenido **[sin verificar]**. |
| [Argenprop](https://www.argenprop.com/negocios-especiales/partido-de-tigre/dolares-hasta-75000) | Aviso usado como confirmación contextual de Urión en `name-fixes.json` y doc 10. | Fuente: **Argenprop**; autor del aviso y licencia de reutilización **[sin verificar]**. No se copian fotos ni textos del aviso al juego. |

El [inventario del doc 07](docs/investigacion/07-fuentes-del-mapa.md) incluye fuentes candidatas. Provincia/IDEBA, Sentinel-2, Copernicus, SRTM, SHN, SMN y los kits Kenney/Quaternius mencionados en planes no se presentan acá como datos o assets integrados: el pipeline y los recursos actuales no prueban ese uso. Satellites.pro se consulta en el script de contraste, pero el [doc 10](docs/investigacion/10-cruce-de-nombres.md) registra que no devuelve nombres útiles.

## Río y viento en vivo

| Fuente | Uso comprobado | Licencia y atribución |
|---|---|---|
| [INA, API a5](https://alerta.ina.gob.ar/a5/obs/puntual/series/52/observaciones), red de escalas de Prefectura Naval Argentina | Altura y tendencia del río en San Fernando, serie 52, leídas por [liveConditions.ts](src/world/liveConditions.ts). Procedencia de la red en [doc 06](docs/investigacion/06-prueba-de-fuentes.md). | **Fuente: Instituto Nacional del Agua (INA) · Prefectura Naval Argentina**. Licencia de reutilización de las observaciones **[sin verificar]**. Que la API sea pública no prueba una licencia abierta. |
| [Open-Meteo](https://open-meteo.com/en/terms) | Velocidad, dirección y ráfagas de viento en Tigre, API forecast en `liveConditions.ts`. | Datos [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). **Weather data by Open-Meteo.com**. La API gratuita tiene condiciones de uso no comercial independientes de la licencia de los datos. |

## Modelos, texturas, fotos e iconos

| Recurso | Procedencia comprobada | Licencia y atribución |
|---|---|---|
| [lancha-optimized.glb](public/models/lancha-optimized.glb), incluida su textura embebida | El commit `28eea56` registra un modelo Tripo3D optimizado con glTF-Transform; `3bdb823` vuelve al modelo aportado por el usuario. El GLB declara `glTF-Transform v4.3.0` como generador. | **[sin verificar]**: autor/titular del modelo y textura, enlace al original y licencia o permiso bajo las condiciones de Tripo3D aplicables al momento de generación. El generador del archivo no prueba autoría ni licencia. |
| [grass.png](https://assets.babylonjs.com/textures/grass.png), [grassn.png](https://assets.babylonjs.com/textures/grassn.png), [waterbump.png](https://assets.babylonjs.com/textures/waterbump.png) | CDN de BabylonJS; intentos de carga en [Environment.ts](src/world/Environment.ts) y [WaterSystem.ts](src/world/WaterSystem.ts), con respaldo procedural. Los bytes coinciden con `textures/` del repo BabylonJS/Assets mediante el comando de abajo. | **Babylon.js Assets**, [CC BY 4.0](https://github.com/BabylonJS/Assets/blob/master/LICENSE), según su [README](https://github.com/BabylonJS/Assets/blob/master/README.md). Se usan sin modificación del archivo; el juego ajusta su escala. Autor individual de cada textura **[sin verificar]**. |
| Fotos de referencia del Delta | Fotos aportadas por el usuario, descriptas en [doc 11](docs/investigacion/11-ecosistema-en-fotos.md); sirven de referencia visual para el entorno y el muelle. No se distribuyen como fotos o texturas en `public/`. | Autoría y permiso de las fotos **[sin verificar]**. No se les asigna CC0 ni CC BY. |

El [muelle.glb](public/models/muelle.glb) se genera con [muelle.py](scripts/models/blender/muelle.py) y [common.py](scripts/models/blender/common.py), con materiales procedurales (commit `90002a4`). Los iconos de `public/icons/` se generan con [icon.html](scripts/icons/icon.html) usando Fraunces e Inter (commit `c296afe`). Son recursos del proyecto; las tipografías se acreditan abajo. `public/textures/` no existe en este checkout. Los demás barcos y la vegetación usan geometría y texturas procedurales del repo. El archivo `public/models/lancha.zip` no está en el árbol actual; decidir su purga del historial sigue pendiente.

## Dependencias de ejecución y tipografías

Licencias leídas de los paquetes instalados con `npm ci`, versiones fijadas por `package-lock.json`. El bloque de evidencia permite regenerar la tabla. Las herramientas de desarrollo y los repos de benchmarks/catálogos no son dependencias de ejecución del juego.

| Paquete | Versión | Licencia declarada |
|---|---|---|
| [@babylonjs/core](https://www.npmjs.com/package/@babylonjs/core) | 7.54.3 | Apache-2.0 |
| [@babylonjs/gui](https://www.npmjs.com/package/@babylonjs/gui) | 7.54.3 | Apache-2.0 |
| [@babylonjs/loaders](https://www.npmjs.com/package/@babylonjs/loaders) | 7.54.3 | Apache-2.0 |
| [@babylonjs/materials](https://www.npmjs.com/package/@babylonjs/materials) | 7.54.3 | Apache-2.0 |
| [@fontsource-variable/fraunces](https://www.npmjs.com/package/@fontsource-variable/fraunces) | 5.2.8 | OFL-1.1 |
| [@fontsource-variable/inter](https://www.npmjs.com/package/@fontsource-variable/inter) | 5.2.8 | OFL-1.1 |
| [earcut](https://www.npmjs.com/package/earcut) | 3.2.4 | ISC |
| [gsap](https://www.npmjs.com/package/gsap) | 3.13.0 | [Standard 'no charge' license](https://gsap.com/standard-license/), licencia propia de GSAP |

Fraunces e Inter se usan en la interfaz y los iconos, sin cambios a los archivos de fuentes. El `LICENSE` del paquete Fraunces instalado indica **Google Inc.** y OFL 1.1; la [fuente upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt) incluye **Copyright 2018 The Fraunces Project Authors**. El paquete Inter incluye **Copyright 2016 The Inter Project Authors**, [proyecto Inter](https://github.com/rsms/inter), bajo OFL 1.1. Conservá los avisos y textos de licencia de los paquetes al redistribuir las fuentes. GSAP conserva su licencia propia y sus avisos de Webflow; no se relicencia bajo Apache 2.0.

## Evidencia reproducible

Desde la raíz del checkout, en macOS/zsh o Linux/bash, con Node.js, npm, Git, curl y Python 3 instalados. Instalá primero las dependencias con `npm ci` (usá `heavy` si el host lo exige).

```sh
ls public/ public/models public/textures 2>/dev/null
# public/textures no existe: ls devuelve 1 por ese argumento.
git log --format='%h %s' -- public/
grep -rn -i -E "cc0|cc-by|cc by|odbl|licen|polyhaven|ambientcg|kenney|sketchfab|quaternius" docs src scripts public --include='*.md' --include='*.ts' --include='*.json'
cat scripts/osm/name-fixes.json
npm ls --omit=dev --depth=0
head -n 7 node_modules/@fontsource-variable/fraunces/LICENSE node_modules/@fontsource-variable/inter/LICENSE
node -e 'const fs=require("node:fs"); for(const name of Object.keys(require("./package.json").dependencies)){const p=JSON.parse(fs.readFileSync(`node_modules/${name}/package.json`,"utf8")); console.log(name,p.version,p.license)}'
python3 -c 'from pathlib import Path; [print(p, p.stat().st_size, "bytes") for p in sorted(Path("public/models").glob("*.glb"))]'
git show --stat 28eea56
git show --stat 3bdb823
git show --stat 90002a4
git show --stat c296afe
```

Para repetir la comparación de los archivos del CDN con el repo de assets y su licencia (exit 0: coinciden; 1: difieren; 2: error de consulta):

```sh
python3 - <<'PY'
import hashlib, sys, urllib.request
try:
    def digest(url):
        with urllib.request.urlopen(url, timeout=30) as response:
            data = response.read(8 * 1024 * 1024 + 1)
        if len(data) > 8 * 1024 * 1024:
            raise ValueError('Recurso excede el límite de consulta')
        return hashlib.sha256(data).hexdigest()
    same = True
    for name in ('grass.png', 'grassn.png', 'waterbump.png'):
        cdn = digest('https://assets.babylonjs.com/textures/' + name)
        repo = digest('https://raw.githubusercontent.com/BabylonJS/Assets/master/textures/' + name)
        print(name, cdn, repo)
        same = same and cdn == repo
    sys.exit(0 if same else 1)
except Exception as error:
    print(error, file=sys.stderr)
    sys.exit(2)
PY
curl -fsS --max-time 60 https://raw.githubusercontent.com/BabylonJS/Assets/master/LICENSE
curl -fsS --max-time 60 https://raw.githubusercontent.com/BabylonJS/Assets/master/README.md
```

Consulta de licencias de datos: [OSM](https://www.openstreetmap.org/copyright), [GeoNames](https://download.geonames.org/export/dump/readme.txt), [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing) y [Open-Meteo](https://open-meteo.com/en/terms), revisadas el 2026-10-08. Las fuentes sin permiso comprobable quedan señaladas en las tablas.

Para verificar los enlaces relativos de README, CONTRIBUTING y CREDITS (exit 0: existen; 1: hay enlaces rotos):

```sh
node -e 'const fs=require("node:fs"),path=require("node:path");let bad=false;for(const file of ["README.md","CONTRIBUTING.md","CREDITS.md"]){for(const m of fs.readFileSync(file,"utf8").matchAll(/\]\(([^)]+)\)/g)){const target=m[1].split("#")[0];if(target&&!/^[a-z][a-z0-9+.-]*:/i.test(target)&&!fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(target)))){console.error(file+": "+target);bad=true}}}process.exit(bad?1:0)'
```
