import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
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

/**
 * Racing single scull (1x): a needle of a shell, outriggers and one sculler
 * facing the stern. `vest` dresses the rower in the club's colors.
 */
export function buildSingle(scene: Scene, spec: BoatSpec, vest = new Color3(0.15, 0.3, 0.7), name: string = spec.id): BoatModel {
  const root = new TransformNode(name, scene);
  const L = spec.length;
  loftHull(scene, name, root, {
    length: L,
    halfBeam: (s) => (spec.width / 2) * Math.sin(Math.PI * Math.min(1, s * 1.05)) ** 0.8,
    sheer: () => 0.022,
    keel: (s) => -0.018 + 0.012 * (2 * s - 1) ** 6,
    bands: [[null, new Color3(0.93, 0.93, 0.92)]],
    deck: new Color3(0.55, 0.32, 0.15),
    bilge: 0.5,
  });
  const metal = new Color3(0.75, 0.75, 0.78);
  box(scene, root, `${name}_rigger`, [0.2, 0.006, 0.012], [0, 0.065, 0.02], metal);
  const rower = person(scene, root, `${name}_remero`, M, vest);
  rower.position.set(0, 0.02, -0.03);
  rower.rotation.y = Math.PI;
  const oars: Array<{ pivot: TransformNode; side: number }> = [];
  for (const side of [1, -1]) {
    const pivot = oar(scene, root, `${name}_remo${side}`, 2.9 * M, vest);
    pivot.position.set(side * 0.1, 0.07, 0.02);
    if (side < 0) pivot.rotation.y = Math.PI;
    oars.push({ pivot, side });
  }
  return {
    root,
    animate(phase, effort) {
      const sweep = Math.sin(phase) * 0.55 * Math.max(0.2, effort);
      const dip = -0.2 + Math.cos(phase) * 0.12;
      for (const { pivot, side } of oars) {
        pivot.rotation.y = (side < 0 ? Math.PI : 0) - side * sweep;
        pivot.rotation.z = dip;
      }
      rower.rotation.x = -Math.sin(phase) * 0.35 * effort;
      rower.position.z = -0.03 + Math.sin(phase) * 0.02 * effort;
    },
  };
}

/** An outboard motor hung on the transom; it trims up at speed. */
function outboard(scene: Scene, parent: TransformNode, name: string, L: number, size: number, cowl: Color3): TransformNode {
  const motor = new TransformNode(`${name}_motor`, scene);
  motor.parent = parent;
  motor.position.set(0, 0.06 * size, -L / 2 - 0.01 * size);
  box(scene, motor, `${name}_motor_capot`, [0.05 * size, 0.06 * size, 0.06 * size], [0, 0.04 * size, -0.02 * size], cowl);
  box(scene, motor, `${name}_motor_pata`, [0.015 * size, 0.1 * size, 0.02 * size], [0, -0.04 * size, -0.02 * size], new Color3(0.2, 0.2, 0.22));
  return motor;
}

/** Fine bow, full stern: the planform of a planing hull. */
const planingBeam = (width: number) => (s: number) =>
  (width / 2) * (s < 0.6 ? 0.92 + 0.08 * Math.sin((s / 0.6) * (Math.PI / 2)) : Math.max(0, 1 - ((s - 0.6) / 0.4) ** 1.8) ** 0.7);

/** Runabout / bowrider: white fiberglass with a colored stripe, windshield and console. */
export function buildRunabout(scene: Scene, spec: BoatSpec): BoatModel {
  const root = new TransformNode(spec.id, scene);
  const L = spec.length;
  const k = L / 0.8;
  loftHull(scene, spec.id, root, {
    length: L,
    halfBeam: planingBeam(spec.width),
    sheer: (s) => (0.075 + 0.03 * Math.max(0, (s - 0.5) / 0.5) ** 2) * k,
    keel: (s) => (-0.04 + 0.035 * Math.max(0, (s - 0.7) / 0.3) ** 2) * k,
    bands: [
      [0.0, new Color3(0.85, 0.86, 0.86)],
      [0.025 * k, new Color3(0.08, 0.2, 0.5)],
      [null, new Color3(0.95, 0.95, 0.94)],
    ],
    deck: new Color3(0.82, 0.8, 0.74),
    bilge: 0.85,
  });
  const white = new Color3(0.94, 0.94, 0.93);
  box(scene, root, `${spec.id}_consola`, [0.07 * k, 0.07 * k, 0.07 * k], [0.02 * k, 0.11 * k, 0.02 * k], white);
  const glass = box(scene, root, `${spec.id}_parabrisas`, [0.1 * k, 0.035 * k, 0.005], [0.02 * k, 0.165 * k, 0.06 * k], new Color3(0.2, 0.3, 0.35));
  glass.rotation.x = -0.4;
  box(scene, root, `${spec.id}_asiento`, [0.12 * k, 0.03 * k, 0.06 * k], [0, 0.09 * k, -0.12 * k], new Color3(0.85, 0.82, 0.75));
  // Bimini top over the cockpit
  box(scene, root, `${spec.id}_bimini`, [0.2 * k, 0.006, 0.16 * k], [0, 0.26 * k, -0.08 * k], new Color3(0.1, 0.18, 0.35));
  for (const x of [-0.095, 0.095]) box(scene, root, `${spec.id}_bimini_caño`, [0.005, 0.17 * k, 0.005], [x * k, 0.175 * k, -0.02 * k], new Color3(0.7, 0.7, 0.72));
  const driver = person(scene, root, `${spec.id}_conductor`, M, new Color3(0.9, 0.2, 0.15));
  driver.position.set(0.02 * k, 0.075 * k, -0.06 * k);
  const motor = outboard(scene, root, spec.id, L, k, new Color3(0.12, 0.12, 0.13));
  return {
    root,
    animate(_phase, effort) {
      motor.rotation.x = -0.15 * effort;
    },
  };
}

