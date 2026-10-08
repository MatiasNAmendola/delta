import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { crossedQuads } from "../InstancedBatch";

export type BatchShape = "box" | "prism" | "cross" | "blob";

export interface StreamedBatchOptions {
  shape?: BatchShape;
  /** Instances farther than this from the camera are not drawn (world units). */
  radius: number;
  specular?: number;
  emissive?: Color3;
}

/** Instances are bucketed in square cells of this size (world units). */
const CELL = 32;
/** The camera must move this far before the visible set is rebuilt. */
const REFRESH = 6;

/**
 * Thousands of colored copies of one shape (box or gable prism) for the
 * houses and docks of the whole Delta, drawn with one draw call. Unlike
 * InstancedBoxBatch, only the instances within `radius` of the camera are
 * uploaded (the fog hides the rest), refreshed every few units of camera
 * movement from a grid of cells. So the GPU cost depends on what is near,
 * not on how many houses the map has (ADR 0011).
 */
export class StreamedBatch {
  readonly mesh: Mesh;
  private staging = new Map<number, { m: number[]; c: number[] }>();
  private cells = new Map<number, { m: Float32Array; c: Float32Array }>();
  private matrices = new Float32Array(16);
  private colors = new Float32Array(4);
  private last = { x: Infinity, z: Infinity };
  private readonly radius: number;
  private readonly tmpScale = new Vector3();
  private readonly tmpPos = new Vector3();
  private readonly tmpRot = new Quaternion();
  private readonly tmpLocal = new Matrix();
  private readonly tmpWorld = new Matrix();
  total = 0;

  constructor(name: string, scene: Scene, options: StreamedBatchOptions) {
    this.radius = options.radius;
    this.mesh =
      options.shape === "prism"
        ? prism(name, scene)
        : options.shape === "cross"
          ? crossedQuads(name, scene)
          : options.shape === "blob"
            ? MeshBuilder.CreateIcoSphere(name, { radius: 0.5, subdivisions: 1, flat: true }, scene)
            : MeshBuilder.CreateBox(name, { size: 1 }, scene);
    const mat = new StandardMaterial(`${name}Mat`, scene);
    mat.diffuseColor = Color3.White();
    const s = options.specular ?? 0.04;
    mat.specularColor = new Color3(s, s, s);
    if (options.emissive) mat.emissiveColor = options.emissive;
    // Crossed quads are seen from both sides; prisms are closed but cheap to draw both ways
    if (options.shape === "cross" || options.shape === "prism") mat.backFaceCulling = false;
    this.mesh.material = mat;
    this.mesh.isPickable = false;
    // Culling is ours (by distance), the batch is always around the camera
    this.mesh.alwaysSelectAsActiveMesh = true;
    // Buffers registered up front so the shader compiles with instance colors
    this.mesh.thinInstanceSetBuffer("matrix", this.matrices, 16, false);
    this.mesh.thinInstanceSetBuffer("color", this.colors, 4, false);
    this.mesh.thinInstanceCount = 0;
    this.mesh.setEnabled(false);
  }

  /**
   * Adds a shape of `size` at `localPos` inside a parent transform, with an
   * optional tilt (Euler x, y, z). For a prism the size is width (x), height
   * (y, base to ridge) and length (z), the base at localPos.y.
   */
  add(parent: Matrix, size: [number, number, number], localPos: [number, number, number], color: Color3, rotation?: [number, number, number]): void {
    this.tmpScale.set(size[0], size[1], size[2]);
    this.tmpPos.set(localPos[0], localPos[1], localPos[2]);
    if (rotation) Quaternion.FromEulerAnglesToRef(rotation[0], rotation[1], rotation[2], this.tmpRot);
    else this.tmpRot.copyFromFloats(0, 0, 0, 1);
    Matrix.ComposeToRef(this.tmpScale, this.tmpRot, this.tmpPos, this.tmpLocal);
    this.tmpLocal.multiplyToRef(parent, this.tmpWorld);
    const m = this.tmpWorld.m;
    const key = cellKey(m[12], m[14]);
    let cell = this.staging.get(key);
    if (!cell) this.staging.set(key, (cell = { m: [], c: [] }));
    for (let k = 0; k < 16; k++) cell.m.push(m[k]);
    cell.c.push(color.r, color.g, color.b, 1);
    this.total++;
  }

