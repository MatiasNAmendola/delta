# Encargo 02 — Que vuelvan a verse las olas de la estela al acelerar (celular)

Sos un agente de implementación sobre el repo **Delta**, un juego web (BabylonJS 7.54.3, TypeScript, Vite, vitest) sobre el Delta de Tigre.

**Lo que reporta la dueña:** "las ondas cuando acelerás se borraron". Lo ve en el **celular**. Las olas en V que deja la lancha, las de Kelvin, ya no se notan.

Antes de tocar nada, leé `docs/TRASPASO.md`, `docs/adr/0012-fisica-de-la-estela.md` y `docs/investigacion/04-olas-estelas-y-costas.md`.

## Lo que ya se probó (2026-10-09, emulando un celular de 844×390, DPR 2, táctil, colectiva al 100 %)
Usá `encargos/herramientas/estela-celu.mjs`:
```
node encargos/herramientas/estela-celu.mjs "http://localhost:<puerto>/delta/?world=delta-tigre-real&clima=calma" out.png
```
- **Hoy:** en el celular solo se ven los copos de espuma detrás de la popa; **la V de olas no se ve**. En escritorio (1280×720) la V se ve, pero muy tenue.
- **Shader del agua anterior** (`git show 635bcc4:src/world/DeltaWaterMaterial.ts`, antes de los reflejos de árboles): en el celular **tampoco** aparecía la V. Así que la causa no son solo los reflejos.
- **Más contraste en `src/world/WakeRibbon.ts`:** se subió el factor de alfa de la pendiente de 11 a 24 y se sombrearon las crestas. **No alcanzó**: la V siguió sin verse. El cambio se revirtió.
- **Hipótesis a comprobar, sin darlas por ciertas:**
  - la amplitud (`wakeAmplitude`, `vAux.y`) o el `footprint` dan pendientes casi nulas en la distancia de cámara del celular;
  - en el celular el ancho o el largo del ribbon (`uTrail`) quedan cortos;
  - hay algún camino exclusivo de móvil o de calidad (`isMobile`, `AdaptiveResolution`, LOD) que lo apaga o lo achica;
  - el filtro del casco (estrechamiento 1/Fr de Rabaud y Moisy) anula los brazos a velocidad de planeo.

## Qué hay que hacer
1. **Encontrar la causa con evidencia.**
   - Compará los commits `efdad71`, `ef1eddd`, `853e27a` y `5ec4b53`: en un worktree aparte de solo lectura, `git checkout <sha>`, después `npm run bake` y la captura de arriba.
   - Decí en qué commit la V deja de verse en el celular, y por qué, señalando la línea.
2. **Arreglarlo.** Con la colectiva y con una lancha particular a toda máquina, la V tiene que verse claramente desde la cámara de seguimiento en el celular, sin pasarse:
   - nada de rayas blancas de dibujo animado;
   - a baja velocidad, olas chicas;
   - la regla "sin ola" (0,25 m) tiene que seguir midiendo la altura física, no la visual.

   Si para que se vea hace falta exagerar la amplitud **visual**, separala de la física y documentá el factor.
3. **Un test en `tests/`** que fije el comportamiento corregido. Por ejemplo: que la pendiente o amplitud que llega al shader para la colectiva al 100 % no baje de un umbral.
4. **Documentación:** un párrafo en `docs/adr/0012-fisica-de-la-estela.md` con la causa, el arreglo y el factor visual, si lo hubo.

## Prohibiciones
- **Git:**
  - nada de push a `main` ni a `claude/delta-boat-game-qlfo3`;
  - nada de `git stash`, `rebase`, `push --force` ni `--no-verify`.
- **Tests:** no saltear tests ni typecheck: no se vale `it.skip`, ni borrar tests, ni `@ts-ignore`.
- **Archivos:**
  - no borres nada fuera de tu worktree;
  - no cambies dependencias en `package.json` ni en el lockfile;
  - no toques `src/world/data/**`.
- **Alcance:** no cambies los reflejos de árboles del agua más que lo justo y explicado.

## Comandos
```
cd <repo delta>
git fetch origin claude/delta-boat-game-qlfo3
git worktree add ../delta-sol-02-estela -b sol/02-estela origin/claude/delta-boat-game-qlfo3
cd ../delta-sol-02-estela
heavy "sol-02: npm ci" -- npm ci
heavy "sol-02: bake" -- npm run bake
npx vite --port 4112 --strictPort &      # dev server para las capturas
# ... capturas, bisección, arreglo ...
heavy "sol-02: tsc" -- npx tsc --noEmit
heavy "sol-02: vitest" -- npx vitest run
heavy "sol-02: build" -- npm run build
git add -A && git commit -m "fix(wake): the Kelvin V shows again on phones"
git push -u origin sol/02-estela
git ls-remote origin sol/02-estela
```
- Si `heavy` devuelve 3 o 4, o imprime `heavy-lane: not-run`, esperá 300 s y reintentá.
- Commiteá y hacé push a medida que avanzás.
- Guardá las capturas de antes y después en `encargos/evidencia/02-*.png` y commitealas.

## Salida esperada (en tu .resultado.md)
1. **La causa:** commit, archivo y línea, con las capturas que lo prueban.
2. **Los archivos tocados**, con una línea cada uno.
3. **La tabla `comando | exit`** con todos los comandos, con su exit real.
4. **La salida literal** de `git ls-remote origin sol/02-estela`.
5. **Lo que no pudiste verificar**, dicho así.
