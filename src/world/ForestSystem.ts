/**
 * ForestSystem — Dense instanced forest using proctree templates.
 *
 * Generates 8 tree templates (varied seeds/presets), merges trunk+twig
 * into single meshes, then places hundreds of thin instances per template.
 * Result: dense jungle with very few draw calls.
 */
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { ProcTree } from "./ProcTree";
import { WATER_LEVEL, RIVER_MAP, WORLD_SIZE } from "../utils/constants";
import { WaterSystem } from "./WaterSystem";
import { seededRandom, getPointOnPath } from "../utils/helpers";

interface TreeTemplate {
  mesh: Mesh;       // merged trunk+twig mesh
  baseHeight: number; // approximate tree height for placement
}

// Tree configs: varied seeds and params for diverse jungle look
const TREE_CONFIGS = [
  // Tall canopy trees
  { seed: 262, levels: 3, treeSteps: 2, trunkLength: 3.0, initalBranchLength: 0.7, maxRadius: 0.2, twigScale: 1.8, dropAmount: 0.1, growAmount: 0.1, clumpMax: 0.6, clumpMin: 0.3 },
  { seed: 88, levels: 3, treeSteps: 3, trunkLength: 3.5, initalBranchLength: 0.6, maxRadius: 0.18, twigScale: 1.5, dropAmount: 0.0, growAmount: 0.2, clumpMax: 0.7, clumpMin: 0.4 },
  { seed: 415, levels: 3, treeSteps: 2, trunkLength: 2.8, initalBranchLength: 0.75, maxRadius: 0.22, twigScale: 2.0, dropAmount: 0.05, growAmount: 0.05, clumpMax: 0.65, clumpMin: 0.35 },
  // Willow-like drooping
  { seed: 177, levels: 3, treeSteps: 2, trunkLength: 2.5, initalBranchLength: 0.65, maxRadius: 0.17, twigScale: 1.2, dropAmount: 0.25, growAmount: -0.15, clumpMax: 0.5, clumpMin: 0.25 },
  // Tall thin (poplar-like)
  { seed: 44, levels: 3, treeSteps: 3, trunkLength: 4.0, initalBranchLength: 0.5, maxRadius: 0.12, twigScale: 0.8, dropAmount: -0.1, growAmount: 0.4, clumpMax: 0.9, clumpMin: 0.8 },
  { seed: 301, levels: 3, treeSteps: 3, trunkLength: 3.8, initalBranchLength: 0.55, maxRadius: 0.14, twigScale: 0.9, dropAmount: -0.05, growAmount: 0.35, clumpMax: 0.85, clumpMin: 0.7 },
  // Bushy/short
  { seed: 550, levels: 2, treeSteps: 2, trunkLength: 1.8, initalBranchLength: 0.8, maxRadius: 0.15, twigScale: 2.5, dropAmount: 0.1, growAmount: 0.0, clumpMax: 0.5, clumpMin: 0.3 },
  { seed: 723, levels: 2, treeSteps: 2, trunkLength: 2.0, initalBranchLength: 0.7, maxRadius: 0.16, twigScale: 2.2, dropAmount: 0.08, growAmount: 0.05, clumpMax: 0.55, clumpMin: 0.3 },
];

const LEAF_COLORS = ["#2d8a2d", "#1a6a1a", "#45aa45", "#387a2a", "#2a6e3a", "#4a9a3a"];
const TRUNK_COLOR = "#6b4226";

export class ForestSystem {
  private scene: Scene;
  private templates: TreeTemplate[] = [];

  constructor(scene: Scene, waterSystem: WaterSystem) {
    this.scene = scene;
    this.buildTemplates();
    this.placeForest(waterSystem);
  }

