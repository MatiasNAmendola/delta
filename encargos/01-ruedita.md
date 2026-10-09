# Encargo 01 — Control "Ruedita" (joystick táctil) para el celular

Sos un agente de implementación sobre el repo **Delta**, un juego web (BabylonJS 7.54.3, TypeScript, Vite, vitest) sobre el Delta de Tigre. La dueña quiere conducir desde el celular con una **ruedita** (un joystick virtual que se arrastra con el pulgar) en lugar de apretar flechas una y otra vez. Tiene que ser **una opción más de conducción** y **el jugador la elige al inicio**.

Antes de tocar nada, leé `docs/TRASPASO.md` y `docs/adr/0013-manejo-realista.md`.

## Contexto del código (verificalo vos, no lo des por cierto)
- `src/controls/MobileControls.ts` define el tipo `ControlScheme = "botones" | "flechas" | "palanca"`, guardado en localStorage con la clave `delta.controles`.
  - `setScheme()` muestra u oculta los botones `btnForward`, `btnReverse`, `btnLeft` y `btnRight`, y los widgets.
  - `update(dt)` arma el `ControlState`:
    - `throttle` viene de `this.lever` (un `ThrottleLever`), salvo en "flechas";
    - `steering` va de -1 a 1;
    - `helmIsPosition` indica si el timón es una posición o un "girar mientras apretás".
- `src/controls/widgets.ts` tiene `LeverWidget` y `WheelWidget`, dos widgets de pointer events con estilos inyectados. Seguí ese mismo patrón.
- `src/ui/StartScreen.ts`: los chips de "Controles" están **escondidos** en el panel Ajustes (`renderSettings()`).
- `src/GameEngine.ts`, alrededor de la línea 327:
  - los botes "a remo" (kayak, single) fuerzan "botones";
  - `setScheme(..., { telegraph, wheelStays })`;
  - `setGaugeVisible(scheme !== "palanca")`.
- `src/controls/handlingInput.ts` traduce los controles a órdenes del manejo realista.

## Qué hay que hacer
1. **Nuevo esquema `"ruedita"`**, con la etiqueta «Ruedita».
   - **Dónde y cómo se ve:**
     - un joystick abajo a la izquierda, que reemplaza a los 4 botones;
     - una base circular de unos 130 px, con un pomo que sigue al dedo y no sale del círculo;
     - zona muerta de 0,12;
     - el pomo vuelve al centro al soltar, con una animación corta.
   - **Mapeo:**
     - el eje Y fija el acelerador: arriba avante, abajo atrás, con `this.lever.set(y)`;
     - el eje X es el timón, como "girar mientras empujás" (`helmIsPosition = false`).
   - **Al soltar:**
     - el **timón vuelve a 0**;
     - **el acelerador queda donde estaba**, como crucero: es la convención del juego, donde la palanca queda donde la dejás. Así no hace falta mantener el dedo apretado para ir;
     - el botón PARADA ya lleva el acelerador a neutro;
     - con manejo realista y rueda de timón (`telegraph`), el acelerador se ajusta a una de las 5 posiciones `[-1, -0.5, 0, 0.5, 1]`.
   - **Indicador:** un anillo fino que marque la posición actual del acelerador.
   - **Lo que no cambia:**
     - los botes a remo (kayak, single) siguen usando "botones";
     - el teclado sigue funcionando igual en cualquier esquema.
2. **Lógica pura en `src/controls/joystick.ts`**, sin DOM, con su test en `tests/joystick.test.ts`:
   - de (dx, dy, radio) a (throttle, steering): zona muerta, recorte al círculo, rango [-1, 1];
   - el ajuste a las posiciones del telégrafo;
   - qué pasa al soltar.

   El widget DOM va en `src/controls/widgets.ts` (`StickWidget`) y solo llama a esa lógica.
3. **Elección al inicio.** En dispositivos táctiles, la fila «Controles» tiene que estar **visible en la pantalla de inicio**, no escondida en Ajustes, con las 4 opciones: Botones · Flechas · Palanca y timón · Ruedita.
   - Hay que poder elegir antes de tocar «Zarpar».
   - El botón «Zarpar» tiene que verse **sin scroll** en un celular apaisado de 844×390 y de 667×375. Ya pasó una vez que quedaba escondido.
   - En escritorio sin pantalla táctil la fila puede seguir en Ajustes.
   - La elección se guarda como hoy, en `delta.controles`.
4. **Textos:**
   - en `StartScreen.ts`, la ayuda de "Cómo se juega" para táctil tiene que explicar la ruedita;
   - en `GameEngine.ts`, `setGaugeVisible` tiene que mostrar el indicador de velocidad también con la ruedita.
5. **Documentación:** agregá un párrafo en `docs/adr/0013-manejo-realista.md` (sección de esquemas de control) que explique el esquema "ruedita" y por qué el acelerador queda al soltar.

## Prohibiciones
- **Git:**
  - nada de push a `main` ni a `claude/delta-boat-game-qlfo3`;
  - nada de `git stash`, `rebase`, `push --force` ni `--no-verify`;
  - no saltear tests ni typecheck: no se vale `it.skip`, ni borrar tests, ni `// @ts-ignore` para pasar.
- **Archivos:**
  - no borres nada fuera de tu worktree;
  - no cambies dependencias (`package.json`, lockfile);
  - no toques `src/world/data/**` ni los `.layout.bin`.
- **Alcance:** no cambies la física, el manejo realista ni los otros esquemas, más allá de lo necesario para sumar este.

## Comandos
Usá **tu propio worktree**:
```
cd <repo delta>
git fetch origin claude/delta-boat-game-qlfo3
git worktree add ../delta-sol-01-ruedita -b sol/01-ruedita origin/claude/delta-boat-game-qlfo3
cd ../delta-sol-01-ruedita
heavy "sol-01: npm ci" -- npm ci
```
Al terminar, y antes de entregar:
```
heavy "sol-01: tsc" -- npx tsc --noEmit
heavy "sol-01: vitest" -- npx vitest run
heavy "sol-01: build" -- npm run build
git add -A && git commit -m "feat(controls): Ruedita — on-screen joystick, chosen on the start screen"
git push -u origin sol/01-ruedita
git ls-remote origin sol/01-ruedita
```
Si `heavy` devuelve 3 o 4, o imprime `heavy-lane: not-run`, esperá 300 s y reintentá. No abandones.

Commiteá y hacé push **a medida que avanzás**: tu trabajo no puede quedar solo en el disco.

Si tenés Playwright disponible, sacá capturas de la pantalla de inicio en 844×390 y 667×375 con `hasTouch: true`, y del juego con la ruedita en uso. Guardalas en `encargos/evidencia/01-*.png` y commitealas. Si no lo tenés, decilo.

## Salida esperada (en tu .resultado.md)
1. La lista de archivos tocados y, en una línea cada uno, qué cambió.
2. Una tabla `comando | exit` con todos los comandos de arriba, con su exit real.
3. La ref y el SHA remotos: la salida literal de `git ls-remote origin sol/01-ruedita`.
4. Lo que **no** pudiste verificar, dicho así.
