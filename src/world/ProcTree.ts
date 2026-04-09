/**
 * proctree.js — Procedural tree mesh generator
 * Original: https://github.com/supereggbert/proctree.js
 * Copyright (c) 2012 Paul Brunt — BSD 2-Clause License
 *
 * Ported to TypeScript ES6 module for BabylonJS integration.
 * Generates realistic branching tree geometry with trunk + twig meshes.
 * No dependencies — outputs raw vertex/face/normal/UV arrays.
 */

type Vec3 = [number, number, number];

// --- Vector math utilities ---
function dot(v1: Vec3, v2: Vec3): number {
  return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}
function cross(v1: Vec3, v2: Vec3): Vec3 {
  return [v1[1] * v2[2] - v1[2] * v2[1], v1[2] * v2[0] - v1[0] * v2[2], v1[0] * v2[1] - v1[1] * v2[0]];
}
function vecLength(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}
function normalize(v: Vec3): Vec3 {
  const l = vecLength(v);
  return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
}
function scaleVec(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}
function subVec(v1: Vec3, v2: Vec3): Vec3 {
  return [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]];
}
function addVec(v1: Vec3, v2: Vec3): Vec3 {
  return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
}
function vecAxisAngle(vec: Vec3, axis: Vec3, angle: number): Vec3 {
  const cosr = Math.cos(angle);
  const sinr = Math.sin(angle);
  return addVec(addVec(scaleVec(vec, cosr), scaleVec(cross(axis, vec), sinr)), scaleVec(axis, dot(axis, vec) * (1 - cosr)));
}
function scaleInDirection(vector: Vec3, direction: Vec3, scale: number): Vec3 {
  const currentMag = dot(vector, direction);
  const change = scaleVec(direction, currentMag * scale - currentMag);
  return addVec(vector, change);
}

// --- Branch ---
class Branch {
  child0: Branch | null = null;
  child1: Branch | null = null;
  parent: Branch | null;
  head: Vec3;
  length = 1;
  type = "";
  root: number[] = [];
  ring0: number[] = [];
  ring1: number[] = [];
  ring2: number[] = [];
  tangent: Vec3 = [0, 0, 0];
  radius = 0;
  end = 0;

  constructor(head: Vec3, parent?: Branch) {
    this.head = head;
    this.parent = parent || null;
  }

  mirrorBranch(vec: Vec3, norm: Vec3, properties: TreeProperties): Vec3 {
    const v = cross(norm, cross(vec, norm));
    const s = properties.branchFactor * dot(v, vec);
    return [vec[0] - v[0] * s, vec[1] - v[1] * s, vec[2] - v[2] * s];
  }

  split(level?: number, steps?: number, properties?: TreeProperties, l1 = 1, l2 = 1): void {
    if (!properties) return;
    if (level === undefined) level = properties.levels;
    if (steps === undefined) steps = properties.treeSteps;
    const rLevel = properties.levels - level;
    const po: Vec3 = this.parent ? this.parent.head : [0, 0, 0];
    if (!this.parent) this.type = "trunk";
    const so = this.head;
    const dir = normalize(subVec(so, po));
    const normal = cross(dir, [dir[2], dir[0], dir[1]]);
    const tangent = cross(dir, normal);
    const r = properties.random(rLevel * 10 + l1 * 5 + l2 + properties.seed);
    const clumpmax = properties.clumpMax;
    const clumpmin = properties.clumpMin;
    let adj = addVec(scaleVec(normal, r), scaleVec(tangent, 1 - r));
    if (r > 0.5) adj = scaleVec(adj, -1);
    const clump = (clumpmax - clumpmin) * r + clumpmin;
    let newdir = normalize(addVec(scaleVec(adj, 1 - clump), scaleVec(dir, clump)));
    let newdir2 = this.mirrorBranch(newdir, dir, properties);
    if (r > 0.5) { const tmp = newdir; newdir = newdir2; newdir2 = tmp; }
    if (steps > 0) {
      const angle = steps / properties.treeSteps * 2 * Math.PI * properties.twistRate;
      newdir2 = normalize([Math.sin(angle), r, Math.cos(angle)]);
    }
    const growAmount = level * level / (properties.levels * properties.levels) * properties.growAmount;
    const dropAmount = rLevel * properties.dropAmount;
    const sweepAmount = rLevel * properties.sweepAmount;
    newdir = normalize(addVec(newdir, [sweepAmount, dropAmount + growAmount, 0]));
    newdir2 = normalize(addVec(newdir2, [sweepAmount, dropAmount + growAmount, 0]));
    const head0 = addVec(so, scaleVec(newdir, this.length));
    const head1 = addVec(so, scaleVec(newdir2, this.length));
    this.child0 = new Branch(head0, this);
    this.child1 = new Branch(head1, this);
    this.child0.length = Math.pow(this.length, properties.lengthFalloffPower) * properties.lengthFalloffFactor;
    this.child1.length = Math.pow(this.length, properties.lengthFalloffPower) * properties.lengthFalloffFactor;
    if (level > 0) {
      if (steps > 0) {
        this.child0.head = addVec(this.head, [(r - 0.5) * 2 * properties.trunkKink, properties.climbRate, (r - 0.5) * 2 * properties.trunkKink]);
        this.child0.type = "trunk";
        this.child0.length = this.length * properties.taperRate;
        this.child0.split(level, steps - 1, properties, l1 + 1, l2);
      } else {
        this.child0.split(level - 1, 0, properties, l1 + 1, l2);
      }
      this.child1.split(level - 1, 0, properties, l1, l2 + 1);
    }
  }
}

