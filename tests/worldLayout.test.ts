import { describe, expect, it } from "vitest";
import { gzipSync, gunzipSync } from "node:zlib";
import { parseWorld } from "../src/world/WorldDoc";
import deltaWorld from "../src/world/data/delta.world.json";
import { computeWorldLayout, hashText, layoutRings } from "../src/world/layout/worldLayout";
import { decodeLayout, encodeLayout } from "../src/world/layout/layoutCodec";

const world = parseWorld(deltaWorld);
const layout = computeWorldLayout(world, hashText(JSON.stringify(world)));

describe("world layout", () => {
  it("survives the baked file round trip bit for bit", () => {
    const back = decodeLayout(gunzipSync(gzipSync(encodeLayout(layout))));
    expect(back.source).toBe(layout.source);
    for (const k of ["grid", "points", "ringStarts", "waterIndices", "landIndices", "shoreSdf", "shoreMap", "splat"] as const) {
      expect(Array.from(back[k])).toEqual(Array.from(layout[k]));
    }
  });

  it("is deterministic (the same world gives the same layout)", () => {
    const again = computeWorldLayout(world, layout.source);
    expect(Array.from(again.points)).toEqual(Array.from(layout.points));
    expect(Array.from(again.waterIndices)).toEqual(Array.from(layout.waterIndices));
  });

  it("covers the whole world exactly with water plus land triangles", () => {
    const area = (idx: Uint32Array) => {
      let a = 0;
      const p = layout.points;
      for (let t = 0; t < idx.length; t += 3) {
        const [i, j, k] = [idx[t], idx[t + 1], idx[t + 2]];
        a += Math.abs((p[j * 2] - p[i * 2]) * (p[k * 2 + 1] - p[i * 2 + 1]) - (p[k * 2] - p[i * 2]) * (p[j * 2 + 1] - p[i * 2 + 1])) / 2;
      }
      return a;
    };
    const total = area(layout.waterIndices) + area(layout.landIndices);
    expect(Math.abs(total - world.world.size ** 2) / world.world.size ** 2).toBeLessThan(0.001);
  });

  it("keeps the shoreline rings closed and the world corners last", () => {
    const rings = layoutRings(layout);
    expect(rings.length).toBeGreaterThan(0);
    expect(rings.every((r) => r.length >= 3)).toBe(true);
    const n = layout.points.length / 2;
    expect(layout.points[(n - 4) * 2]).toBe(-world.world.size / 2);
  });

  it("changes its source hash when the world changes", () => {
    expect(hashText(JSON.stringify({ ...world, rules: { ...world.rules, durationSec: 1 } }))).not.toBe(layout.source);
  });
});
