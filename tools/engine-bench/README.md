# Benchmark de motores web 3D

Herramientas usadas para [`docs/metaverso/MOTORES.md`](../../docs/metaverso/MOTORES.md). **No forman parte
del juego**: tienen su propio `package.json` y no entran en el build.

> ⚠️ Corren con Chromium headless y GPU por software (SwiftShader). Sirven para comparar **tamaño de bundle,
> arranque y CPU/JS por frame**, no rendimiento de GPU. Para decisiones finales hay que medir en un Android
> barato real.

## Tamaño de bundle (tree-shaking real)

```bash
cd tools/engine-bench && npm install
for f in entries/*.js; do
  n=$(basename "$f" .js)
  npx esbuild "$f" --bundle --minify --format=esm --outfile="out/$n.js" && gzip -9 -k -f "out/$n.js"
done
ls -l out/*.gz
```

## CPU por frame (2.400 cajas: una malla por caja vs. instanciado)

```bash
cd tools/engine-bench/bench
for e in three babylon7 babylon9 playcanvas galacean; do
  npx esbuild "b_$e.js" --bundle --minify --format=esm --outfile="out_$e.js"
done
npx http-server -p 8765 -s . &          # o cualquier servidor estático
node ../runbench.cjs three,babylon7,babylon9,playcanvas,galacean separate,instanced
```

## Draw calls del juego real

```bash
npm run build && npx vite preview --port 8767 &
node tools/engine-bench/gamedraws.cjs   # imprime draws por frame y guarda game.png
```

Los scripts esperan Playwright en `/opt/node-tools/node_modules/playwright` (el entorno de Claude Code en la
nube); en otra máquina cambiá ese `require` por `playwright`.
