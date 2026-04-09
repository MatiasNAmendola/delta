/**
 * ForestSystem — Dense instanced forest using proctree templates.
 *
 * Generates 8 tree templates (varied seeds/presets), merges trunk+twig
 * into InstancedMesh groups, then places hundreds of instances per template.
 * Result: dense jungle with very few draw calls.
 *
 * Three.js implementation using InstancedMesh.
 */
import * as THREE from 'three';
import { ProcTree } from "./ProcTree";
import { WATER_LEVEL, RIVER_MAP, WORLD_SIZE } from "../utils/constants";
import { WaterSystem } from "./WaterSystem";
import { seededRandom, getPointOnPath } from "../utils/helpers";

interface TreeTemplate {
  trunkGeometry: THREE.BufferGeometry;
  twigGeometry: THREE.BufferGeometry;
  trunkMaterial: THREE.MeshStandardMaterial;
  twigMaterial: THREE.MeshStandardMaterial;
  baseHeight: number;
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
  private scene: THREE.Scene;
  private templates: TreeTemplate[] = [];
  private instancedMeshes: THREE.InstancedMesh[] = [];

  constructor(scene: THREE.Scene, waterSystem: WaterSystem) {
    this.scene = scene;
    this.buildTemplates();
    this.placeForest(waterSystem);
  }

  private buildTemplates(): void {
    const trunkColor = new THREE.Color(TRUNK_COLOR);

    for (let t = 0; t < TREE_CONFIGS.length; t++) {
      const cfg = TREE_CONFIGS[t];
      const tree = new ProcTree({ segments: 6, ...cfg });

      // Trunk material
      const trunkMat = new THREE.MeshStandardMaterial({
        color: trunkColor,
        roughness: 0.9,
        metalness: 0.0,
      });

      // Leaf material with unique green
      const leafMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(LEAF_COLORS[t % LEAF_COLORS.length]),
        roughness: 0.8,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });

      // Create trunk geometry
      const trunkGeom = new THREE.BufferGeometry();
      const trunkPositions = ProcTree.flatten(tree.verts);
      const trunkNormals = ProcTree.flatten(tree.normals);
      const trunkUVs = ProcTree.flatten(tree.UV);
      const trunkIndices: number[] = [];
      for (const f of tree.faces) trunkIndices.push(f[0], f[1], f[2]);

      trunkGeom.setAttribute('position', new THREE.Float32BufferAttribute(trunkPositions, 3));
      trunkGeom.setAttribute('normal', new THREE.Float32BufferAttribute(trunkNormals, 3));
      trunkGeom.setAttribute('uv', new THREE.Float32BufferAttribute(trunkUVs, 2));
      trunkGeom.setIndex(trunkIndices);

      // Create twig geometry
      const twigGeom = new THREE.BufferGeometry();
      const twigPositions = ProcTree.flatten(tree.vertsTwig);
      const twigNormals = ProcTree.flatten(tree.normalsTwig);
      const twigUVs = ProcTree.flatten(tree.uvsTwig);
      const twigIndices: number[] = [];
      for (const f of tree.facesTwig) twigIndices.push(f[0], f[1], f[2]);

      twigGeom.setAttribute('position', new THREE.Float32BufferAttribute(twigPositions, 3));
      twigGeom.setAttribute('normal', new THREE.Float32BufferAttribute(twigNormals, 3));
      twigGeom.setAttribute('uv', new THREE.Float32BufferAttribute(twigUVs, 2));
      twigGeom.setIndex(twigIndices);

      // Estimate tree height from trunk verts
      let maxY = 0;
      for (let i = 1; i < tree.verts.length; i++) {
        if (tree.verts[i][1] > maxY) maxY = tree.verts[i][1];
      }

      this.templates.push({
        trunkGeometry: trunkGeom,
        twigGeometry: twigGeom,
        trunkMaterial: trunkMat,
        twigMaterial: leafMat,
        baseHeight: maxY,
      });
    }
  }

  private placeForest(waterSystem: WaterSystem): void {
    const rng = seededRandom(999);
    const treeCount = 600;
    const pairCount = TREE_CONFIGS.length;

    // Collect matrices per template
    const matricesPerTemplate: THREE.Matrix4[][] = [];
    for (let p = 0; p < pairCount; p++) {
      matricesPerTemplate.push([]);
    }

    const tmpPos = new THREE.Vector3();
    const tmpScale = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const upAxis = new THREE.Vector3(0, 1, 0);
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
      tmpQuat.setFromAxisAngle(upAxis, rotY);

      const mat = new THREE.Matrix4();
      mat.compose(tmpPos, tmpQuat, tmpScale);
      matricesPerTemplate[pairIdx].push(mat);
      placed++;
    }

    // Create InstancedMesh for each template (trunk + twig)
    for (let t = 0; t < pairCount; t++) {
      const matrices = matricesPerTemplate[t];
      if (matrices.length === 0) continue;
      const template = this.templates[t];

      // Trunk instanced mesh
      const trunkMesh = new THREE.InstancedMesh(
        template.trunkGeometry, template.trunkMaterial, matrices.length
      );
      for (let i = 0; i < matrices.length; i++) {
        trunkMesh.setMatrixAt(i, matrices[i]);
      }
      trunkMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(trunkMesh);
      this.instancedMeshes.push(trunkMesh);

      // Twig instanced mesh
      const twigMesh = new THREE.InstancedMesh(
        template.twigGeometry, template.twigMaterial, matrices.length
      );
      for (let i = 0; i < matrices.length; i++) {
        twigMesh.setMatrixAt(i, matrices[i]);
      }
      twigMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(twigMesh);
      this.instancedMeshes.push(twigMesh);
    }

    console.log(`ForestSystem: ${placed} trees (${pairCount} templates x2 meshes, instanced)`);
  }

  public dispose(): void {
    for (const mesh of this.instancedMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) m.dispose();
      } else {
        mesh.material.dispose();
      }
    }
    this.instancedMeshes = [];
  }
}
