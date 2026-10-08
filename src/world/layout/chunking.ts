/**
 * Splitting world-sized meshes (water, island ground, river banks) into
 * square chunks, so the camera only draws the ones in view and within the
 * far plane instead of the whole 22 km map every frame (ADR 0011). Pure:
 * used at build time (world layout) and at run time (river banks).
 */
/** Chunk side in world units (2 km). */
export const CHUNK = 256;

export interface MeshArrays {
  positions: ArrayLike<number>;
  indices: ArrayLike<number>;
  normals?: ArrayLike<number>;
  uvs?: ArrayLike<number>;
}

export interface Chunk {
  /** Cell coordinates. */
  i: number;
  j: number;
  positions: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
  /** Source vertex of each chunk vertex, -1 where a cut made a new one. */
  source: Int32Array;
}

/**
 * Cuts the mesh along a square grid: every triangle is clipped to each
 * cell it overlaps (earcut leaves long slivers across the whole map, which
 * would make every chunk as big as the world), and each cell gets compact
 * vertex arrays. Attributes are interpolated linearly at the cuts.
 */
export function splitByCells(mesh: MeshArrays, cell = CHUNK): Chunk[] {
  const { positions, indices, normals, uvs } = mesh;
  const stride = 3 + (normals ? 3 : 0) + (uvs ? 2 : 0);
  const count = positions.length / 3;
  interface Group {
    id: number;
    i: number;
    j: number;
    verts: number[];
    tris: number[];
    source: number[];
  }
  const groups = new Map<number, Group>();
  const list: Group[] = [];
  const group = (i: number, j: number): Group => {
    const key = i * 65536 + j;
    let g = groups.get(key);
    if (!g) {
      g = { id: list.length, i, j, verts: [], tris: [], source: [] };
      groups.set(key, g);
      list.push(g);
    }
    return g;
  };
  // Where each source vertex was last copied (group and local index): shared within a cell
  const owner = new Int32Array(count).fill(-1);
  const local = new Int32Array(count);
  const copyVertex = (g: Group, id: number): number => {
    if (owner[id] === g.id) return local[id];
    const n = g.verts.length / stride;
    const v = g.verts;
    v.push(positions[id * 3], positions[id * 3 + 1], positions[id * 3 + 2]);
    if (normals) v.push(normals[id * 3], normals[id * 3 + 1], normals[id * 3 + 2]);
    if (uvs) v.push(uvs[id * 2], uvs[id * 2 + 1]);
    owner[id] = g.id;
    local[id] = n;
    g.source.push(id);
    return n;
  };
  const vertex = (i: number): number[] => {
    const v = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    if (normals) v.push(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
    if (uvs) v.push(uvs[i * 2], uvs[i * 2 + 1]);
    return v;
  };
  const pushVertex = (g: Group, v: number[]): number => {
    for (const x of v) g.verts.push(x);
    g.source.push(-1);
    return g.verts.length / stride - 1;
  };

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t];
    const b = indices[t + 1];
    const c = indices[t + 2];
    const ax = positions[a * 3], bx = positions[b * 3], cx = positions[c * 3];
    const az = positions[a * 3 + 2], bz = positions[b * 3 + 2], cz = positions[c * 3 + 2];
    const i0 = Math.floor(Math.min(ax, bx, cx) / cell);
    const i1 = Math.floor(Math.max(ax, bx, cx) / cell);
    const j0 = Math.floor(Math.min(az, bz, cz) / cell);
    const j1 = Math.floor(Math.max(az, bz, cz) / cell);
    if (i0 === i1 && j0 === j1) {
      // Wholly inside one cell (most triangles)
      const g = group(i0, j0);
      g.tris.push(copyVertex(g, a), copyVertex(g, b), copyVertex(g, c));
      continue;
    }
    const tri = [vertex(a), vertex(b), vertex(c)];
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        let poly = tri;
        poly = clip(poly, 0, i * cell, 1);
        poly = clip(poly, 0, (i + 1) * cell, -1);
        poly = clip(poly, 2, j * cell, 1);
        poly = clip(poly, 2, (j + 1) * cell, -1);
        if (poly.length < 3) continue;
        const g = group(i, j);
        const first = pushVertex(g, poly[0]);
        let prev = pushVertex(g, poly[1]);
        for (let k = 2; k < poly.length; k++) {
          const cur = pushVertex(g, poly[k]);
          g.tris.push(first, prev, cur);
          prev = cur;
        }
      }
    }
  }

  return list.map((g) => {
    const n = g.verts.length / stride;
    const take = (offset: number, size: number) => {
      const arr = new Float32Array(n * size);
      for (let v = 0; v < n; v++) for (let s = 0; s < size; s++) arr[v * size + s] = g.verts[v * stride + offset + s];
      return arr;
    };
    return {
      i: g.i,
      j: g.j,
      indices: new Uint32Array(g.tris),
      positions: take(0, 3),
      normals: normals ? take(3, 3) : undefined,
      uvs: uvs ? take(normals ? 6 : 3, 2) : undefined,
      source: Int32Array.from(g.source),
    };
  });
}

/** Sutherland-Hodgman against one axis-aligned line: keeps side*(v[axis] - at) >= 0. */
function clip(poly: number[][], axis: number, at: number, side: number): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % poly.length];
    const da = side * (a[axis] - at);
    const db = side * (b[axis] - at);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const f = da / (da - db);
      out.push(a.map((x, s) => x + (b[s] - x) * f));
    }
  }
  return out;
}

