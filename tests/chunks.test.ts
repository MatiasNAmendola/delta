import { describe, expect, it } from "vitest";
import { splitByCells } from "../src/world/layout/chunking";

const area = (p: Float32Array, idx: Uint32Array) => {
  let a = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const [i, j, k] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    a += Math.abs((p[j] - p[i]) * (p[k + 2] - p[i + 2]) - (p[k] - p[i]) * (p[j + 2] - p[i + 2])) / 2;
  }
  return a;
};

describe("chunks", () => {
  it("cuts a long sliver at the cell lines, keeping its area and attributes", () => {
    // A triangle 1000 units long across 4 cells of 256
    const positions = [0, 0, 0, 1000, 0, 10, 0, 0, 20];
    const uvs = [0, 0, 1, 0.5, 0, 1];
    const chunks = splitByCells({ positions, indices: [0, 1, 2], uvs }, 256);
    expect(chunks).toHaveLength(4);
    let total = 0;
    for (const c of chunks) {
      for (let v = 0; v < c.positions.length; v += 3) {
        expect(c.positions[v]).toBeGreaterThanOrEqual(c.i * 256 - 1e-6);
        expect(c.positions[v]).toBeLessThanOrEqual((c.i + 1) * 256 + 1e-6);
        // u follows x linearly here
        expect(c.uvs![(v / 3) * 2]).toBeCloseTo(c.positions[v] / 1000, 5);
      }
      total += area(c.positions, c.indices);
    }
    expect(total).toBeCloseTo(10000, 3);
  });

  it("keeps small triangles whole and shares their vertices", () => {
    const positions = [1, 0, 1, 2, 0, 1, 2, 0, 2, 1, 0, 2];
    const chunks = splitByCells({ positions, indices: [0, 1, 2, 0, 2, 3] }, 256);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].positions.length).toBe(12);
    expect(chunks[0].indices.length).toBe(6);
  });
});
