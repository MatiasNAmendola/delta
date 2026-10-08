import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Meshes/thinInstanceMesh";

export interface BatchMaterialOptions {
  specular?: Color3;
  emissive?: Color3;
  /**
   * "blob" = low-poly rounded clump (an icosahedron); "cross" = two crossed
   * vertical quads (4 triangles, for thin stalks) instead of a 12-triangle box.
   */
  shape?: "box" | "blob" | "cross";
}

/**
 * Many copies of a unit box drawn with a single draw call (thin instances),
 * each with its own transform and color.
 *
 * Replaces the old approach of one Mesh + one StandardMaterial per box,
 * which cost one draw call per box (and three per box once the water
 * reflection and refraction passes re-rendered the scene).
 */
export class InstancedBoxBatch {
  readonly mesh: Mesh;
  private matrices: number[] = [];
  private colors: number[] = [];
  private tmpScale = new Vector3();
  private tmpPos = new Vector3();

  constructor(name: string, scene: Scene, options: BatchMaterialOptions = {}) {
    this.mesh =
      options.shape === "blob"
        ? MeshBuilder.CreateIcoSphere(name, { radius: 0.5, subdivisions: 1, flat: true }, scene)
        : options.shape === "cross"
          ? crossedQuads(name, scene)
          : MeshBuilder.CreateBox(name, { size: 1 }, scene);
    const mat = new StandardMaterial(`${name}Mat`, scene);
    // Base color is white: the per-instance color buffer tints it
    mat.diffuseColor = Color3.White();
    mat.specularColor = options.specular ?? new Color3(0.05, 0.05, 0.05);
    if (options.emissive) mat.emissiveColor = options.emissive;
    if (options.shape === "cross") mat.backFaceCulling = false;
    this.mesh.material = mat;
    this.mesh.isPickable = false;
  }

  get count(): number {
    return this.colors.length / 4;
  }

  /**
   * Adds a box of the given size, centered at `localPos` inside a parent
   * transform (`parent` = rotation + translation of the prop it belongs to),
   * optionally tilted by `rotation` (Euler x, y, z in radians, e.g. roof slopes).
   */
  add(
    parent: Matrix,
    size: [number, number, number],
    localPos: [number, number, number],
    color: Color3,
    rotation?: [number, number, number]
  ): void {
    this.tmpScale.set(size[0], size[1], size[2]);
    this.tmpPos.set(localPos[0], localPos[1], localPos[2]);
    const tilt = rotation ? Quaternion.FromEulerAngles(rotation[0], rotation[1], rotation[2]) : Quaternion.Identity();
    const local = Matrix.Compose(this.tmpScale, tilt, this.tmpPos);
    local.multiply(parent).toArray(this.matrices, this.matrices.length);
    this.colors.push(color.r, color.g, color.b, 1);
  }

  /** Uploads all instances to the GPU and freezes the batch (it is static). */
  build(): Mesh {
    if (this.count === 0) {
      this.mesh.setEnabled(false);
      return this.mesh;
    }
    this.mesh.thinInstanceSetBuffer("matrix", new Float32Array(this.matrices), 16, true);
    this.mesh.thinInstanceSetBuffer("color", new Float32Array(this.colors), 4, true);
    this.mesh.thinInstanceRefreshBoundingInfo(false);
    this.mesh.freezeWorldMatrix();
    this.mesh.material?.freeze();
    this.matrices = [];
    this.colors = [];
    return this.mesh;
  }
}

/** Unit-size cross of two vertical quads (seen from both sides: no back-face culling). */
export function crossedQuads(name: string, scene: Scene): Mesh {
  const a = MeshBuilder.CreatePlane(`${name}A`, { size: 1 }, scene);
  const b = MeshBuilder.CreatePlane(`${name}B`, { size: 1 }, scene);
  b.rotation.y = Math.PI / 2;
  b.bakeCurrentTransformIntoVertices();
  const merged = Mesh.MergeMeshes([a, b], true)!;
  merged.name = name;
  return merged;
}

/** Parent transform for a prop: uniform scale, rotation around Y, then translation. */
export function propTransform(x: number, y: number, z: number, rotationY: number, scale = 1): Matrix {
  return Matrix.Scaling(scale, scale, scale).multiply(Matrix.RotationY(rotationY)).multiply(Matrix.Translation(x, y, z));
}