  private buildTemplates(): void {
    const trunkMat = new StandardMaterial("forestTrunk", this.scene);
    trunkMat.diffuseColor = Color3.FromHexString(TRUNK_COLOR);
    trunkMat.specularColor = new Color3(0.05, 0.05, 0.05);

    for (let t = 0; t < TREE_CONFIGS.length; t++) {
      const cfg = TREE_CONFIGS[t];
      const tree = new ProcTree({ segments: 6, ...cfg });

      // Leaf material with unique green
      const leafMat = new StandardMaterial(`forestLeaf${t}`, this.scene);
      leafMat.diffuseColor = Color3.FromHexString(LEAF_COLORS[t % LEAF_COLORS.length]);
      leafMat.specularColor = new Color3(0.02, 0.02, 0.02);
      leafMat.backFaceCulling = false;

      // Create trunk mesh
      const trunkMesh = new Mesh(`ftTrunk${t}`, this.scene);
      const tvd = new VertexData();
      tvd.positions = ProcTree.flatten(tree.verts);
      tvd.normals = ProcTree.flatten(tree.normals);
      tvd.uvs = ProcTree.flatten(tree.UV);
      const ti: number[] = [];
      for (const f of tree.faces) ti.push(f[0], f[1], f[2]);
      tvd.indices = ti;
      tvd.applyToMesh(trunkMesh);
      trunkMesh.material = trunkMat;

      // Create twig mesh
      const twigMesh = new Mesh(`ftTwig${t}`, this.scene);
      const wvd = new VertexData();
      wvd.positions = ProcTree.flatten(tree.vertsTwig);
      wvd.normals = ProcTree.flatten(tree.normalsTwig);
      wvd.uvs = ProcTree.flatten(tree.uvsTwig);
      const wi: number[] = [];
      for (const f of tree.facesTwig) wi.push(f[0], f[1], f[2]);
      wvd.indices = wi;
      wvd.applyToMesh(twigMesh);
      twigMesh.material = leafMat;

      // Estimate tree height from trunk verts
      let maxY = 0;
      for (let i = 1; i < tree.verts.length; i++) {
        if (tree.verts[i][1] > maxY) maxY = tree.verts[i][1];
      }

      this.templates.push({ mesh: trunkMesh, baseHeight: maxY });
      this.templates.push({ mesh: twigMesh, baseHeight: maxY });
    }
  }

  private placeForest(waterSystem: WaterSystem): void {
    const rng = seededRandom(999);
    const treeCount = 600;

    // Collect positions per template pair (trunk+twig)
    const instanceMatrices: Float32Array[] = [];
    const instanceCounts: number[] = [];
    const pairCount = TREE_CONFIGS.length; // each config = 2 meshes (trunk, twig)

    for (let p = 0; p < pairCount; p++) {
      instanceMatrices.push(new Float32Array(treeCount * 16)); // overallocate
      instanceMatrices.push(new Float32Array(treeCount * 16));
      instanceCounts.push(0);
      instanceCounts.push(0);
    }

    const tmpPos = Vector3.Zero();
    const tmpScale = Vector3.Zero();
    let placed = 0;

    for (let i = 0; i < treeCount; i++) {
      const x = (rng() - 0.5) * WORLD_SIZE * 0.9;
      const z = (rng() - 0.5) * WORLD_SIZE * 0.9;

      if (waterSystem.isWater(x, z)) continue;

      // Check proximity to rivers for density
      let nearRiver = false;
      for (let d = 6; d <= 25; d += 6) {
        if (waterSystem.isWater(x + d, z) || waterSystem.isWater(x - d, z) ||
            waterSystem.isWater(x, z + d) || waterSystem.isWater(x, z - d)) {
          nearRiver = true;
          break;
        }
      }

      // Dense near rivers, sparse far away
      if (!nearRiver && rng() > 0.2) continue;

      const pairIdx = Math.floor(rng() * pairCount);
      const scale = 1.2 + rng() * 2.0;
      const rotY = rng() * Math.PI * 2;

      tmpPos.set(x, WATER_LEVEL + 0.1, z);
      tmpScale.set(scale, scale, scale);
      const rot = Quaternion.RotationAxis(Vector3.Up(), rotY);
      const mat = Matrix.Compose(tmpScale, rot, tmpPos);

      // Add to both trunk and twig buffers
      const trunkIdx = pairIdx * 2;
      const twigIdx = pairIdx * 2 + 1;
      const tc = instanceCounts[trunkIdx];
      mat.copyToArray(instanceMatrices[trunkIdx], tc * 16);
      mat.copyToArray(instanceMatrices[twigIdx], tc * 16);
      instanceCounts[trunkIdx] = tc + 1;
      instanceCounts[twigIdx] = tc + 1;
      placed++;
    }

    // Apply thin instances to each template mesh
    for (let m = 0; m < this.templates.length; m++) {
      const count = instanceCounts[m];
      if (count === 0) continue;
      const mesh = this.templates[m].mesh;
      const buffer = instanceMatrices[m].slice(0, count * 16);
      mesh.thinInstanceSetBuffer("matrix", buffer, 16);
      mesh.thinInstanceCount = count;
    }

    console.log(`ForestSystem: ${placed} trees (${pairCount} templates x2 meshes, thin instances)`);
  }

  public dispose(): void {
    for (const t of this.templates) {
      t.mesh.dispose();
    }
  }
}
