# El Delta real desde OpenStreetMap

Los ríos actuales (`delta.world.json`) se dibujaron a mano para una prueba de concepto y no siguen el mapa
real de las secciones del Delta de Tigre. Este importador arma el mundo a partir de **OpenStreetMap**:
cursos de agua reales (ríos, canales, arroyos) y paradas reales (terminales fluviales y muelles con nombre).

> ¿Por qué no Google Maps? Sus términos de uso no permiten extraer geometría para reutilizarla, y además
> exige una API key. OpenStreetMap tiene licencia abierta (ODbL 1.0): se puede usar con atribución, que el
> importador agrega en `world.attribution`.

## Estado actual

El juego arranca en el **Delta real** (`src/world/data/delta-real.world.json`); la prueba de concepto
dibujada a mano sigue disponible con `?world=delta`.

- **114 cursos de agua reales** de la Primera Sección (Luján, Tigre, Sarmiento, Capitán, San Antonio,
  Abra Vieja, Paraná de las Palmas, Reconquista y más de 100 arroyos y canales).
- **215 áreas de agua con su forma real** (polígonos de OSM con las islas como huecos): el ancho verdadero de
  los ríos, las dársenas y marinas de Tigre, el Arroyo Espera, etc. 8.591 vértices, muy por debajo del
  presupuesto de 60.000 que valida el World Doc.
- **16 paradas:** 4 terminales reales (Estación Fluvial Domingo F. Sarmiento, Tres Bocas, Muelle Municipal
  Tamarindo, Sturla) y 12 en **confluencias reales**. Los muelles numerados de la colectiva no están en OSM.
- Escala 1:8: mundo de 2.800 unidades (~22 km reales). ~46 draw calls por frame.
- El agua navegable es la unión de líneas centrales y polígonos. Las áreas se dibujan en una sola malla; las
  franjas de los ríos se dibujan solo donde no hay polígono, para no superponer dos superficies de agua.

## Actualizar el mapa

```bash
npm run map:update                     # descarga, reconstruye, valida y muestra qué cambió
npm run map:update -- --source hot     # forzar la exportación de HOT (o --source overpass)
npm run dev                            # revisar en http://localhost:3000/delta/?view=aerial
```

`map:update` intenta primero la Overpass API (datos al minuto) y, si no responde, usa la exportación de
Humanitarian OpenStreetMap Team (actualizada periódicamente desde Geofabrik). La zona, el centro, la escala y el
tamaño están en `scripts/osm/delta.config.json`. Al final imprime el resumen: ríos, paradas y áreas antes y
después, con los nombres nuevos o eliminados.

**Desde GitHub, sin máquina local:** pestaña *Actions* → *Update map from OpenStreetMap* → *Run workflow*.
Corre lo mismo y abre un pull request con los cambios para revisarlos antes de mezclar. (Requiere que el repo
permita a GitHub Actions crear pull requests: *Settings → Actions → General → Workflow permissions*.)

`?view=aerial` pone la cámara alta sobre la lancha para revisar la forma del mapa.

### Pasos sueltos (si hace falta)

- `scripts/osm/fetch-delta.sh` / `scripts/osm/fetch-hot.sh`: solo descargar (dejan `scripts/osm/delta-tigre.overpass.json`).
- `npm run world:import -- --origin -34.35,-58.54 --size 2800`: solo reconstruir el mundo.

## Qué hace el importador (`scripts/osm/osmToWorld.ts`)

1. Agrupa los tramos de cada curso de agua por nombre y los une por sus extremos (OSM parte un río en muchos tramos).
2. Proyecta lat/lon a metros alrededor del centro de la zona y aplica la escala.
3. Simplifica las líneas (Douglas-Peucker) y recorta lo que queda fuera del mundo.
4. Ancho: usa la etiqueta `width` de OSM si existe; si no, un ancho típico por tipo (río 150 m, canal 40 m,
   arroyo 30 m), nunca menor que lo navegable por la lancha.
5. Muelles: terminales fluviales, muelles con nombre y paradas de lancha. La lancha arranca en la Estación Fluvial.
6. Áreas de agua: arma los multipolígonos (anillos exteriores e islas), los recorta al mundo, los simplifica
   y descarta piezas e islas diminutas; solo agua navegable (ríos, canales, dársenas), no estanques ni humedales.
7. Valida el resultado con el mismo validador del juego.

## Limitaciones conocidas

- El Río Carapachay no tiene nombre ni en las líneas ni en los polígonos de la exportación de HOT; su agua
  aparece (polígono sin nombre) pero el juego no muestra su nombre. Se puede corregir en OpenStreetMap mismo.
- HOT exporta pocas relaciones multipolígono; con la Overpass API (`--source overpass`) se obtienen todas.
- 174 tramos sin nombre se descartan para no llenar el mapa de zanjas; `--unnamed` los incluye.

- La cobertura de paradas en OSM puede ser incompleta; se pueden agregar a mano en el JSON.
