import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { BoatSpec } from "./boatTypes";

/**
 * Procedural models for the small boats (the lancha colectiva uses the
 * user's Tripo3D GLB). A GLB with the boat's id in public/models replaces
 * them (see Boat.loadModel). Built in world units: bow towards +z,
 * waterline at y = 0. `animate(phase, effort)` moves paddles and oars.
 */
export interface BoatModel {
  root: TransformNode;
  animate(phase: number, effort: number): void;
}

type Profile = (s: number) => number;

interface LoftOptions {
  length: number;
  halfBeam: Profile;
  sheer: Profile;
  keel: Profile;
  /** Paint bands bottom to top: [top height or null for the sheer, color]. */
  bands: Array<[number | null, Color3]>;
  deck?: Color3;
  bilge?: number;
}

function material(scene: Scene, name: string, color: Color3, specular = 0.15): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = new Color3(specular, specular, specular);
  return m;
}

/**
 * Lofted hull: cross-sections from the stern (s = 0) to the bow (s = 1),
 * keel to sheer with a round bilge, painted in horizontal bands, plus an
 * optional flat deck closing the top.
 */
function loftHull(scene: Scene, name: string, parent: TransformNode, o: LoftOptions): void {
  const stations = 36;
  const rowsPerBand = 5;
  const bilge = o.bilge ?? 0.55;
  const y = (s: number) => o.length / 2 - s * o.length; // returned as z (bow +z): stern at -L/2
  const tAt = (s: number, height: number) => {
    const k = o.keel(s);
    const sh = o.sheer(s);
    return Math.min(1, Math.max(0, (height - k) / (sh - k))) ** (1 / 1.25);
  };
  const point = (s: number, t: number, side: number): [number, number, number] => {
    const hb = o.halfBeam(s);
    const k = o.keel(s);
    const sh = o.sheer(s);
    return [side * hb * Math.sin((t * Math.PI) / 2) ** bilge, k + (sh - k) * t ** 1.25, -y(s)];
  };
  let start: Profile = () => 0;
  o.bands.forEach(([top, color], b) => {
    const from = start;
    const to = (s: number) => (top === null ? 1 : tAt(s, top));
    const positions: number[] = [];
    const indices: number[] = [];
    for (const side of [1, -1]) {
      const base = positions.length / 3;
      for (let i = 0; i <= stations; i++) {
        const s = i / stations;
        for (let r = 0; r <= rowsPerBand; r++) {
          const t = from(s) + ((to(s) - from(s)) * r) / rowsPerBand;
          positions.push(...point(s, t, side));
        }
      }
      for (let i = 0; i < stations; i++) {
        for (let r = 0; r < rowsPerBand; r++) {
          const a = base + i * (rowsPerBand + 1) + r;
          const c = a + rowsPerBand + 1;
          if (side > 0) indices.push(a, c, a + 1, a + 1, c, c + 1);
          else indices.push(a, a + 1, c, a + 1, c + 1, c);
        }
      }
    }
    const mesh = new Mesh(`${name}_banda${b}`, scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.material = material(scene, `${name}_banda${b}`, color);
    mesh.material.backFaceCulling = false;
    mesh.parent = parent;
    mesh.isPickable = false;
    start = to;
  });
  if (o.deck) {
    // Deck: fan from the centerline at sheer height
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= stations; i++) {
      const s = i / stations;
      const [px, py, pz] = point(s, 1, 1);
      positions.push(-px, py, pz, px, py, pz);
    }
    for (let i = 0; i < stations; i++) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const deck = new Mesh(`${name}_cubierta`, scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    // The deck faces up (computed normals depend on the fan's winding)
    data.normals = positions.map((_, i) => (i % 3 === 1 ? 1 : 0));
    data.applyToMesh(deck);
    deck.material = material(scene, `${name}_cubierta`, o.deck, 0.25);
    deck.material.backFaceCulling = false;
    deck.parent = parent;
    deck.isPickable = false;
  }
}

function box(scene: Scene, parent: TransformNode, name: string, size: [number, number, number], pos: [number, number, number], color: Color3): Mesh {
  const m = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  m.position.set(...pos);
  m.material = material(scene, name, color);
  m.parent = parent;
  m.isPickable = false;
  return m;
}

const SKIN = new Color3(0.86, 0.66, 0.5);

/** A seated person: torso (vest color), head, cap. Origin at the seat. */
function person(scene: Scene, parent: TransformNode, name: string, scale: number, vest: Color3): TransformNode {
  const p = new TransformNode(name, scene);
  p.parent = parent;
  const torso = box(scene, p, `${name}_torso`, [0.42 * scale, 0.55 * scale, 0.28 * scale], [0, 0.32 * scale, 0], vest);
  torso.position.y = 0.3 * scale;
  const head = MeshBuilder.CreateSphere(`${name}_cabeza`, { diameter: 0.24 * scale, segments: 8 }, scene);
  head.position.set(0, 0.72 * scale, 0);
  head.material = material(scene, `${name}_cabeza`, SKIN);
  head.parent = p;
  head.isPickable = false;
  return p;
}

/** Oar or paddle shaft along local +x from the pivot, with a blade at the end. */
function oar(scene: Scene, parent: TransformNode, name: string, length: number, blade: Color3, double = false): TransformNode {
  const pivot = new TransformNode(name, scene);
  pivot.parent = parent;
  const shaft = MeshBuilder.CreateCylinder(`${name}_vara`, { height: length, diameter: length * 0.025, tessellation: 6 }, scene);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = double ? 0 : length / 2;
  shaft.material = material(scene, `${name}_vara`, new Color3(0.82, 0.72, 0.5));
  shaft.parent = pivot;
  shaft.isPickable = false;
  const ends = double ? [-length / 2, length / 2] : [length];
  for (const x of ends) {
    const b = box(scene, pivot, `${name}_pala`, [length * 0.16, length * 0.012, length * 0.07], [x, 0, 0], blade);
    b.rotation.x = 0.2;
  }
  return pivot;
}

// The person is designed 1 m = 1 unit; world units are 8 m
const M = 1 / 8;

export function buildKayak(scene: Scene, spec: BoatSpec): BoatModel {
  const root = new TransformNode("kayak", scene);
  const L = spec.length;
  loftHull(scene, "kayak", root, {
    length: L,
    halfBeam: (s) => (spec.width / 2) * Math.sin(Math.PI * s) ** 0.6,
    sheer: (s) => 0.035 + 0.012 * (2 * s - 1) ** 2,
    keel: (s) => -0.022 + 0.012 * (2 * s - 1) ** 4,
    bands: [
      [0.012, new Color3(0.92, 0.75, 0.12)],
      [null, new Color3(0.95, 0.8, 0.15)],
    ],
    deck: new Color3(0.85, 0.25, 0.12),
    bilge: 0.45,
  });
  // Cockpit and paddler
  const coaming = MeshBuilder.CreateTorus("kayak_brocal", { diameter: 0.07, thickness: 0.008, tessellation: 16 }, scene);
  coaming.scaling.z = 1.5;
  coaming.position.set(0, 0.042, -0.02);
  coaming.material = material(scene, "kayak_brocal", new Color3(0.1, 0.1, 0.1));
  coaming.parent = root;
  const paddler = person(scene, root, "kayak_palista", M, new Color3(0.95, 0.4, 0.08));
  paddler.position.set(0, 0.03, -0.02);
  const paddle = oar(scene, root, "kayak_pala", 2.2 * M, new Color3(0.15, 0.35, 0.75), true);
  paddle.position.set(0, 0.075, 0.0);
  return {
    root,
    animate(phase, effort) {
      // Double paddle: alternate strokes, dipping each blade in turn
      paddle.rotation.z = Math.sin(phase) * 0.55 * Math.max(0.25, effort);
      paddle.rotation.y = Math.cos(phase) * 0.35 * effort;
    },
  };
}

export function buildTravesia(scene: Scene, spec: BoatSpec): BoatModel {
  const root = new TransformNode("travesia", scene);
  const L = spec.length;
  loftHull(scene, "travesia", root, {
    length: L,
    halfBeam: (s) => (spec.width / 2) * (s < 0.12 ? 0.55 + (s / 0.12) * 0.45 : Math.max(0, 1 - ((s - 0.12) / 0.88) ** 2.2) ** 0.6),
    sheer: (s) => 0.05 + 0.02 * Math.max(0, s - 0.75) * 4,
    keel: (s) => -0.025 + 0.02 * Math.max(0, (s - 0.85) / 0.15) ** 2,
    bands: [
      [0.01, new Color3(0.18, 0.12, 0.08)],
      [null, new Color3(0.58, 0.32, 0.14)],
    ],
    deck: new Color3(0.78, 0.6, 0.38),
  });
  const vests = [new Color3(0.2, 0.35, 0.75), new Color3(0.95, 0.95, 0.95), new Color3(0.2, 0.35, 0.75), new Color3(0.95, 0.95, 0.95)];
  const oars: Array<{ pivot: TransformNode; side: number }> = [];
  const torsos: TransformNode[] = [];
  for (let k = 0; k < 4; k++) {
    const z = L * (0.25 - k * 0.14);
    const rower = person(scene, root, `travesia_remero${k}`, M, vests[k]);
    rower.position.set(0, 0.04, z);
    rower.rotation.y = Math.PI; // rowers face the stern
    torsos.push(rower);
    for (const side of [1, -1]) {
      const pivot = oar(scene, root, `travesia_remo${k}${side}`, 2.9 * M, new Color3(0.2, 0.35, 0.75));
      pivot.position.set(side * spec.width * 0.5, 0.085, z - 0.03);
      if (side < 0) pivot.rotation.y = Math.PI;
      oars.push({ pivot, side });
    }
  }
  const cox = person(scene, root, "travesia_timonel", M * 0.9, new Color3(0.95, 0.75, 0.1));
  cox.position.set(0, 0.04, -L * 0.38);
  return {
    root,
    animate(phase, effort) {
      const sweep = Math.sin(phase) * 0.5 * Math.max(0.2, effort);
      const dip = -0.18 + Math.cos(phase) * 0.12;
      for (const { pivot, side } of oars) {
        pivot.rotation.y = (side < 0 ? Math.PI : 0) - side * sweep;
        pivot.rotation.z = dip;
      }
      for (const t of torsos) t.rotation.x = -Math.sin(phase) * 0.3 * effort;
    },
  };
}

export function buildOpen(scene: Scene, spec: BoatSpec): BoatModel {
  const root = new TransformNode("open", scene);
  const L = spec.length;
  loftHull(scene, "open", root, {
    length: L,
    halfBeam: (s) => (spec.width / 2) * (s < 0.6 ? 0.92 + 0.08 * Math.sin((s / 0.6) * (Math.PI / 2)) : Math.max(0, 1 - ((s - 0.6) / 0.4) ** 1.8) ** 0.7),
    sheer: (s) => 0.075 + 0.03 * Math.max(0, (s - 0.5) / 0.5) ** 2,
    keel: (s) => -0.04 + 0.035 * Math.max(0, (s - 0.7) / 0.3) ** 2,
    bands: [
      [0.0, new Color3(0.85, 0.86, 0.86)],
      [0.025, new Color3(0.08, 0.2, 0.5)],
      [null, new Color3(0.95, 0.95, 0.94)],
    ],
    deck: new Color3(0.82, 0.8, 0.74),
    bilge: 0.85,
  });
  const white = new Color3(0.94, 0.94, 0.93);
  box(scene, root, "open_consola", [0.07, 0.07, 0.07], [0.02, 0.11, 0.02], white);
  const glass = box(scene, root, "open_parabrisas", [0.1, 0.035, 0.005], [0.02, 0.165, 0.06], new Color3(0.2, 0.3, 0.35));
  glass.rotation.x = -0.4;
  box(scene, root, "open_asiento", [0.12, 0.03, 0.06], [0, 0.09, -0.12], new Color3(0.85, 0.82, 0.75));
  const driver = person(scene, root, "open_conductor", M, new Color3(0.9, 0.2, 0.15));
  driver.position.set(0.02, 0.075, -0.06);
  // Outboard motor on the transom
  const motor = new TransformNode("open_motor", scene);
  motor.parent = root;
  motor.position.set(0, 0.06, -L / 2 - 0.01);
  box(scene, motor, "open_motor_capot", [0.05, 0.06, 0.06], [0, 0.04, -0.02], new Color3(0.12, 0.12, 0.13));
  box(scene, motor, "open_motor_pata", [0.015, 0.1, 0.02], [0, -0.04, -0.02], new Color3(0.2, 0.2, 0.22));
  return {
    root,
    animate(_phase, effort) {
      // The motor trims up a little at speed
      motor.rotation.x = -0.15 * effort;
    },
  };
}
