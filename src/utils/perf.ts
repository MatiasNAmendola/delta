import type { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";

/**
 * Load-time marks and a live performance panel, enabled with `?perf=1`.
 * Marks are always recorded (cheap); the panel is only built on demand, so
 * the numbers can be read on a real phone without dev tools.
 */
const start = performance.now();
let last = start;
const marks: Array<{ name: string; ms: number }> = [];

export const PERF_ENABLED =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("perf") === "1";

/** Records how long the step that just finished took. */
export function mark(name: string): void {
  const now = performance.now();
  marks.push({ name, ms: now - last });
  last = now;
}

export function loadMarks(): ReadonlyArray<{ name: string; ms: number }> {
  return marks;
}

export function totalLoadMs(): number {
  return last - start;
}

/** Live panel: FPS, frame time p95, triangles and draw calls, plus the load breakdown. */
export function showPerfPanel(engine: Engine, scene: Scene): void {
  const panel = document.createElement("div");
  panel.id = "perfPanel";
  panel.style.cssText = `position:fixed;right:8px;bottom:8px;z-index:9999;max-width:260px;
    font:11px/1.45 ui-monospace,Menlo,monospace;color:#e8f2ec;background:rgba(8,18,15,.82);
    border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:8px 10px;pointer-events:none;white-space:pre`;
  document.body.appendChild(panel);
  const frames: number[] = [];
  let acc = 0;
  scene.onAfterRenderObservable.add(() => {
    const dt = engine.getDeltaTime();
    frames.push(dt);
    if (frames.length > 240) frames.shift();
    acc += dt;
    if (acc < 500) return;
    acc = 0;
    const sorted = [...frames].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    let tris = 0;
    let draws = 0;
    for (const m of scene.getActiveMeshes().data) {
      const n = m.hasThinInstances ? (m as unknown as { thinInstanceCount: number }).thinInstanceCount : 1;
      tris += (m.getTotalIndices() / 3) * n;
      draws++;
    }
    const load = marks.map((x) => `  ${x.name.padEnd(16)} ${Math.round(x.ms).toString().padStart(5)} ms`).join("\n");
    panel.textContent =
      `FPS ${engine.getFps().toFixed(0)}   p95 ${p95.toFixed(1)} ms\n` +
      `tris ${(tris / 1000).toFixed(0)}k   draws ${draws}\n` +
      `res ×${(1 / engine.getHardwareScalingLevel()).toFixed(2)}\n` +
      `carga ${Math.round(totalLoadMs())} ms\n${load}`;
  });
}
