/**
 * BabylonJS adapter for ProcTree — converts raw geometry to BabylonJS Mesh.
 * Creates realistic procedural trees with proper branching and leaf geometry.
 * Leaf quads get a procedural alpha-cutout texture for organic leaf shapes.
 */
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Material } from "@babylonjs/core/Materials/material";
import { Constants } from "@babylonjs/core/Engines/constants";
import { ProcTree, TREE_PRESETS } from "./ProcTree";
import type { TreeProperties } from "./ProcTree";

/** Shared leaf texture — created once, reused for all trees */
let leafTexture: DynamicTexture | null = null;

function getLeafTexture(scene: Scene): DynamicTexture {
  if (leafTexture) return leafTexture;

  const size = 128;
  const tex = new DynamicTexture("leafTex", size, scene, false);
  const ctx = tex.getContext();

  // Draw a cluster of small leaf shapes on a transparent background
  ctx.clearRect(0, 0, size, size);

  // Simple pseudo-random for deterministic leaves
  let seed = 42;
  const rng = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };

  // Draw 12-18 leaf ovals scattered across the quad
  const leafCount = 12 + Math.floor(rng() * 7);
  for (let i = 0; i < leafCount; i++) {
    const cx = 10 + rng() * (size - 20);
    const cy = 10 + rng() * (size - 20);
    const w = 8 + rng() * 16;
    const h = 5 + rng() * 10;
    const angle = rng() * Math.PI;

    // Vary green shades
    const g = 80 + Math.floor(rng() * 100);
    const r = 20 + Math.floor(rng() * 40);
    const b = 10 + Math.floor(rng() * 30);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(1, h / w); // squash circle into ellipse
    ctx.beginPath();
    ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
    ctx.restore(); // restore before fill so stroke isn't scaled
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
    ctx.fill();
  }

  tex.update(true);
  tex.hasAlpha = true;
  leafTexture = tex;
  return tex;
}

export function createProcTreeMesh(
  name: string,
  scene: Scene,
  trunkMaterial: Material,
  leafMaterial: Material,
  preset: Partial<TreeProperties>,
  scale = 1
): Mesh {
  const tree = new ProcTree(preset);

  // --- Trunk mesh ---
  const trunkMesh = new Mesh(name + "_trunk", scene);
  const trunkVD = new VertexData();
  trunkVD.positions = ProcTree.flatten(tree.verts);
  trunkVD.normals = ProcTree.flatten(tree.normals);
  trunkVD.uvs = ProcTree.flatten(tree.UV);
  const trunkIndices: number[] = [];
  for (const f of tree.faces) { trunkIndices.push(f[0], f[1], f[2]); }
  trunkVD.indices = trunkIndices;
  trunkVD.applyToMesh(trunkMesh);
  trunkMesh.material = trunkMaterial;

  // --- Twig/leaf mesh with alpha-cutout leaf texture ---
  const twigMesh = new Mesh(name + "_twigs", scene);
  const twigVD = new VertexData();
  twigVD.positions = ProcTree.flatten(tree.vertsTwig);
  twigVD.normals = ProcTree.flatten(tree.normalsTwig);
  twigVD.uvs = ProcTree.flatten(tree.uvsTwig);
  const twigIndices: number[] = [];
  for (const f of tree.facesTwig) { twigIndices.push(f[0], f[1], f[2]); }
  twigVD.indices = twigIndices;
  twigVD.applyToMesh(twigMesh);

  // Apply leaf texture with alpha cutout to the leaf material
  if (leafMaterial instanceof StandardMaterial && !leafMaterial.diffuseTexture) {
    const leafTex = getLeafTexture(scene);
    leafMaterial.diffuseTexture = leafTex;
    leafMaterial.useAlphaFromDiffuseTexture = true;
    leafMaterial.transparencyMode = Material.MATERIAL_ALPHATEST;
    leafMaterial.alphaCutOff = 0.4;
    leafMaterial.backFaceCulling = false;
  }
  twigMesh.material = leafMaterial;

  // Parent both to a root mesh
  const root = new Mesh(name, scene);
  trunkMesh.parent = root;
  twigMesh.parent = root;
  root.scaling.setAll(scale);

  return root;
}

export { TREE_PRESETS };
