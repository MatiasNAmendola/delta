/**
 * Three.js adapter for ProcTree — converts raw geometry to Three.js Mesh.
 * Creates realistic procedural trees with proper branching and leaf geometry.
 * Leaf quads get a procedural alpha-cutout texture for organic leaf shapes.
 */
import * as THREE from "three";
import { ProcTree, TREE_PRESETS } from "./ProcTree";
import type { TreeProperties } from "./ProcTree";

/** Shared leaf texture — created once, reused for all trees */
let leafTexture: THREE.CanvasTexture | null = null;

function getLeafTexture(): THREE.CanvasTexture {
  if (leafTexture) return leafTexture;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Draw a cluster of small leaf shapes on a transparent background
  ctx.clearRect(0, 0, size, size);

  // Simple pseudo-random for deterministic leaves
  let seed = 42;
  const rng = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

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

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  leafTexture = tex;
  return tex;
}

export function createProcTreeMesh(
  name: string,
  scene: THREE.Scene,
  trunkMaterial: THREE.Material,
  leafMaterial: THREE.MeshStandardMaterial | null,
  preset: Partial<TreeProperties>,
  scale = 1
): THREE.Group {
  const tree = new ProcTree(preset);

  // --- Trunk mesh ---
  const trunkGeom = new THREE.BufferGeometry();
  trunkGeom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(ProcTree.flatten(tree.verts), 3)
  );
  trunkGeom.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(ProcTree.flatten(tree.normals), 3)
  );
  trunkGeom.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(ProcTree.flatten(tree.UV), 2)
  );
  const trunkIndices: number[] = [];
  for (const f of tree.faces) {
    trunkIndices.push(f[0], f[1], f[2]);
  }
  trunkGeom.setIndex(trunkIndices);
  const trunkMesh = new THREE.Mesh(trunkGeom, trunkMaterial);
  trunkMesh.name = name + "_trunk";

  // --- Twig/leaf mesh with alpha-cutout leaf texture ---
  const twigGeom = new THREE.BufferGeometry();
  twigGeom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(ProcTree.flatten(tree.vertsTwig), 3)
  );
  twigGeom.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(ProcTree.flatten(tree.normalsTwig), 3)
  );
  twigGeom.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(ProcTree.flatten(tree.uvsTwig), 2)
  );
  const twigIndices: number[] = [];
  for (const f of tree.facesTwig) {
    twigIndices.push(f[0], f[1], f[2]);
  }
  twigGeom.setIndex(twigIndices);

  // Apply leaf texture with alpha cutout
  if (leafMaterial && !leafMaterial.map) {
    const leafTex = getLeafTexture();
    leafMaterial.map = leafTex;
    leafMaterial.alphaTest = 0.4;
    leafMaterial.transparent = false;
    leafMaterial.side = THREE.DoubleSide;
  }

  const twigMesh = new THREE.Mesh(twigGeom, leafMaterial ?? trunkMaterial);
  twigMesh.name = name + "_twigs";

  // Parent both to a group
  const root = new THREE.Group();
  root.name = name;
  root.add(trunkMesh);
  root.add(twigMesh);
  root.scale.setScalar(scale);

  scene.add(root);

  return root;
}

export { TREE_PRESETS };