  /** Done adding: packs the cells. */
  build(): void {
    for (const [key, cell] of this.staging) this.cells.set(key, { m: new Float32Array(cell.m), c: new Float32Array(cell.c) });
    this.staging.clear();
    this.matrices = new Float32Array(Math.max(1, this.total) * 16);
    this.colors = new Float32Array(Math.max(1, this.total) * 4);
    this.mesh.thinInstanceSetBuffer("matrix", this.matrices, 16, false);
    this.mesh.thinInstanceSetBuffer("color", this.colors, 4, false);
    this.mesh.thinInstanceCount = 0;
    this.material.freeze();
  }

  private get material(): StandardMaterial {
    return this.mesh.material as StandardMaterial;
  }

  /** Uploads the instances around (x, z) when the camera has moved enough. */
  update(x: number, z: number, force = false): void {
    if (!force && Math.hypot(x - this.last.x, z - this.last.z) < REFRESH) return;
    this.last = { x, z };
    const r = this.radius + CELL * 0.75;
    let n = 0;
    const i0 = Math.floor((x - r) / CELL);
    const i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL);
    const j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        // Cell center within reach
        if (Math.hypot((i + 0.5) * CELL - x, (j + 0.5) * CELL - z) > r) continue;
        const cell = this.cells.get(i * 73856093 + j);
        if (!cell) continue;
        this.matrices.set(cell.m, n * 16);
        this.colors.set(cell.c, n * 4);
        n += cell.c.length / 4;
      }
    }
    this.mesh.thinInstanceCount = n;
    this.mesh.setEnabled(n > 0);
    if (n > 0) {
      this.mesh.thinInstanceBufferUpdated("matrix");
      this.mesh.thinInstanceBufferUpdated("color");
    }
  }

  /** Instances currently drawn. */
  get visible(): number {
    return this.mesh.thinInstanceCount;
  }
}

function cellKey(x: number, z: number): number {
  return Math.floor(x / CELL) * 73856093 + Math.floor(z / CELL);
}

/**
 * Unit gable prism: triangular section in x-y (base -0.5..0.5 at y = 0,
 * ridge at y = 1), along z from -0.5 to 0.5. Flat-shaded.
 */
function prism(name: string, scene: Scene): Mesh {
  const A = [-0.5, 0], B = [0.5, 0], C = [0, 1];
  const positions: number[] = [];
  const indices: number[] = [];
  const quad = (p: number[][]) => {
    const base = positions.length / 3;
    for (const v of p) positions.push(v[0], v[1], v[2]);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const tri = (p: number[][]) => {
    const base = positions.length / 3;
    for (const v of p) positions.push(v[0], v[1], v[2]);
    indices.push(base, base + 1, base + 2);
  };
  // Gable ends
  tri([[A[0], A[1], 0.5], [C[0], C[1], 0.5], [B[0], B[1], 0.5]]);
  tri([[A[0], A[1], -0.5], [B[0], B[1], -0.5], [C[0], C[1], -0.5]]);
  // Slopes and bottom
  quad([[A[0], A[1], -0.5], [C[0], C[1], -0.5], [C[0], C[1], 0.5], [A[0], A[1], 0.5]]);
  quad([[B[0], B[1], 0.5], [C[0], C[1], 0.5], [C[0], C[1], -0.5], [B[0], B[1], -0.5]]);
  quad([[A[0], A[1], 0.5], [B[0], B[1], 0.5], [B[0], B[1], -0.5], [A[0], A[1], -0.5]]);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.applyToMesh(mesh);
  return mesh;
}
