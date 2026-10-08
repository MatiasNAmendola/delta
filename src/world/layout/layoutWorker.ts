/// <reference lib="webworker" />
/**
 * Fallback when no baked layout file is available: computes it off the
 * main thread so the loading screen stays smooth, and transfers the
 * arrays back without copying.
 */
import type { WorldDoc } from "../WorldDoc";
import { computeWorldLayout, type WorldLayout } from "./worldLayout";

self.onmessage = (e: MessageEvent<{ world: WorldDoc; source: string }>) => {
  const layout = computeWorldLayout(e.data.world, e.data.source);
  postMessage(layout, transferables(layout));
};

function transferables(l: WorldLayout): Transferable[] {
  return [l.grid, l.points, l.ringStarts, l.waterIndices, l.landIndices, l.shoreSdf, l.shoreMap, l.splat].map((a) => a.buffer as ArrayBuffer);
}