// --- Tree properties ---
export interface TreeProperties {
  clumpMax: number; clumpMin: number;
  lengthFalloffFactor: number; lengthFalloffPower: number;
  branchFactor: number; radiusFalloffRate: number;
  climbRate: number; trunkKink: number;
  maxRadius: number; treeSteps: number;
  taperRate: number; twistRate: number;
  segments: number; levels: number;
  sweepAmount: number; initalBranchLength: number;
  trunkLength: number; dropAmount: number;
  growAmount: number; vMultiplier: number;
  twigScale: number; seed: number;
  rseed: number;
  random: (a?: number) => number;
}

const defaultProperties: TreeProperties = {
  clumpMax: 0.8, clumpMin: 0.5,
  lengthFalloffFactor: 0.85, lengthFalloffPower: 1,
  branchFactor: 2.0, radiusFalloffRate: 0.6,
  climbRate: 1.5, trunkKink: 0.0,
  maxRadius: 0.25, treeSteps: 2,
  taperRate: 0.95, twistRate: 13,
  segments: 6, levels: 3,
  sweepAmount: 0, initalBranchLength: 0.85,
  trunkLength: 2.5, dropAmount: 0.0,
  growAmount: 0.0, vMultiplier: 0.2,
  twigScale: 2.0, seed: 10, rseed: 10,
  random(a?: number) {
    if (a === undefined) a = this.rseed++;
    return Math.abs(Math.cos(a + a * a));
  }
};

// --- Tree presets for Delta de Tigre ---
export const TREE_PRESETS = {
  /** Sauce llorón — drooping branches, wide canopy */
  willow: {
    seed: 262, levels: 3, treeSteps: 2,
    trunkLength: 2.5, initalBranchLength: 0.65,
    lengthFalloffFactor: 0.73, lengthFalloffPower: 0.7,
    clumpMax: 0.55, clumpMin: 0.3,
    branchFactor: 3.2, radiusFalloffRate: 0.75,
    maxRadius: 0.17, taperRate: 0.9,
    dropAmount: 0.2, growAmount: -0.15,
    twistRate: 5, segments: 6,
    twigScale: 1.2, sweepAmount: 0.01,
  },
  /** Álamo — tall columnar shape */
  poplar: {
    seed: 44, levels: 3, treeSteps: 3,
    trunkLength: 4.0, initalBranchLength: 0.5,
    lengthFalloffFactor: 0.8, lengthFalloffPower: 1,
    clumpMax: 0.9, clumpMin: 0.8,
    branchFactor: 2.5, radiusFalloffRate: 0.7,
    maxRadius: 0.12, taperRate: 0.95,
    dropAmount: -0.1, growAmount: 0.4,
    twistRate: 8, segments: 6,
    twigScale: 0.8, sweepAmount: 0.0,
  },
  /** Eucalipto / regular — medium spread */
  regular: {
    seed: 152, levels: 3, treeSteps: 2,
    trunkLength: 2.5, initalBranchLength: 0.75,
    lengthFalloffFactor: 0.85, lengthFalloffPower: 1,
    clumpMax: 0.65, clumpMin: 0.4,
    branchFactor: 2.8, radiusFalloffRate: 0.65,
    maxRadius: 0.2, taperRate: 0.93,
    dropAmount: 0.05, growAmount: 0.1,
    twistRate: 10, segments: 6,
    twigScale: 1.5, sweepAmount: 0.0,
  },
};