/** Aluminum fishing boat: low gray hull, bench seats, small outboard, a fisherman with his rod. */
export function buildPesca(scene: Scene, spec: BoatSpec): BoatModel {
  const root = new TransformNode(spec.id, scene);
  const L = spec.length;
  const W = spec.width;
  loftHull(scene, spec.id, root, {
    length: L,
    halfBeam: (s) => (W / 2) * (s < 0.65 ? 1 : Math.max(0, 1 - ((s - 0.65) / 0.35) ** 2) ** 0.6),
    sheer: (s) => 0.06 + 0.02 * Math.max(0, (s - 0.6) / 0.4) ** 2,
    keel: (s) => -0.025 + 0.03 * Math.max(0, (s - 0.75) / 0.25) ** 2,
    bands: [
      [0.0, new Color3(0.42, 0.44, 0.45)],
      [null, new Color3(0.68, 0.7, 0.72)],
    ],
    bilge: 0.4,
  });
  // Open hull: floor and three bench seats
  box(scene, root, "pesca_piso", [W * 0.85, 0.004, L * 0.75], [0, 0.0, -L * 0.04], new Color3(0.5, 0.52, 0.53));
  for (const z of [-0.32, 0, 0.26]) box(scene, root, "pesca_banco", [W * 0.9, 0.008, 0.045], [0, 0.045, z * L], new Color3(0.62, 0.64, 0.66));
  const fisher = person(scene, root, "pesca_pescador", M, new Color3(0.25, 0.4, 0.22));
  fisher.position.set(0, 0.045, 0.26 * L);
  const rod = MeshBuilder.CreateCylinder("pesca_caña", { height: 0.32, diameterTop: 0.002, diameterBottom: 0.006, tessellation: 5 }, scene);
  rod.material = material(scene, "pesca_caña", new Color3(0.15, 0.15, 0.15));
  rod.parent = root;
  rod.isPickable = false;
  rod.position.set(0.05, 0.16, 0.36 * L);
  rod.rotation.set(0.9, 0, -0.5);
  const helmsman = person(scene, root, "pesca_timonel", M, new Color3(0.8, 0.55, 0.15));
  helmsman.position.set(0, 0.045, -0.32 * L);
  const motor = outboard(scene, root, spec.id, L, 0.7, new Color3(0.1, 0.1, 0.11));
  return {
    root,
    animate(phase, effort) {
      motor.rotation.x = -0.1 * effort;
      rod.rotation.z = -0.5 + Math.sin(phase * 0.7) * 0.05;
    },
  };
}

/** Classic varnished mahogany runabout (Riva style): long bow deck, cream seats, chrome. */
export function buildClasica(scene: Scene, spec: BoatSpec): BoatModel {
  const root = new TransformNode(spec.id, scene);
  const L = spec.length;
  const k = L / 0.8;
  const mahogany = new Color3(0.42, 0.2, 0.09);
  loftHull(scene, spec.id, root, {
    length: L,
    halfBeam: planingBeam(spec.width),
    sheer: (s) => (0.07 + 0.025 * Math.max(0, (s - 0.45) / 0.55) ** 2) * k,
    keel: (s) => (-0.035 + 0.03 * Math.max(0, (s - 0.7) / 0.3) ** 2) * k,
    bands: [
      [0.0, new Color3(0.12, 0.1, 0.09)],
      [0.012 * k, new Color3(0.92, 0.9, 0.85)],
      [null, mahogany],
    ],
    deck: new Color3(0.5, 0.26, 0.12),
    bilge: 0.9,
  });
  // Varnish shines
  root.getChildMeshes().forEach((m) => {
    const mat = m.material as StandardMaterial;
    if (mat && mat.diffuseColor.r > 0.35 && mat.diffuseColor.g < 0.3) mat.specularColor = new Color3(0.6, 0.5, 0.4);
  });
  const cream = new Color3(0.93, 0.88, 0.76);
  // Two cockpits behind the long bow deck
  box(scene, root, "clasica_cabina1", [spec.width * 0.75, 0.02 * k, 0.12 * k], [0, 0.075 * k, -0.02 * k], cream);
  box(scene, root, "clasica_cabina2", [spec.width * 0.75, 0.02 * k, 0.12 * k], [0, 0.075 * k, -0.2 * k], cream);
  const glass = box(scene, root, "clasica_parabrisas", [spec.width * 0.7, 0.04 * k, 0.004], [0, 0.11 * k, 0.06 * k], new Color3(0.55, 0.6, 0.62));
  glass.rotation.x = -0.5;
  (glass.material as StandardMaterial).specularColor = new Color3(0.9, 0.9, 0.9);
  const flag = box(scene, root, "clasica_bandera", [0.002, 0.03 * k, 0.045 * k], [0, 0.12 * k, -L / 2 + 0.02], new Color3(0.45, 0.65, 0.88));
  flag.position.z -= 0.02;
  const driver = person(scene, root, "clasica_conductor", M, new Color3(0.95, 0.95, 0.93));
  driver.position.set(0.04 * k, 0.07 * k, -0.02 * k);
  const guest = person(scene, root, "clasica_invitada", M, new Color3(0.75, 0.15, 0.2));
  guest.position.set(-0.04 * k, 0.07 * k, -0.2 * k);
  return { root, animate() {} };
}

