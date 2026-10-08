# Traspaso de la sesión (2026-10-08)

Punto de partida para seguir Delta en otra sesión (local, en la nube o con agentes Sol). Si vas a seguir el trabajo, leé esto primero.

## Qué es
Delta es un juego web gratuito, pensado para celulares, sobre el Delta del Paraná en Tigre. Usa BabylonJS 7.54.3, TypeScript, Vite, PWA y vitest.
- **Visión:** realista y con encanto, no de carreras. Busca enganchar a turistas y familias (Puerto de Frutos, excursiones, chicos en los restaurantes) y que les den ganas de subirse a las lanchas colectivas.
- **Rama de trabajo:** `claude/delta-boat-game-qlfo3`. Se publica en GitHub Pages: https://matiasnamendola.github.io/delta/

## Cómo correrlo
```
npm ci
npm run bake          # world.json -> layout.bin (lo hacen también dev y build)
npm run dev           # vite (en la nube se usó el puerto 4102)
npx vitest run        # 157 tests
npx tsc --noEmit
```
- **Parámetros de URL útiles:**
  - `?world=delta-tigre-real|delta-segunda|delta-guazu|delta-escobar`;
  - `?spawn=<id-de-parada>`, `?view=aerial`, `?boat=kayak`;
  - `?manejo=realista`, `?estacion=`, `?clima=`, `?fps=`, `?perf=1`.
- **Mapa:** `npm run map:update` (ver `scripts/osm/update-map.sh`).
  - Los suplementos de ríos que faltan en el extracto van en `scripts/osm/supplements/*.overpass.json`, siempre con su fuente.
  - Las correcciones de nombres van en `scripts/osm/name-fixes.json`, con fuente y regla de dos fuentes.

## Dónde está todo
- `docs/README.md`: índice.
- `docs/producto/PRD.md`: producto.
- `docs/adr/0001…0016`: decisiones de física, render, PWA, reglas por vía, nombres, etc.
- `docs/investigacion/01…11`: investigación con fuentes. Entre otros:
  - barcos de Tigre;
  - maniobra;
  - reglas de navegación;
  - estelas;
  - APIs;
  - 44 fuentes del mapa;
  - Gaussian splatting (veredicto: no para la vegetación);
  - estrategia de datos;
  - cruce de nombres;
  - ecosistema en fotos.
- `.github/workflows/check-names.yml`: cruza los nombres con GeoNames, Wikidata, el IGN y ViaTigre, y busca en OSM con Overpass. Sirve para traer datos que el contenedor no alcanza: los resultados se leen en el log del job.

## Últimos hechos
- **Río Carapachay agregado** desde OSM (way 30164212). Lo confirman el IGN, ViaTigre y el mapa municipal «Viví Tigre». Ver doc 10.
- **Ecosistema de las fotos de referencia:**
  - reflejos de árboles en el agua;
  - botes amarrados y marinas;
  - casuarinas y estaciones;
  - muelles pintados, escalones y escalera de palafito;
  - troncos y juncos;
  - skyline de las ciudades.
- **Folleto «Viví Tigre»** documentado como fuente en el doc 07, A10.

## Pendiente (por prioridad sugerida)
1. **Puntos de interés y recorridos reales de las colectivas** (Líneas Delta, Jilguero e Interisleña), tomados del folleto «Viví Tigre», transcriptos a mano y con la fuente.
2. **Relieve del terreno** con un DEM abierto (Copernicus o SRTM).
3. **Impostores para los árboles lejanos** (ADR 0003): la vista aérea se ve pelada a lo lejos.
4. **Más barcos:** colectiva de fibra, catamarán, almacenera y bote de travesía (de madera o de fibra).
5. **Ancho real de los arroyos** (máscara de agua de Sentinel-2), para activar la regla de "angosto".
6. **Grafías dudosas**, esperando confirmación de la dueña:
   - Chileno / Chileño;
   - Correa / Correas;
   - Tutuparé / Tuyuparé;
   - Guazú Nambí;
   - Bajos / Bajo del Temor.
7. **Vista dron** (ADR 0006) y **clubes emblemáticos** (ADR 0007).
8. **Archivos y repo:**
   - LICENSE, README y CREDITS;
   - `.env*` en `.gitignore`;
   - decidir si se purga `public/models/lancha.zip` del historial. Para eso hay que reescribir la historia, y eso solo se hace con aprobación explícita.

## Reglas de trabajo
- **Git:**
  - commitear y subir solo a `claude/delta-boat-game-qlfo3`;
  - no abrir PRs sin pedido;
  - no hacer push a main, force, rebase ni stash, ni usar `--no-verify`.
- **Fuentes:**
  - documentar todas las fuentes;
  - no usar Google Maps ni Google Earth como fuente de datos (por sus términos);
  - un nombre de río se cambia solo con dos fuentes que coincidan.
- **Implementación con agentes GPT-6.1 Sol (Codex por CLI):** Claude escribe el encargo, revisa contra el artefacto y decide.
  - **Revisión:** `git ls-remote` del SHA, el diff y 2 o 3 comandos con su exit. Lo que no se pueda volver a comprobar se toma como refutado.
  - **Máquina:** como mucho 1 o 2 agentes por sesión. Los comandos pesados van con `heavy "<quién: qué>" -- <cmd>`.