// --- Main Tree class ---
export class ProcTree {
  properties: TreeProperties;
  root: Branch;
  verts: Vec3[] = [];
  faces: Vec3[] = [];
  normals: Vec3[] = [];
  UV: [number, number][] = [];
  vertsTwig: Vec3[] = [];
  normalsTwig: Vec3[] = [];
  facesTwig: Vec3[] = [];
  uvsTwig: [number, number][] = [];

  constructor(data?: Partial<TreeProperties>) {
    this.properties = { ...defaultProperties };
    if (data) {
      for (const k in data) {
        if ((this.properties as any)[k] !== undefined) {
          (this.properties as any)[k] = (data as any)[k];
        }
      }
    }
    this.properties.rseed = this.properties.seed;
    this.root = new Branch([0, this.properties.trunkLength, 0]);
    this.root.length = this.properties.initalBranchLength;
    this.root.split(undefined, undefined, this.properties);
    this.createForks();
    this.createTwigs();
    this.doFaces();
    this.calcNormals();
  }

  /** Flatten array of [x,y,z] to [x,y,z,x,y,z,...] */
  static flatten(input: (Vec3 | [number, number])[]): number[] {
    const ret: number[] = [];
    for (const v of input) for (const n of v) ret.push(n);
    return ret;
  }

  private calcNormals(): void {
    const { normals, faces, verts } = this;
    const allNormals: Vec3[][] = verts.map(() => []);
    for (const face of faces) {
      const norm = normalize(cross(subVec(verts[face[1]], verts[face[2]]), subVec(verts[face[1]], verts[face[0]])));
      allNormals[face[0]].push(norm);
      allNormals[face[1]].push(norm);
      allNormals[face[2]].push(norm);
    }
    for (let i = 0; i < allNormals.length; i++) {
      let total: Vec3 = [0, 0, 0];
      const l = allNormals[i].length;
      for (const n of allNormals[i]) total = addVec(total, scaleVec(n, 1 / l));
      normals[i] = total;
    }
  }

  private doFaces(branch?: Branch): void {
    if (!branch) branch = this.root;
    const segments = this.properties.segments;
    const { faces, verts, UV } = this;

    if (!branch.parent) {
      for (let i = 0; i < verts.length; i++) UV[i] = [0, 0];
      const tangent = normalize(cross(subVec(branch.child0!.head, branch.head), subVec(branch.child1!.head, branch.head)));
      const normal = normalize(branch.head);
      let angle = Math.acos(dot(tangent, [-1, 0, 0]));
      if (dot(cross([-1, 0, 0], tangent), normal) > 0) angle = 2 * Math.PI - angle;
      const segOff = Math.round(angle / Math.PI / 2 * segments);
      for (let i = 0; i < segments; i++) {
        const v1 = branch.ring0[i], v2 = branch.root[(i + segOff + 1) % segments];
        const v3 = branch.root[(i + segOff) % segments], v4 = branch.ring0[(i + 1) % segments];
        faces.push([v1, v4, v3]); faces.push([v4, v2, v3]);
        UV[(i + segOff) % segments] = [Math.abs(i / segments - 0.5) * 2, 0];
        const len = vecLength(subVec(verts[branch.ring0[i]], verts[branch.root[(i + segOff) % segments]])) * this.properties.vMultiplier;
        UV[branch.ring0[i]] = [Math.abs(i / segments - 0.5) * 2, len];
        UV[branch.ring2[i]] = [Math.abs(i / segments - 0.5) * 2, len];
      }
    }

    if (branch.child0!.ring0.length > 0) {
      let segOff0: number | undefined, segOff1: number | undefined;
      let match0 = -Infinity, match1 = -Infinity;
      let v1d = normalize(subVec(verts[branch.ring1[0]], branch.head));
      let v2d = normalize(subVec(verts[branch.ring2[0]], branch.head));
      v1d = scaleInDirection(v1d, normalize(subVec(branch.child0!.head, branch.head)), 0);
      v2d = scaleInDirection(v2d, normalize(subVec(branch.child1!.head, branch.head)), 0);
      for (let i = 0; i < segments; i++) {
        let d = normalize(subVec(verts[branch.child0!.ring0[i]], branch.child0!.head));
        let l = dot(d, v1d);
        if (segOff0 === undefined || l > match0) { match0 = l; segOff0 = segments - i; }
        d = normalize(subVec(verts[branch.child1!.ring0[i]], branch.child1!.head));
        l = dot(d, v2d);
        if (segOff1 === undefined || l > match1) { match1 = l; segOff1 = segments - i; }
      }
      const UVScale = this.properties.maxRadius / branch.radius;
      for (let i = 0; i < segments; i++) {
        let v1 = branch.child0!.ring0[i], v2 = branch.ring1[(i + segOff0! + 1) % segments];
        let v3 = branch.ring1[(i + segOff0!) % segments], v4 = branch.child0!.ring0[(i + 1) % segments];
        faces.push([v1, v4, v3]); faces.push([v4, v2, v3]);
        v1 = branch.child1!.ring0[i]; v2 = branch.ring2[(i + segOff1! + 1) % segments];
        v3 = branch.ring2[(i + segOff1!) % segments]; v4 = branch.child1!.ring0[(i + 1) % segments];
        faces.push([v1, v2, v3]); faces.push([v1, v4, v2]);
        const len1 = vecLength(subVec(verts[branch.child0!.ring0[i]], verts[branch.ring1[(i + segOff0!) % segments]])) * UVScale;
        const uv1 = UV[branch.ring1[(i + segOff0! - 1 + segments) % segments]];
        UV[branch.child0!.ring0[i]] = [uv1[0], uv1[1] + len1 * this.properties.vMultiplier];
        UV[branch.child0!.ring2[i]] = [uv1[0], uv1[1] + len1 * this.properties.vMultiplier];
        const len2 = vecLength(subVec(verts[branch.child1!.ring0[i]], verts[branch.ring2[(i + segOff1!) % segments]])) * UVScale;
        const uv2 = UV[branch.ring2[(i + segOff1! - 1 + segments) % segments]];
        UV[branch.child1!.ring0[i]] = [uv2[0], uv2[1] + len2 * this.properties.vMultiplier];
        UV[branch.child1!.ring2[i]] = [uv2[0], uv2[1] + len2 * this.properties.vMultiplier];
      }
      this.doFaces(branch.child0!);
      this.doFaces(branch.child1!);
    } else {
      for (let i = 0; i < segments; i++) {
        faces.push([branch.child0!.end, branch.ring1[(i + 1) % segments], branch.ring1[i]]);
        faces.push([branch.child1!.end, branch.ring2[(i + 1) % segments], branch.ring2[i]]);
        const len1 = vecLength(subVec(verts[branch.child0!.end], verts[branch.ring1[i]]));
        UV[branch.child0!.end] = [Math.abs(i / segments - 1 - 0.5) * 2, len1 * this.properties.vMultiplier];
        const len2 = vecLength(subVec(verts[branch.child1!.end], verts[branch.ring2[i]]));
        UV[branch.child1!.end] = [Math.abs(i / segments - 0.5) * 2, len2 * this.properties.vMultiplier];
      }
    }
  }

