import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/core/Meshes/thinInstanceMesh";
// Only the core glTF 2.0 loader: our models use no glTF extensions
import "@babylonjs/loaders/glTF/glTFFileLoader";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";

/**
 * Draws the Blender-made muelle (public/models/muelle.glb, built by
 * scripts/models/blender/muelle.py) at every dock. The model has one mesh
 * per material, so all docks together cost one draw call per material.
 *
 * Each placement matrix puts the model's origin (water level, deck center)
 * at the dock with its open side (+X) facing the water.
 */
export interface DockModels {
  meshes: Mesh[];
  /** Draws only the docks within `radius` of (x, z) (the fog hides the rest). */
  update(x: number, z: number): void;
}

const DOCK_RADIUS = 260;

export async function placeDockModels(scene: Scene, placements: Matrix[]): Promise<DockModels> {
  const base = document.querySelector("base")?.href || window.location.href;
  const result = await SceneLoader.ImportMeshAsync("", new URL("models/", base).href, "muelle.glb", scene);

  const meshes: Mesh[] = [];
  const data = new Float32Array(placements.length * 16);
  placements.forEach((m, i) => m.copyToArray(data, i * 16));
  // What is drawn: the nearby docks, packed at the front (shared by the model's meshes)
  const near = new Float32Array(data.length);

  for (const node of result.meshes) {
    if (!(node instanceof Mesh) || node.getTotalVertices() === 0) continue;
    // Bake the glTF root (handedness conversion) into the vertices, then instance
    node.setParent(null);
    node.bakeCurrentTransformIntoVertices();
    node.thinInstanceSetBuffer("matrix", near, 16, false);
    node.thinInstanceCount = 0;
    node.alwaysSelectAsActiveMesh = true;
    node.isPickable = false;
    node.freezeWorldMatrix();
    node.material?.freeze();
    meshes.push(node);
  }
  for (const node of result.meshes) {
    if (!meshes.includes(node as Mesh)) node.dispose();
  }
  let last = { x: Infinity, z: Infinity };
  return {
    meshes,
    update(x, z) {
      if (Math.hypot(x - last.x, z - last.z) < 8) return;
      last = { x, z };
      let n = 0;
      for (let i = 0; i < placements.length; i++) {
        if (Math.hypot(data[i * 16 + 12] - x, data[i * 16 + 14] - z) > DOCK_RADIUS) continue;
        near.set(data.subarray(i * 16, i * 16 + 16), n * 16);
        n++;
      }
      for (const mesh of meshes) {
        mesh.thinInstanceCount = n;
        mesh.setEnabled(n > 0);
        if (n > 0) mesh.thinInstanceBufferUpdated("matrix");
      }
    },
  };
}
