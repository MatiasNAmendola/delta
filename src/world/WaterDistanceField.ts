/**
 * Distance from every point of the world to the nearest water, in world units.
 *
 * Built once with a two-pass chamfer transform (8 neighbours, weights 1 and
 * √2), so terrain texturing, relief and vegetation can ask "how far is the
 * river?" in O(1) instead of probing rings of points per pixel.
 *
 * Cell (i, j) covers world x = -size/2 + (i + 0.5) * cell and
 * z = -size/2 + (j + 0.5) * cell; cells are stored row-major by z: j * res + i.
 */
export class WaterDistanceField {
  readonly cell: number;
  private readonly dist: Float32Array;

  constructor(
    readonly size: number,
    readonly res: number,
    isWater: (x: number, z: number) => boolean
  ) {
    this.cell = size / res;
    const half = size / 2;
    const d = new Float32Array(res * res);
    for (let j = 0; j < res; j++) {
      const z = -half + (j + 0.5) * this.cell;
      for (let i = 0; i < res; i++) {
        d[j * res + i] = isWater(-half + (i + 0.5) * this.cell, z) ? 0 : Infinity;
      }
    }
    chamfer(d, res);
    for (let k = 0; k < d.length; k++) d[k] *= this.cell;
    this.dist = d;
  }

  /** Distance of cell (i, j) to water; cells outside the grid count as far away. */
  atCell(i: number, j: number): number {
    if (i < 0 || j < 0 || i >= this.res || j >= this.res) return Infinity;
    return this.dist[j * this.res + i];
  }

  /** Distance to water at a world position (nearest cell). */
  at(x: number, z: number): number {
    const i = Math.floor((x + this.size / 2) / this.cell);
    const j = Math.floor((z + this.size / 2) / this.cell);
    return this.atCell(i, j);
  }
}

const DIAG = Math.SQRT2;

/** In-place two-pass chamfer distance transform, in cell units. */
function chamfer(d: Float32Array, res: number): void {
  // Forward pass: neighbours above and to the left
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const k = j * res + i;
      let v = d[k];
      if (v === 0) continue;
      if (i > 0) v = Math.min(v, d[k - 1] + 1);
      if (j > 0) {
        v = Math.min(v, d[k - res] + 1);
        if (i > 0) v = Math.min(v, d[k - res - 1] + DIAG);
        if (i < res - 1) v = Math.min(v, d[k - res + 1] + DIAG);
      }
      d[k] = v;
    }
  }
  // Backward pass: neighbours below and to the right
  for (let j = res - 1; j >= 0; j--) {
    for (let i = res - 1; i >= 0; i--) {
      const k = j * res + i;
      let v = d[k];
      if (v === 0) continue;
      if (i < res - 1) v = Math.min(v, d[k + 1] + 1);
      if (j < res - 1) {
        v = Math.min(v, d[k + res] + 1);
        if (i < res - 1) v = Math.min(v, d[k + res + 1] + DIAG);
        if (i > 0) v = Math.min(v, d[k + res - 1] + DIAG);
      }
      d[k] = v;
    }
  }
}