  private createTwigs(branch?: Branch): void {
    if (!branch) branch = this.root;
    const { vertsTwig, normalsTwig, facesTwig, uvsTwig } = this;
    if (!branch.child0) {
      const tangent = normalize(cross(subVec(branch.parent!.child0!.head, branch.parent!.head), subVec(branch.parent!.child1!.head, branch.parent!.head)));
      const binormal = normalize(subVec(branch.head, branch.parent!.head));
      const normal = cross(tangent, binormal);
      const s = this.properties.twigScale;
      const v1 = vertsTwig.length;
      vertsTwig.push(addVec(addVec(branch.head, scaleVec(tangent, s)), scaleVec(binormal, s * 2 - branch.length)));
      const v2 = vertsTwig.length;
      vertsTwig.push(addVec(addVec(branch.head, scaleVec(tangent, -s)), scaleVec(binormal, s * 2 - branch.length)));
      const v3 = vertsTwig.length;
      vertsTwig.push(addVec(addVec(branch.head, scaleVec(tangent, -s)), scaleVec(binormal, -branch.length)));
      const v4 = vertsTwig.length;
      vertsTwig.push(addVec(addVec(branch.head, scaleVec(tangent, s)), scaleVec(binormal, -branch.length)));
      const v8 = vertsTwig.length;
      vertsTwig.push(addVec(addVec(branch.head, scaleVec(tangent, s)), scaleVec(binormal, s * 2 - branch.length)));
      const v7 = vertsTwig.length;
      vertsTwig.push(addVec(addVec(branch.head, scaleVec(tangent, -s)), scaleVec(binormal, s * 2 - branch.length)));
      const v6 = vertsTwig.length;
      vertsTwig.push(addVec(addVec(branch.head, scaleVec(tangent, -s)), scaleVec(binormal, -branch.length)));
      const v5 = vertsTwig.length;
      vertsTwig.push(addVec(addVec(branch.head, scaleVec(tangent, s)), scaleVec(binormal, -branch.length)));
      facesTwig.push([v1, v2, v3]); facesTwig.push([v4, v1, v3]);
      facesTwig.push([v6, v7, v8]); facesTwig.push([v6, v8, v5]);
      const n1 = normalize(cross(subVec(vertsTwig[v1], vertsTwig[v3]), subVec(vertsTwig[v2], vertsTwig[v3])));
      const n2 = normalize(cross(subVec(vertsTwig[v7], vertsTwig[v6]), subVec(vertsTwig[v8], vertsTwig[v6])));
      for (let i = 0; i < 4; i++) normalsTwig.push(n1);
      for (let i = 0; i < 4; i++) normalsTwig.push(n2);
      uvsTwig.push([0, 1], [1, 1], [1, 0], [0, 0]);
      uvsTwig.push([0, 1], [1, 1], [1, 0], [0, 0]);
    } else {
      this.createTwigs(branch.child0!);
      this.createTwigs(branch.child1!);
    }
  }

