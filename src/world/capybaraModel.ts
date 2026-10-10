import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";

/**
 * The capybara's look, on its own so it can be swapped. For now a
 * placeholder of brown balls (a long body, a head, two small ears), until
 * there is a real model like the lancha colectiva's GLB.
 *
 * To replace it with a GLB: export one capybara (meters, +z forward, feet at
 * y = 0, merged into a single mesh), drop it in public/models/carpincho.glb,
 * and return that mesh from here (Capybaras.ts draws it as thin instances,
 * coloured through vertex colours or its own material).
 */
export function buildCapybara(scene: Scene, name: string, coat: Color3): Mesh {
  const parts: Mesh[] = [];
  const ball = (d: [number, number, number], v: number, pos: [number, number, number]) => {
    const m = MeshBuilder.CreateSphere("capyPart", { diameterX: d[0], diameterY: d[1], diameterZ: d[2], segments: 6 }, scene);
    m.position.set(...pos);
    const tone = new Color4(coat.r * v, coat.g * v, coat.b * v, 1);
    const n = m.getTotalVertices();
    m.setVerticesData("color", Array.from({ length: n }, () => [tone.r, tone.g, tone.b, tone.a]).flat());
    parts.push(m);
  };
  ball([0.5, 0.48, 0.95], 1, [0, 0.42, -0.05]); // body
  ball([0.32, 0.32, 0.4], 0.95, [0, 0.56, 0.55]); // head
  ball([0.07, 0.07, 0.05], 0.55, [-0.1, 0.74, 0.48]); // ears
  ball([0.07, 0.07, 0.05], 0.55, [0.1, 0.74, 0.48]);
  const merged = Mesh.MergeMeshes(parts, true, true)!;
  merged.name = name;
  return merged;
}
