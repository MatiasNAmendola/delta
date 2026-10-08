# Contribuir a Delta

Mandá un PR por cambio contra `claude/delta-boat-game-qlfo3`. Describí qué cambia y cómo comprobarlo. Las fuentes y los créditos están en [CREDITS.md](CREDITS.md), y las reglas de trabajo en [docs/TRASPASO.md](docs/TRASPASO.md).

## Datos del mapa

Cada dato tiene que llevar fuente, URL, fecha de consulta y licencia o permiso de uso. Un nombre de río se cambia solo con dos fuentes independientes que coincidan y correspondan al mismo lugar. Las grafías dudosas quedan pendientes. No se aceptan datos sacados de Google Maps ni Google Earth, por sus términos de uso.

- **Correcciones de nombres:** [scripts/osm/name-fixes.json](scripts/osm/name-fixes.json). `rename` usa el nombre original como clave y un objeto con `to` (nombre corregido) y `source` (texto de evidencia). Incluí las dos URLs y sus fechas en `source`. `drop` usa el nombre a quitar como clave y el motivo como valor de texto, también con fuente y fecha.
- **Cursos que faltan:** [scripts/osm/supplements/](scripts/osm/supplements/). Los archivos `*.overpass.json` tienen `source` (texto con procedencia, URL, fecha y atribución) y `elements` (elementos Overpass). El [suplemento del Carapachay](scripts/osm/supplements/osm-rio-carapachay.overpass.json) contiene un `way` con `id`, `geometry` (pares `lat`/`lon`) y `tags` (`name`, `waterway`). Conservá los identificadores y la atribución de OSM. El GeoJSON del IGN que está en esa carpeta es referencia, no el formato que importa el juego.
- **Investigación:** dejá el contraste, las dudas y las fuentes en [docs/investigacion/](docs/investigacion/README.md). Mirá el [inventario del mapa](docs/investigacion/07-fuentes-del-mapa.md) y el [cruce de nombres](docs/investigacion/10-cruce-de-nombres.md).

Los extractos y las bases derivadas de OSM conservan ODbL 1.0 y la atribución «© OpenStreetMap contributors».

## Código

Desde la raíz del checkout, con Node.js y npm instalados (macOS/zsh o Linux/bash), tienen que pasar:

```sh
npm ci
npm run bake
npx tsc --noEmit
npx vitest run
```

Incluí el resultado en el PR. Si el entorno tiene `heavy`, usalo para los comandos pesados como indica el traspaso. Actualizá los docs cuando cambie el comportamiento.

## Fotos y modelos 3D

Solo se aceptan materiales de autoría propia o con licencia CC0 / CC BY. Para material propio, indicá la autoría y que se aporta bajo Apache 2.0. Para terceros, adjuntá el enlace al original, autor, título, versión y enlace de la licencia, fecha de consulta y cambios realizados. Sumá la atribución a [CREDITS.md](CREDITS.md) y conservá la licencia de origen.

No se aceptan fotos que identifiquen personas sin su consentimiento.

Como límite por archivo, usá **2 MiB por modelo GLB**, con texturas incluidas, y **1 MiB por foto**. Optimizá antes de subir. Los tamaños de referencia actuales son 1.131.716 bytes para la lancha y 279.824 bytes para el muelle; se reproducen con el comando de tamaños de [CREDITS.md](CREDITS.md). Si hace falta superar el límite, explicá el motivo y el impacto en la descarga desde celulares en el PR.

## Licencia de los aportes

Lo que se aporta intencionalmente para incluir en Delta entra bajo Apache License 2.0, por su cláusula 5, sin CLA ni DCO. Consultá el [texto completo](LICENSE). Los derechos y avisos de terceros se conservan bajo sus licencias originales, incluidas ODbL, CC0 y CC BY.