  private createForks(branch?: Branch, radius?: number): void {
    if (!branch) branch = this.root;
    if (!radius) radius = this.properties.maxRadius;
    branch.radius = radius;
    if (radius > branch.length) radius = branch.length;
    const { verts } = this;
    const segments = this.properties.segments;
    const segmentAngle = Math.PI * 2 / segments;

    if (!branch.parent) {
      branch.root = [];
      const axis: Vec3 = [0, 1, 0];
      for (let i = 0; i < segments; i++) {
        const vec = vecAxisAngle([-1, 0, 0], axis, -segmentAngle * i);
        branch.root.push(verts.length);
        verts.push(scaleVec(vec, radius / this.properties.radiusFalloffRate));
      }
    }

    if (branch.child0) {
      const axis = branch.parent ? normalize(subVec(branch.head, branch.parent.head)) : normalize(branch.head);
      const axis1 = normalize(subVec(branch.head, branch.child0.head));
      const axis2 = normalize(subVec(branch.head, branch.child1!.head));
      const tangent = normalize(cross(axis1, axis2));
      branch.tangent = tangent;
      const axis3 = normalize(cross(tangent, normalize(addVec(scaleVec(axis1, -1), scaleVec(axis2, -1)))));
      const dir: Vec3 = [axis2[0], 0, axis2[2]];
      const centerloc = addVec(branch.head, scaleVec(dir, -this.properties.maxRadius / 2));
      const ring0: number[] = branch.ring0 = [];
      const ring1: number[] = branch.ring1 = [];
      const ring2: number[] = branch.ring2 = [];
      let scale = this.properties.radiusFalloffRate;
      if (branch.child0.type === "trunk" || branch.type === "trunk") scale = 1 / this.properties.taperRate;

      const linch0 = verts.length;
      ring0.push(linch0); ring2.push(linch0);
      verts.push(addVec(centerloc, scaleVec(tangent, radius * scale)));
      const start = verts.length - 1;
      const d1 = vecAxisAngle(tangent, axis2, 1.57);
      const d2 = normalize(cross(tangent, axis));
      const s = 1 / dot(d1, d2);
      for (let i = 1; i < (segments >> 1); i++) {
        let vec = vecAxisAngle(tangent, axis2, segmentAngle * i);
        ring0.push(start + i); ring2.push(start + i);
        vec = scaleInDirection(vec, d2, s);
        verts.push(addVec(centerloc, scaleVec(vec, radius * scale)));
      }
      const linch1 = verts.length;
      ring0.push(linch1); ring1.push(linch1);
      verts.push(addVec(centerloc, scaleVec(tangent, -radius * scale)));
      for (let i = (segments >> 1) + 1; i < segments; i++) {
        const vec = vecAxisAngle(tangent, axis1, segmentAngle * i);
        ring0.push(verts.length); ring1.push(verts.length);
        verts.push(addVec(centerloc, scaleVec(vec, radius * scale)));
      }
      ring1.push(linch0); ring2.push(linch1);
      const start2 = verts.length - 1;
      for (let i = 1; i < (segments >> 1); i++) {
        const vec = vecAxisAngle(tangent, axis3, segmentAngle * i);
        ring1.push(start2 + i); ring2.push(start2 + ((segments >> 1) - i));
        verts.push(addVec(centerloc, scaleVec(vec, radius * scale)));
      }

      let radius0 = radius * this.properties.radiusFalloffRate;
      const radius1 = radius * this.properties.radiusFalloffRate;
      if (branch.child0.type === "trunk") radius0 = radius * this.properties.taperRate;
      this.createForks(branch.child0, radius0);
      this.createForks(branch.child1!, radius1);
    } else {
      branch.end = verts.length;
      verts.push(branch.head);
    }
  }
}