/** Rigid inflatable: gray tubes all around, center console, big outboard. */
export function buildSemirrigido(scene: Scene, spec: BoatSpec): BoatModel {
  const root = new TransformNode(spec.id, scene);
  const L = spec.length;
  const W = spec.width;
  const beam = planingBeam(W * 0.8);
  loftHull(scene, spec.id, root, {
    length: L,
    halfBeam: beam,
    sheer: () => 0.035,
    keel: (s) => -0.035 + 0.03 * Math.max(0, (s - 0.7) / 0.3) ** 2,
    bands: [[null, new Color3(0.9, 0.9, 0.9)]],
    deck: new Color3(0.3, 0.3, 0.3),
    bilge: 0.8,
  });
  // The tube: a tube mesh along the gunwale, closing at the bow
  const tubeR = W * 0.11;
  const path: Vector3[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const s = 0.02 + (i / n) * 0.96;
    path.push(new Vector3(beam(s) + tubeR * 0.6, 0.045, -L / 2 + s * L));
  }
  for (let i = n; i >= 0; i--) {
    const s = 0.02 + (i / n) * 0.96;
    path.push(new Vector3(-beam(s) - tubeR * 0.6, 0.045, -L / 2 + s * L));
  }
  const tube = MeshBuilder.CreateTube("semirrigido_tubo", { path, radius: tubeR, tessellation: 10, cap: Mesh.CAP_ALL }, scene);
  tube.material = material(scene, "semirrigido_tubo", new Color3(0.28, 0.3, 0.32), 0.2);
  tube.parent = root;
  tube.isPickable = false;
  box(scene, root, "semirrigido_consola", [0.07, 0.08, 0.07], [0, 0.075, 0.0], new Color3(0.85, 0.85, 0.85));
  const driver = person(scene, root, "semirrigido_conductor", M, new Color3(0.95, 0.5, 0.1));
  driver.position.set(0, 0.035, -0.09);
  const motor = outboard(scene, root, spec.id, L, 1.1, new Color3(0.08, 0.08, 0.09));
  return {
    root,
    animate(_phase, effort) {
      motor.rotation.x = -0.15 * effort;
    },
  };
}

/** Personal watercraft: sit-on hull, handlebar, rider; jet propelled. */
export function buildMoto(scene: Scene, spec: BoatSpec): BoatModel {
  const root = new TransformNode(spec.id, scene);
  const L = spec.length;
  const W = spec.width;
  loftHull(scene, spec.id, root, {
    length: L,
    halfBeam: planingBeam(W),
    sheer: (s) => 0.04 + 0.025 * Math.max(0, (s - 0.5) / 0.5),
    keel: (s) => -0.02 + 0.025 * Math.max(0, (s - 0.7) / 0.3) ** 2,
    bands: [
      [0.0, new Color3(0.1, 0.1, 0.12)],
      [null, new Color3(0.95, 0.85, 0.1)],
    ],
    deck: new Color3(0.15, 0.15, 0.17),
    bilge: 0.95,
  });
  box(scene, root, "moto_asiento", [W * 0.35, 0.025, L * 0.4], [0, 0.055, -L * 0.1], new Color3(0.08, 0.08, 0.09));
  const bar = box(scene, root, "moto_manubrio", [W * 0.7, 0.006, 0.006], [0, 0.09, L * 0.16], new Color3(0.15, 0.15, 0.15));
  const rider = person(scene, root, "moto_piloto", M, new Color3(0.1, 0.35, 0.8));
  rider.position.set(0, 0.06, -L * 0.04);
  return {
    root,
    animate(_phase, effort) {
      // Rider leans forward at speed
      rider.rotation.x = 0.25 * effort;
      bar.rotation.x = 0;
    },
  };
}
