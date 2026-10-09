# Encargo 03 — Familias de carpinchos que cruzan el río: frenar da puntos

Sos un agente de implementación e investigación sobre el repo **Delta**, un juego web (BabylonJS 7.54.3, TypeScript, Vite, vitest) sobre el Delta de Tigre.

**Visión del juego:** realista y con encanto. Busca enganchar a turistas y familias, y que los chicos aprendan a respetar el río.

**Lo que pide la dueña:** lugares del río donde puedan cruzar carpinchos, **una familia de carpinchos** que cruza nadando, y que el jugador **se tenga que detener** con la embarcación. Respetar la naturaleza **da puntos**.

Antes de tocar nada, leé `docs/TRASPASO.md`, `docs/adr/0015-reglas-por-via.md`, `src/game/navigationRules*` / `RuleBook`, `src/world/RiverBanks.ts` y `src/world/Yolas.ts`, que es tráfico que ya cruza el agua.

## Parte A — Investigación con fuentes (usá `--search`)
Escribí `docs/investigacion/12-carpinchos.md`, con cada dato acompañado de su URL. Que no sea una sola fuente por dato si se puede evitar.
- **El animal:** *Hydrochoerus hydrochaeris* en el Delta del Paraná y en Tigre.
  - ¿Dónde se los ve? ¿En bañados, en costas naturales, en islas poco pobladas, en Nordelta?
  - ¿En qué horario?
  - ¿Cómo es el grupo familiar? Tamaño, adultos y crías, cómo nadan en fila.
  - ¿Cómo cruzan? Velocidad de nado y cuánto tiempo pueden quedarse bajo el agua.
- **Lo que se le pide al navegante:**
  - recomendaciones oficiales o de ONG para embarcaciones frente a fauna: Municipio de Tigre, Prefectura, Parques Nacionales, Fundación Temaikèn o similares;
  - distancia y velocidad aconsejadas;
  - qué daño hace la ola de una lancha.
- **Qué no:** no inventes números. Lo que no encuentres, marcalo **[sin fuente]** y elegí un valor de juego razonable, dicho como tal.

## Parte B — Implementación
1. **Zonas de cruce.** Generalas a partir del mundo, no a mano:
   - tramos de arroyo angostos con **costa natural** (no tablestacado: `RiverBanks` tiene la reflectividad o el tipo de costa);
   - lejos de muelles y del centro de Tigre;
   - unas pocas por zona del mapa, con una semilla determinística.

   Ponelas en una función pura con su test.
2. **Familia de carpinchos.**
   - **Composición:** 2 adultos y de 2 a 5 crías, el número depende de la semilla.
   - **Modelo:** low-poly armado con primitivas. Cuerpo de barril, cabeza cuadrada, color pardo rojizo, sin cola. El estilo es el de `src/world/settlement/` y `StreamedBatch`: nada de modelos descargados.
   - **Comportamiento:**
     - salen de la costa, cruzan nadando en fila (se ve solo el lomo y la cabeza) y suben a la otra orilla;
     - en tierra, pastan en la costa entre cruces;
     - aparecen cuando el jugador se acerca a una zona, no en todo el mapa a la vez.
   - **Rendimiento:** que no sume más de 2 o 3 draw calls; que no se dibujen lejos y que aparezcan y desaparezcan con fundido (`addDistanceFade`).
3. **Regla de juego.** Integrala con `RuleBook` y con los avisos que ya existen.
   - Al acercarse a una familia que cruza, aparece el aviso **«Carpinchos cruzando — frená»**.
   - **Si el jugador se detiene o va a paso de hombre a una distancia prudente** (la de la investigación) **hasta que terminen de cruzar:** suma puntos, con el mensaje «¡Respetaste a los carpinchos! +N».
   - **Si pasa rápido o les llega la ola** (usá la altura de ola que ya calcula la física de la estela):
     - resta puntos, con un mensaje educativo y no agresivo;
     - los carpinchos se zambullen y reaparecen más lejos.
   - Nunca se los puede "atropellar": si hay choque, se zambullen.
   - Vale en manejo clásico y realista, y para todos los botes, kayak incluido (el kayak casi no hace ola: tiene que poder pasar despacio).
4. **Tests en `tests/`:**
   - la ubicación de las zonas;
   - la máquina de estados de la familia (en costa, cruzando, en la otra orilla, zambullida);
   - la regla de puntos: frenar suma, pasar rápido resta.
5. **Documentación:** `docs/adr/0018-fauna-carpinchos.md` (decisión, alternativas, fuentes) y una línea en `docs/README.md`.

## Prohibiciones
- **Git:**
  - nada de push a `main` ni a `claude/delta-boat-game-qlfo3`;
  - nada de `git stash`, `rebase`, `push --force` ni `--no-verify`.
- **Tests:** no saltear tests ni typecheck: no se vale `it.skip`, ni borrar tests, ni `@ts-ignore`.
- **Archivos:**
  - no borres nada fuera de tu worktree;
  - no cambies dependencias en `package.json` ni en el lockfile;
  - no toques `src/world/data/**`.
- **Fuentes:** no uses Google Maps ni Google Earth como fuente de datos.

## Comandos
```
cd <repo delta>
git fetch origin claude/delta-boat-game-qlfo3
git worktree add ../delta-sol-03-carpinchos -b sol/03-carpinchos origin/claude/delta-boat-game-qlfo3
cd ../delta-sol-03-carpinchos
heavy "sol-03: npm ci" -- npm ci
heavy "sol-03: bake" -- npm run bake
# ... investigación, implementación ...
heavy "sol-03: tsc" -- npx tsc --noEmit
heavy "sol-03: vitest" -- npx vitest run
heavy "sol-03: build" -- npm run build
git add -A && git commit -m "feat(fauna): capybara families crossing the arroyos; stopping for them scores"
git push -u origin sol/03-carpinchos
git ls-remote origin sol/03-carpinchos
```
- Si `heavy` devuelve 3 o 4, o imprime `heavy-lane: not-run`, esperá 300 s y reintentá.
- Commiteá y hacé push a medida que avanzás: primero la investigación, después el código.
- Si podés, sacá capturas de una familia cruzando y del aviso. Guardalas en `encargos/evidencia/03-*.png`. Te puede servir `encargos/herramientas/estela-celu.mjs` como base.

## Salida esperada (en tu .resultado.md)
1. **Lo investigado, en 10 líneas**, con cada dato y su URL.
2. **Los archivos tocados**, con una línea cada uno.
3. **La tabla `comando | exit`** con todos los comandos, con su exit real.
4. **La salida literal** de `git ls-remote origin sol/03-carpinchos`.
5. **Lo que no pudiste verificar**, dicho así.
