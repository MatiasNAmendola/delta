# El Delta real desde OpenStreetMap

Los ríos actuales (`delta.world.json`) se dibujaron a mano para una prueba de concepto y no siguen el mapa
real de las secciones del Delta de Tigre. Este importador arma el mundo a partir de **OpenStreetMap**:
cursos de agua reales (ríos, canales, arroyos) y paradas reales (terminales fluviales y muelles con nombre).

> ¿Por qué no Google Maps? Sus términos de uso no permiten extraer geometría para reutilizarla, y además
> exige una API key. OpenStreetMap tiene licencia abierta (ODbL 1.0): se puede usar con atribución, que el
> importador agrega en `world.attribution`.

## Uso

```bash
scripts/osm/fetch-delta.sh        # descarga scripts/osm/delta-tigre.overpass.json (Overpass API)
npm run world:import              # genera src/world/data/delta-real.world.json
npm run dev                       # y abrí http://localhost:3000/delta/?world=delta-real
```

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

- Los ríos se dibujan como franjas de ancho fijo sobre su línea central. El contorno real de las orillas
  (polígonos `natural=water`) queda para una segunda etapa.
- La cobertura de paradas en OSM puede ser incompleta; se pueden agregar a mano en el JSON.
