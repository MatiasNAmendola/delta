# El Delta real desde OpenStreetMap

Los ríos actuales (`delta.world.json`) se dibujaron a mano para una prueba de concepto y no siguen el mapa
real de las secciones del Delta de Tigre. Este importador arma el mundo a partir de **OpenStreetMap**:
cursos de agua reales (ríos, canales, arroyos) y paradas reales (terminales fluviales y muelles con nombre).

> ¿Por qué no Google Maps? Sus términos de uso no permiten extraer geometría para reutilizarla, y además
> exige una API key. OpenStreetMap tiene licencia abierta (ODbL 1.0): se puede usar con atribución, que el
> importador agrega en `world.attribution`.

## Estado actual

El juego ya arranca en el **Delta real** (`src/world/data/delta-real.world.json`); la prueba de concepto
dibujada a mano sigue disponible con `?world=delta`.

- **114 cursos de agua reales** de la Primera Sección: Luján, Tigre, Sarmiento, Capitán, San Antonio,
  Abra Vieja, Paraná de las Palmas, Reconquista y más de 100 arroyos y canales.
- **16 paradas:** 4 terminales reales de OSM (Estación Fluvial Domingo F. Sarmiento, Tres Bocas, Muelle
  Municipal Tamarindo, Sturla) y 12 paradas ubicadas en **confluencias reales** (p. ej. "Río Capitán y Arroyo
  Capitán Viejo"). La geografía es real; esas 12 paradas son una aproximación porque los muelles numerados de
  la lancha colectiva no están cargados en OSM.
- Escala 1:8: el mundo mide 2.800 unidades (unos 22 km reales). Draw calls por frame: ~51.
- Datos: exportación de HOT basada en el snapshot de Geofabrik del 10-05-2026.

## Uso

```bash
scripts/osm/fetch-delta.sh        # datos frescos desde la Overpass API
# o, si Overpass no es accesible (como en el entorno en la nube):
scripts/osm/fetch-hot.sh          # exportación de Humanitarian OpenStreetMap Team (S3)

npm run world:import -- --origin -34.35,-58.54 --size 2800   # genera src/world/data/delta-real.world.json
npm run dev
```

Las dos descargas dejan el mismo archivo, `scripts/osm/delta-tigre.overpass.json`, que queda versionado para
que el mundo se pueda regenerar sin red.

- La zona por defecto es la Primera Sección de islas (`-34.43,-58.66` a `-34.27,-58.42`); se puede pasar otra:
  `scripts/osm/fetch-delta.sh <sur> <oeste> <norte> <este>`.
- `--scale 8` (por defecto) achica el mapa 8 veces: el Delta real, de unos 20 km, queda en un mundo de unas 2.600
  unidades, que la lancha cruza en un par de minutos. Con `--scale 1` es tamaño real.
- `--unnamed` incluye arroyos sin nombre en OSM (por defecto se descartan).

## Qué hace el importador (`scripts/osm/osmToWorld.ts`)

1. Agrupa los tramos de cada curso de agua por nombre y los une por sus extremos (OSM parte un río en muchos tramos).
2. Proyecta lat/lon a metros alrededor del centro de la zona y aplica la escala.
3. Simplifica las líneas (Douglas-Peucker) y recorta lo que queda fuera del mundo.
4. Ancho: usa la etiqueta `width` de OSM si existe; si no, un ancho típico por tipo (río 150 m, canal 40 m,
   arroyo 30 m), nunca menor que lo navegable por la lancha.
5. Muelles: terminales fluviales, muelles con nombre y paradas de lancha. La lancha arranca en la Estación Fluvial.
6. Valida el resultado con el mismo validador del juego.

## Limitaciones conocidas

- El Río Carapachay y el Arroyo Espera no están mapeados en OSM como línea (solo como polígono de agua),
  así que todavía no aparecen. Se resuelve importando los polígonos `natural=water` (siguiente etapa).
- 174 tramos sin nombre se descartan para no llenar el mapa de zanjas; `--unnamed` los incluye.

- Los ríos se dibujan como franjas de ancho fijo sobre su línea central. El contorno real de las orillas
  (polígonos `natural=water`) queda para una segunda etapa.
- La cobertura de paradas en OSM puede ser incompleta; se pueden agregar a mano en el JSON.
