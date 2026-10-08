import { describe, expect, it } from "vitest";
import { generateTree, SPECIES } from "../src/world/vegetation/treeGenerator";

const tris = (g: { indices: number[] }) => g.indices.length / 3;

describe("procedural trees", () => {
  for (const sp of Object.values(SPECIES)) {
    it(`${sp.name}: valid geometry, rooted at the origin, within budget`, () => {
      const t = generateTree(sp, 7);
      for (const g of [t.trunk, t.foliage]) {
        const verts = g.positions.length / 3;
        expect(verts).toBeGreaterThan(0);
        expect(g.normals.length).toBe(g.positions.length);
        expect(g.colors.length).toBe(verts * 4);
        expect(Math.max(...g.indices)).toBeLessThan(verts);
        expect(g.positions.every(Number.isFinite)).toBe(true);
      }
      expect(t.foliage.uvs.length).toBe((t.foliage.positions.length / 3) * 2);
      // The trunk starts at the ground
      expect(Math.abs(t.trunk.positions[1])).toBeLessThan(0.01);
      expect(t.height).toBeGreaterThan(sp.trunkHeight[0] * 0.8);
      expect(t.height).toBeLessThan(16);
      // Phone budget per tree
      expect(tris(t.trunk) + tris(t.foliage)).toBeLessThan(1400);
    });

    it(`${sp.name}: far version is much cheaper`, () => {
      const near = generateTree(sp, 3, 0);
      const far = generateTree(sp, 3, 1);
      const cost = (t: typeof near) => tris(t.trunk) + tris(t.foliage);
      expect(cost(far)).toBeLessThan(cost(near) * 0.6);
    });
  }

  it("is deterministic per seed and varies across seeds", () => {
    const a = generateTree(SPECIES.fronda, 11);
    const b = generateTree(SPECIES.fronda, 11);
    const c = generateTree(SPECIES.fronda, 12);
    expect(a.trunk.positions).toEqual(b.trunk.positions);
    expect(a.trunk.positions).not.toEqual(c.trunk.positions);
  });

  it("willow curtains hang well below the branch tips", () => {
    const t = generateTree(SPECIES.sauce, 5);
    let minY = Infinity;
    for (let i = 1; i < t.foliage.positions.length; i += 3) minY = Math.min(minY, t.foliage.positions[i]);
    expect(minY).toBeLessThan(1.5);
  });
});
