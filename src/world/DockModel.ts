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
export async function placeDockModels(scene: Scene, placements: Matrix[]): Promise<Mesh[]> {
  const base = document.querySelector("base")?.href || window.location.href;
  const result = await SceneLoader.ImportMeshAsync("", new URL("models/", base).href, "muelle.glb", scene);

  const meshes: Mesh[] = [];
  const data = new Float32Array(placements.length * 16);
  placements.forEach((m, i) => m.copyToArray(data, i * 16));

  for (const node of result.meshes) {
    if (!(node instanceof Mesh) || node.getTotalVertices() === 0) continue;
    // Bake the glTF root (handedness conversion) into the vertices, then instance
    node.setParent(null);
    node.bakeCurrentTransformIntoVertices();
    node.thinInstanceSetBuffer("matrix", data.slice(), 16, true);
    node.thinInstanceRefreshBoundingInfo(false);
    node.isPickable = false;
    node.freezeWorldMatrix();
    node.material?.freeze();
    meshes.push(node);
  }
  for (const node of result.meshes) {
    if (!meshes.includes(node as Mesh)) node.dispose();
  }
  return meshes;
}
