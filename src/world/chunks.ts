/**
 * Babylon meshes for world chunks (see layout/chunking.ts).
 */
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Material } from "@babylonjs/core/Materials/material";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { splitByCells, type MeshArrays } from "./layout/chunking";
import { CHUNK_TABLE_STRIDE, type ChunkedMesh } from "./layout/worldLayout";

export { splitByCells };

function chunkMesh(name: string, scene: Scene, data: VertexData, material: Material, parent?: TransformNode): Mesh {
  const m = new Mesh(name, scene);
  data.applyToMesh(m);
  m.material = material;
  m.isPickable = false;
  if (parent) m.parent = parent;
  else m.freezeWorldMatrix();
  m.doNotSyncBoundingInfo = true;
  return m;
}

/** One frozen mesh per chunk, sharing a material (and optionally a parent). */
export function buildChunks(name: string, scene: Scene, mesh: MeshArrays, material: Material, parent?: TransformNode): Mesh[] {
  return splitByCells(mesh).map((c) => {
    const data = new VertexData();
    data.positions = c.positions;
    data.indices = c.indices;
    if (c.normals) data.normals = c.normals;
    if (c.uvs) data.uvs = c.uvs;
    return chunkMesh(`${name}_${c.i}_${c.j}`, scene, data, material, parent);
  });
}

/**
 * Flat meshes (water, island ground) from a baked chunked mesh: y constant,
 * normals up, uvs from x and z.
 */
export function buildFlatChunks(
  name: string,
  scene: Scene,
  mesh: ChunkedMesh,
  points: Float32Array,
  y: number,
  uv: (x: number, z: number, out: Float32Array, k: number) => void,
  material: Material,
  parent?: TransformNode
): Mesh[] {
  const out: Mesh[] = [];
  let r = 0;
  let e = 0;
  let q = 0;
  for (let c = 0; c < mesh.table.length; c += CHUNK_TABLE_STRIDE) {
    const [i, j, nRefs, nExtra, nIndices] = mesh.table.subarray(c, c + CHUNK_TABLE_STRIDE);
    const count = nRefs + nExtra;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    for (let v = 0; v < count; v++) {
      const x = v < nRefs ? points[mesh.refs[r + v] * 2] : mesh.extra[(e + v - nRefs) * 2];
      const z = v < nRefs ? points[mesh.refs[r + v] * 2 + 1] : mesh.extra[(e + v - nRefs) * 2 + 1];
      positions[v * 3] = x;
      positions[v * 3 + 1] = y;
      positions[v * 3 + 2] = z;
      normals[v * 3 + 1] = 1;
      uv(x, z, uvs, v * 2);
    }
    const data = new VertexData();
    data.positions = positions;
    data.normals = normals;
    data.uvs = uvs;
    data.indices = mesh.indices.subarray(q, q + nIndices);
    out.push(chunkMesh(`${name}_${i}_${j}`, scene, data, material, parent));
    r += nRefs;
    e += nExtra;
    q += nIndices;
  }
  return out;
}
