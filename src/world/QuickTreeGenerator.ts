/**
 * QuickTreeGenerator — ported from BabylonJS Community Extensions
 * Original: https://github.com/BabylonJS/Extensions/tree/master/TreeGenerators/QuickTreeGenerator
 * License: Apache-2.0
 *
 * Generates a tree using a randomized sphere (canopy) + tapered cylinder (trunk).
 * Flat-shaded for a stylized look.
 */
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Material } from "@babylonjs/core/Materials/material";

export function quickTree(
  sizeBranch: number,
  sizeTrunk: number,
  radius: number,
  trunkMaterial: Material,
  leafMaterial: Material,
  scene: Scene
): Mesh {
  const tree = new Mesh("tree", scene);

  // --- Canopy: sphere with randomized vertices ---
  const leaves = MeshBuilder.CreateSphere(
    "leaves",
    { segments: 2, diameter: sizeBranch },
    scene
  );

  const positions = leaves.getVerticesData(VertexBuffer.PositionKind) as number[];
  const indices = leaves.getIndices() as number[];
  const numberOfPoints = positions.length / 3;

  // Group shared vertices (same position) so we perturb them together
  const map: Array<{ pos: Vector3; indices: number[] }> = [];

  for (let i = 0; i < numberOfPoints; i++) {
    const p = new Vector3(
      positions[i * 3],
      positions[i * 3 + 1],
      positions[i * 3 + 2]
    );

    let found = false;
    for (const group of map) {
      if (group.pos.subtract(p).lengthSquared() < 0.01) {
        group.indices.push(i * 3);
        found = true;
        break;
      }
    }
    if (!found) {
      map.push({ pos: p, indices: [i * 3] });
    }
  }

  // Perturb each vertex group by a random offset
  const rng = (min: number, max: number) => Math.random() * (max - min) + min;
  const spread = sizeBranch / 10;

  for (const group of map) {
    const rx = rng(-spread, spread);
    const ry = rng(-spread, spread);
    const rz = rng(-spread, spread);
    for (const idx of group.indices) {
      positions[idx] += rx;
      positions[idx + 1] += ry;
      positions[idx + 2] += rz;
    }
  }

  leaves.setVerticesData(VertexBuffer.PositionKind, positions);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  leaves.setVerticesData(VertexBuffer.NormalKind, normals);
  leaves.convertToFlatShadedMesh();
  leaves.material = leafMaterial;

  // --- Trunk: tapered cylinder ---
  const trunk = MeshBuilder.CreateCylinder(
    "trunk",
    {
      height: sizeTrunk,
      diameterTop: Math.max(1, radius - 2),
      diameterBottom: radius,
      tessellation: 10,
      subdivisions: 2,
    },
    scene
  );
  trunk.material = trunkMaterial;
  trunk.convertToFlatShadedMesh();

  // Parent both to tree root
  leaves.parent = tree;
  trunk.parent = tree;

  // Position canopy on top of trunk
  leaves.position.y = (sizeTrunk + sizeBranch) / 2 - 2;

  return tree;
}
