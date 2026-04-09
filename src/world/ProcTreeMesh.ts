/**
 * BabylonJS adapter for ProcTree — converts raw geometry to BabylonJS Mesh.
 * Creates realistic procedural trees with proper branching and leaf geometry.
 */
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Material } from "@babylonjs/core/Materials/material";
import { ProcTree, TREE_PRESETS } from "./ProcTree";
import type { TreeProperties } from "./ProcTree";

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
  // Flatten face indices: each face is [a, b, c]
  const trunkIndices: number[] = [];
  for (const f of tree.faces) { trunkIndices.push(f[0], f[1], f[2]); }
  trunkVD.indices = trunkIndices;
  trunkVD.applyToMesh(trunkMesh);
  trunkMesh.material = trunkMaterial;

  // --- Twig/leaf mesh ---
  const twigMesh = new Mesh(name + "_twigs", scene);
  const twigVD = new VertexData();
  twigVD.positions = ProcTree.flatten(tree.vertsTwig);
  twigVD.normals = ProcTree.flatten(tree.normalsTwig);
  twigVD.uvs = ProcTree.flatten(tree.uvsTwig);
  const twigIndices: number[] = [];
  for (const f of tree.facesTwig) { twigIndices.push(f[0], f[1], f[2]); }
  twigVD.indices = twigIndices;
  twigVD.applyToMesh(twigMesh);
  twigMesh.material = leafMaterial;

  // Parent both to a root mesh
  const root = new Mesh(name, scene);
  trunkMesh.parent = root;
  twigMesh.parent = root;
  root.scaling.setAll(scale);

  return root;
}

export { TREE_PRESETS };
