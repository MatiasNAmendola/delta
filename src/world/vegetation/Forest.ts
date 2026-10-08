import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { generateTree, SPECIES, type Geometry } from "./treeGenerator";
import { createLeafTexture, type LeafStyle } from "./leafTextures";

export type SpeciesName = "sauce" | "casuarina" | "fronda" | "alamo";

export interface TreeSpot {
  x: number;
  y: number;
  z: number;
  /** Y rotation; the generated trees lean towards local +x. */
  rotation: number;
  scale: number;
  species: SpeciesName;
}

/** Trees closer than this use the detailed version... */
const NEAR = 30;
/** ...and up to this distance the cheap one; further away the fog hides them. */
const FAR = 170;
/** Rebuild the visible set after the camera moves this much. */
const REFRESH_DISTANCE = 5;
const VARIANTS = 2;

interface Part {
  mesh: Mesh;
  /** Indices into the tree list drawn by this part this frame. */
  pick: number[];
}

/**
 * Procedural trees drawn as thin instances: per species, a couple of
 * generated variants, each in a near and a far version, trunk and foliage.
 * Only trees around the camera are uploaded, refreshed as it moves.
 */
export class Forest {
  private spots: TreeSpot[] = [];
  private matrices = new Float32Array(0);
  private tints = new Float32Array(0);
  private variantOf: Uint8Array = new Uint8Array(0);
  /** parts[species][variant][lod] = [trunk, foliage] */
  private parts = new Map<string, Part[]>();
  private lastRefresh = new Vector3(Infinity, 0, Infinity);

  constructor(private scene: Scene) {}

  add(spot: TreeSpot): void {
    this.spots.push(spot);
  }

  get count(): number {
    return this.spots.length;
  }

  /** Builds the species meshes and the per-tree transforms. Call once after adding. */
  build(): void {
    const n = this.spots.length;
    this.matrices = new Float32Array(n * 16);
    this.tints = new Float32Array(n * 4);
    this.variantOf = new Uint8Array(n);
    const m = new Matrix();
    const scaleV = new Vector3();
    const pos = new Vector3();
    this.spots.forEach((t, i) => {
      scaleV.setAll(t.scale);
      pos.set(t.x, t.y, t.z);
      Matrix.ComposeToRef(scaleV, Quaternion.RotationAxis(Vector3.Up(), t.rotation), pos, m);
      m.copyToArray(this.matrices, i * 16);
      // Individual color variation on top of the species tint
      const h = Math.sin(t.x * 12.9898 + t.z * 78.233) * 43758.5453;
      const r = h - Math.floor(h);
      const v = 0.86 + r * 0.26;
      this.tints.set([v * (0.95 + r * 0.1), v, v * (1.05 - r * 0.15), 1], i * 4);
      this.variantOf[i] = Math.floor(r * 997) % VARIANTS;
    });

    const used = new Set(this.spots.map((s) => s.species));
    const barkMat = new StandardMaterial("corteza", this.scene);
    barkMat.diffuseColor = Color3.White();
    barkMat.specularColor = Color3.Black();
    for (const name of used) {
      const sp = SPECIES[name];
      const leafMat = new StandardMaterial(`follaje_${name}`, this.scene);
      leafMat.diffuseTexture = createLeafTexture(this.scene, name as LeafStyle);
      leafMat.diffuseTexture.hasAlpha = true;
      leafMat.backFaceCulling = false;
      leafMat.specularColor = Color3.Black();
      // Light scattered through the leaves: shaded sides never go black
      leafMat.emissiveColor = new Color3(0.1, 0.12, 0.06);
      const list: Part[] = [];
      for (let v = 0; v < VARIANTS; v++) {
        for (const lod of [0, 1] as const) {
          const tree = generateTree(sp, 101 + v * 37 + name.length * 7, lod);
          list.push(
            { mesh: this.mesh(`${name}_${v}_${lod}_tronco`, tree.trunk, barkMat), pick: [] },
            { mesh: this.mesh(`${name}_${v}_${lod}_follaje`, tree.foliage, leafMat), pick: [] }
          );
        }
      }
      this.parts.set(name, list);
    }
  }

  private mesh(name: string, g: Geometry, material: StandardMaterial): Mesh {
    const mesh = new Mesh(name, this.scene);
    const data = new VertexData();
    data.positions = g.positions;
    data.normals = g.normals;
    data.indices = g.indices;
    data.colors = g.colors;
    if (g.uvs.length) data.uvs = g.uvs;
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.isPickable = false;
    // Instances move in and out around the camera: skip per-mesh culling
    mesh.alwaysSelectAsActiveMesh = true;
    // Register both instance buffers up front: adding "color" later leaves
    // an already compiled shader without the instanceColor attribute
    mesh.thinInstanceSetBuffer("matrix", new Float32Array(16), 16, false);
    mesh.thinInstanceSetBuffer("color", new Float32Array(4), 4, false);
    // With no instances Babylon would draw the base mesh once, at the origin
    mesh.setEnabled(false);
    return mesh;
  }

  /** Uploads the trees near the camera when it has moved enough. */
  update(camera: Vector3): void {
    if (Vector3.DistanceSquared(camera, this.lastRefresh) < REFRESH_DISTANCE * REFRESH_DISTANCE) return;
    this.lastRefresh.copyFrom(camera);

    for (const list of this.parts.values()) for (const p of list) p.pick.length = 0;
    const near2 = NEAR * NEAR;
    const far2 = FAR * FAR;
    for (let i = 0; i < this.spots.length; i++) {
      const t = this.spots[i];
      const dx = t.x - camera.x;
      const dz = t.z - camera.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > far2) continue;
      const lod = d2 < near2 ? 0 : 1;
      const list = this.parts.get(t.species)!;
      const base = (this.variantOf[i] * 2 + lod) * 2;
      list[base].pick.push(i);
      list[base + 1].pick.push(i);
    }

    for (const list of this.parts.values()) {
      for (const part of list) {
        const n = part.pick.length;
        part.mesh.setEnabled(n > 0);
        if (n === 0) continue;
        const mats = new Float32Array(n * 16);
        const cols = new Float32Array(n * 4);
        part.pick.forEach((i, k) => {
          mats.set(this.matrices.subarray(i * 16, i * 16 + 16), k * 16);
          cols.set(this.tints.subarray(i * 4, i * 4 + 4), k * 4);
        });
        part.mesh.thinInstanceSetBuffer("matrix", mats, 16, false);
        part.mesh.thinInstanceSetBuffer("color", cols, 4, false);
      }
    }
  }
}
