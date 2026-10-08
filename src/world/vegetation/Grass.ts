import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import "@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration";
import "@babylonjs/core/Shaders/ShadersInclude/instancesVertex";
import { mulberry32 } from "./treeGenerator";

/** Grass is drawn as real blades within this radius of the camera. */
const RADIUS = 11;
/** Side of one grass patch (one thin instance). */
const CELL = 0.9;
const BLADES = 64;

const VERTEX = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
// Root of the blade this vertex belongs to (patch-local x, z)
attribute vec2 uv2;
#include<instancesDeclaration>
uniform mat4 viewProjection;
uniform float uTime;
uniform vec3 uCameraPos;
uniform float uRadius;
uniform float uWorldSize;
uniform sampler2D shoreDistance;
uniform float uShoreRange;
varying vec2 vUV;
varying float vDist;
void main(void) {
  #include<instancesVertex>
  vec4 wp = finalWorld * vec4(position, 1.0);
  // Blades rooted on (or right at) the water are collapsed: grass stops at the bank
  vec4 root = finalWorld * vec4(uv2.x, 0.0, uv2.y, 1.0);
  float toShore = (texture2D(shoreDistance, root.xz / uWorldSize + 0.5).r - 0.5) * 2.0 * uShoreRange;
  // 0.5 units (~4 m): bilinear distance errs up to half a texel at bank corners
  if (toShore < 0.5) wp = root;
  // Blades shrink into the ground towards the edge of the grass radius
  float base = finalWorld[3].y;
  float fade = 1.0 - smoothstep(uRadius * 0.65, uRadius, distance(wp.xz, uCameraPos.xz));
  wp.y = base + (wp.y - base) * fade;
  // Wind: slow gusts rolling across the field plus a quick flutter, tips move most
  float w = uv.y * uv.y;
  float gust = sin(uTime * 1.6 + wp.x * 1.0 + wp.z * 0.6) * 0.5 + 0.5;
  wp.x += (gust * 0.05 + sin(uTime * 4.0 + wp.z * 5.0) * 0.01) * w;
  wp.z += (gust * 0.025 + cos(uTime * 3.3 + wp.x * 4.0) * 0.01) * w;
  gl_Position = viewProjection * wp;
  vUV = uv;
  vDist = distance(wp.xyz, uCameraPos);
}
`;

const FRAGMENT = `
precision highp float;
varying vec2 vUV;
varying float vDist;
uniform vec3 uFogColor;
uniform float uFogDensity;
void main(void) {
  // Dark at the root, sunlit yellow-green at the tip; each blade a bit different
  vec3 root = vec3(0.1, 0.22, 0.05);
  vec3 tip = mix(vec3(0.42, 0.62, 0.2), vec3(0.62, 0.68, 0.3), vUV.x);
  vec3 color = mix(root, tip, smoothstep(0.0, 1.0, vUV.y));
  float fog = clamp(exp(-pow(vDist * uFogDensity, 2.0)), 0.0, 1.0);
  gl_FragColor = vec4(mix(uFogColor, color, fog), 1.0);
}
`;

/**
 * Blades of grass around the camera: one patch mesh of a few dozen curved
 * blades, thin-instanced over the land cells near the camera and swaying
 * in the wind. Further away the ground texture takes over.
 */
export class Grass {
  private mesh: Mesh;
  private material: ShaderMaterial;
  private time = 0;
  private lastCell = { i: Infinity, j: Infinity };

  constructor(
    private scene: Scene,
    /** Where grass may grow (dry land, not under docks or houses). */
    private plantable: (x: number, z: number) => boolean,
    private groundY: number,
    /** Signed distance to the shore (see WaterSystem.createShoreDistanceTexture). */
    shoreDistance: BaseTexture,
    shoreRange: number,
    worldSize: number
  ) {
    this.mesh = new Mesh("pasto", scene);
    buildPatch().applyToMesh(this.mesh);
    this.material = new ShaderMaterial(
      "pastoMat",
      scene,
      { vertexSource: VERTEX, fragmentSource: FRAGMENT },
      {
        attributes: ["position", "uv", "uv2"],
        uniforms: ["world", "viewProjection", "uTime", "uCameraPos", "uRadius", "uWorldSize", "uShoreRange", "uFogColor", "uFogDensity"],
        samplers: ["shoreDistance"],
      }
    );
    this.material.setTexture("shoreDistance", shoreDistance);
    this.material.setFloat("uShoreRange", shoreRange);
    this.material.setFloat("uWorldSize", worldSize);
    this.material.backFaceCulling = false;
    this.material.setFloat("uRadius", RADIUS);
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.thinInstanceSetBuffer("matrix", new Float32Array(16), 16, false);
    this.mesh.setEnabled(false);
  }

  update(dt: number, camera: Vector3): void {
    this.time += dt;
    const m = this.material;
    m.setFloat("uTime", this.time);
    m.setVector3("uCameraPos", camera);
    m.setColor3("uFogColor", this.scene.fogColor);
    m.setFloat("uFogDensity", this.scene.fogEnabled ? this.scene.fogDensity : 0);

    const ci = Math.floor(camera.x / CELL);
    const cj = Math.floor(camera.z / CELL);
    if (Math.abs(ci - this.lastCell.i) < 2 && Math.abs(cj - this.lastCell.j) < 2) return;
    this.lastCell = { i: ci, j: cj };
    this.replant(ci, cj, camera);
  }

  private replant(ci: number, cj: number, camera: Vector3): void {
    const span = Math.ceil(RADIUS / CELL);
    const out: number[] = [];
    const m = new Matrix();
    const s = new Vector3();
    const p = new Vector3();
    for (let i = ci - span; i <= ci + span; i++) {
      for (let j = cj - span; j <= cj + span; j++) {
        // Stable per-cell jitter, rotation and size: patches don't change as you move
        const h = hash(i, j);
        const x = (i + 0.5 + (h - 0.5) * 0.4) * CELL;
        const z = (j + 0.5 + (hash(j, i) - 0.5) * 0.4) * CELL;
        if ((x - camera.x) ** 2 + (z - camera.z) ** 2 > RADIUS * RADIUS) continue;
        if (!this.plantable(x, z)) continue;
        s.setAll(0.8 + h * 0.45);
        p.set(x, this.groundY, z);
        Matrix.ComposeToRef(s, Quaternion.RotationAxis(Vector3.Up(), h * Math.PI * 2), p, m);
        m.toArray(out, out.length);
      }
    }
    this.mesh.setEnabled(out.length > 0);
    if (out.length > 0) this.mesh.thinInstanceSetBuffer("matrix", new Float32Array(out), 16, false);
  }
}

function hash(i: number, j: number): number {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/** A patch of curved, tapered blades filling one cell (a little beyond, so patches mesh together). */
function buildPatch(): VertexData {
  const rng = mulberry32(42);
  const positions: number[] = [];
  const uvs: number[] = [];
  const roots: number[] = [];
  const indices: number[] = [];
  for (let b = 0; b < BLADES; b++) {
    const x = (rng() - 0.5) * CELL * 1.1;
    const z = (rng() - 0.5) * CELL * 1.1;
    // ~0.5-1 m tall at the world's 8 m per unit: taller than a lawn so it reads at boat scale
    const h = 0.06 + rng() * 0.08;
    const w = 0.01 + rng() * 0.006;
    const yaw = rng() * Math.PI * 2;
    const ax = Math.cos(yaw);
    const az = Math.sin(yaw);
    // Blades arch over to one side
    const lean = 0.02 + rng() * 0.05;
    const lx = -az * lean;
    const lz = ax * lean;
    const tone = rng();
    const base = positions.length / 3;
    const rows: Array<[number, number]> = [[0, 1], [0.55, 0.6], [1, 0]];
    for (const [t, width] of rows) {
      const cx = x + lx * t * t;
      const cz = z + lz * t * t;
      const y = h * t;
      if (width > 0) {
        positions.push(cx - ax * w * width, y, cz - az * w * width, cx + ax * w * width, y, cz + az * w * width);
        uvs.push(tone, t, tone, t);
      } else {
        positions.push(cx, y, cz);
        uvs.push(tone, t);
      }
    }
    for (let v = 0; v < 5; v++) roots.push(x, z);
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const data = new VertexData();
  data.positions = positions;
  data.uvs = uvs;
  data.uvs2 = roots;
  data.indices = indices;
  return data;
}
