import { describe, expect, it } from "vitest";
import { gzipSync, gunzipSync } from "node:zlib";
import { parseWorld } from "../src/world/WorldDoc";
import deltaWorld from "../src/world/data/delta.world.json";
import { computeWorldLayout, hashText, layoutRings, type ChunkedMesh, CHUNK_TABLE_STRIDE } from "../src/world/layout/worldLayout";
import { decodeLayout, encodeLayout } from "../src/world/layout/layoutCodec";

const world = parseWorld(deltaWorld);
const layout = computeWorldLayout(world, hashText(JSON.stringify(world)));

describe("world layout", () => {
  it("survives the baked file round trip bit for bit", () => {
    const back = decodeLayout(gunzipSync(gzipSync(encodeLayout(layout))));
    expect(back.source).toBe(layout.source);
    for (const k of ["grid", "points", "ringStarts", "shoreSdf", "shoreMap", "splat"] as const) {
      expect(Array.from(back[k])).toEqual(Array.from(layout[k]));
    }
    for (const m of ["water", "land"] as const) {
      for (const k of ["refs", "extra", "indices", "table"] as const) expect(Array.from(back[m][k])).toEqual(Array.from(layout[m][k]));
    }
  });

  it("is deterministic (the same world gives the same layout)", () => {
    const again = computeWorldLayout(world, layout.source);
    expect(Array.from(again.points)).toEqual(Array.from(layout.points));
    expect(Array.from(again.water.indices)).toEqual(Array.from(layout.water.indices));
  });

  it("covers the whole world exactly with water plus land triangles, chunk by chunk", () => {
    const area = (m: ChunkedMesh) => {
      let a = 0;
      let r = 0;
      let e = 0;
      let q = 0;
      for (let c = 0; c < m.table.length; c += CHUNK_TABLE_STRIDE) {
        const [ci, , nRefs, nExtra, nIndices] = m.table.subarray(c, c + CHUNK_TABLE_STRIDE);
        const pt = (v: number): [number, number] =>
          v < nRefs ? [layout.points[m.refs[r + v] * 2], layout.points[m.refs[r + v] * 2 + 1]] : [m.extra[(e + v - nRefs) * 2], m.extra[(e + v - nRefs) * 2 + 1]];
        for (let t = q; t < q + nIndices; t += 3) {
          const [A, B, C] = [pt(m.indices[t]), pt(m.indices[t + 1]), pt(m.indices[t + 2])];
          a += Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
          // Every vertex inside its chunk's cell (with the quantization slack)
          for (const P of [A, B, C]) {
            expect(P[0]).toBeGreaterThanOrEqual(ci * 256 - 0.01);
            expect(P[0]).toBeLessThanOrEqual((ci + 1) * 256 + 0.01);
          }
        }
        r += nRefs;
        e += nExtra;
        q += nIndices;
      }
      return a;
    };
    const total = area(layout.water) + area(layout.land);
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
