/**
 * Precomputes the layout of every bundled world (shoreline, triangulations,
 * shore distance textures, splatmap) into public/worlds/<world id>.layout.bin,
 * gzipped. Runs before `vite build` and `vite dev`; the game falls back to
 * computing it in a Web Worker if a file is missing or stale.
 * See docs/adr/0001-precalcular-el-mundo.md.
 *
 *   npm run bake
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { parseWorld } from "../../src/world/WorldDoc";
import { computeWorldLayout, hashText } from "../../src/world/layout/worldLayout";
import { encodeLayout } from "../../src/world/layout/layoutCodec";

const DATA = "src/world/data";
const OUT = "public/worlds";
mkdirSync(OUT, { recursive: true });

for (const file of readdirSync(DATA).filter((f) => f.endsWith(".world.json"))) {
  const t0 = performance.now();
  const world = parseWorld(JSON.parse(readFileSync(join(DATA, file), "utf8")));
  const layout = computeWorldLayout(world, hashText(JSON.stringify(world)));
  const raw = encodeLayout(layout);
  const gz = gzipSync(raw, { level: 9 });
  writeFileSync(join(OUT, `${world.world.id}.layout.bin`), gz);
  const mb = (n: number) => (n / 1024 / 1024).toFixed(2);
  console.log(
    `${file} -> ${world.world.id}.layout.bin  ${mb(raw.length)} MB raw, ${mb(gz.length)} MB gzip, ${Math.round(performance.now() - t0)} ms`
  );
}
