import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Constants } from "@babylonjs/core/Engines/constants";
import { METERS_PER_UNIT, WATER_LEVEL } from "../utils/constants";
import { froude, KELVIN_TAN, wakeAmplitude, type WakeSource } from "./wakePhysics";
import type { HullType } from "../boat/buoyancy";

/**
 * A boat's wake drawn on the river (ADR 0012): a ribbon along the path the
 * bow actually followed, wide as the Kelvin wedge, whose shader evaluates
 * the same wave physics as wakePhysics.ts at every pixel: transverse and
 * divergent Kelvin waves filtered by the hull (the V narrows for fast
 * boats), the turbulent white wash of the propeller widening slowly and
 * fading into a smooth slick, the bow wave breaking along the sides and,
 * for paddles and oars, the swirls each stroke leaves.
 *
 * The pattern is steady in the boat's frame, as in nature: it moves with
 * the boat, the water itself doesn't flow backwards.
 */
export interface WakeRibbonOptions {
  /** Hull length and beam in metres. */
  length: number;
  beam: number;
  hull: HullType;
  /** Real top speed (m/s) and the wave height at that speed (m). */
  topSpeed: number;
  height: number;
  propulsion: "helice" | "turbina" | "remo" | "pala";
}

const VERTEX = `
precision highp float;
attribute vec3 position;
attribute vec4 wake;   // x behind the bow (m), y to the side (m), speed U (m/s), age (s)
attribute vec4 aux;    // distance along the whole path (m), wave height scale (m), trail tangent x, z
uniform mat4 viewProjection;
varying vec4 vWake;
varying vec4 vAux;
varying vec3 vWorld;
void main(void) {
  vWake = wake;
  vAux = aux;
  vWorld = position;
  gl_Position = viewProjection * vec4(position, 1.0);
}`;

const FRAGMENT = `
precision highp float;
varying vec4 vWake;
varying vec4 vAux;
varying vec3 vWorld;
uniform float uL;
uniform float uBeam;
uniform float uTrail;
uniform float uWash;
uniform float uWashBeam;
uniform float uFoamLife;
uniform float uStroke;
uniform float uSpan;
uniform float uAlternate;
uniform float uBowFoam;
uniform float uPixel;
uniform vec3 uCameraPos;
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uBody;
uniform vec3 uFogColor;
uniform float uFogDensity;

const float G = 9.81;
const float PI = 3.14159265;
const float KT = 0.35355339; // tan(19.47°)

// Same as hullFilter() in wakePhysics.ts
float hullFilter(float k) {
  float u = k * uL / (2.0 * PI);
  float u4 = u * u * u * u;
  float lb = k * uBeam / 4.0;
  return u4 / (u4 + 0.0150) * exp(-lb * lb);
}

// Pixels can't show waves shorter than a few pixels: fade them out (no shimmer)
float resolvable(float k, float footprint) {
  return clamp((2.0 * PI / k) / (4.0 * footprint) - 0.5, 0.0, 1.0);
}

// Same as kelvinElevation() in wakePhysics.ts (without the amplitude)
float kelvin(float x, float y, float U, float footprint) {
  if (x <= 0.0 || U <= 0.05) return 0.0;
  float T = abs(y) / x;
  float k0 = G / (U * U);
  float outside = max(0.0, T - KT);
  float disc = max(0.0, 1.0 - 8.0 * T * T);
  float sq = sqrt(disc);
  float cusp = min(2.2, pow(disc + 0.02, -0.25));
  float e = outside / 0.035;
  float r = length(vec2(x, y));
  float w = cusp * exp(-e * e) * sqrt(uL / max(r, uL));
  float t1 = atan(2.0 * T / (1.0 + sq));
  float t2 = atan(1.0 + sq, 4.0 * T);
  float c1 = cos(t1);
  float c2 = cos(t2);
  float k1 = k0 / max(1e-4, c1 * c1);
  float k2 = k0 / max(1e-4, c2 * c2);
  float h1 = hullFilter(k1) * resolvable(k1, footprint) * cos(k1 * (x * c1 + abs(y) * sin(t1)) + PI * 0.25);
  float h2 = hullFilter(k2) * resolvable(k2, footprint) * cos(k2 * (x * c2 + abs(y) * sin(t2)) - PI * 0.25);
  return (h1 + h2) * w / 1.3;
}

// softLimit() in wakePhysics.ts: a * tanh(a * k / a)
float elev(float a, float k) {
  if (a <= 0.0) return 0.0;
  float t = clamp(k, -6.0, 6.0);
  float e2 = exp(2.0 * t);
  return a * (e2 - 1.0) / (e2 + 1.0);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main(void) {
  float x = vWake.x;
  float y = vWake.y;
  float U = vWake.z;
  float age = vWake.w;
  float s = vAux.x;
  float amp = vAux.y;
  vec2 dir = normalize(vAux.zw + vec2(1e-6));
  vec3 toCam = uCameraPos - vWorld;
  float dist = length(toCam);
  float footprint = max(0.02, dist * uPixel) * ${METERS_PER_UNIT}.0;

  // Waves fade at the end of the ribbon and, slowly, with age
  float fade = (1.0 - smoothstep(uTrail * 0.65, uTrail, x)) * exp(-age / 150.0);
  float a = amp * fade;

  // Kelvin waves and their slope (for lighting)
  float eps = max(0.12, footprint * 0.5);
  float h = elev(a, kelvin(x, y, U, footprint));
  float gx = (elev(a, kelvin(x + eps, y, U, footprint)) - h) / eps; // along x (backwards)
  float gy = (elev(a, kelvin(x, y + eps, U, footprint)) - h) / eps; // along y (to starboard)
  // To world: x points back along the track, y to the right of it
  vec2 back = -dir;
  vec2 right = vec2(dir.y, -dir.x);
  vec2 g = gx * back + gy * right;
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  float slope = length(g);

  // Turbulent wake: white wash behind the stern, widening as age^0.4, then a smooth slick
  float behindStern = smoothstep(uL * 0.8, uL * 1.3, x);
  float wTurb = uWashBeam * (0.55 + 0.45 * pow(age, 0.4));
  float core = 1.0 - smoothstep(wTurb * 0.25, wTurb * 0.5, abs(y));
  // Foam is lumpy at every scale: three octaves, soft edges
  vec2 q = vec2(s, y * 2.2);
  float churn = noise(q * 0.9) * 0.5 + noise(q * 2.3 + 7.1) * 0.3 + noise(q * 5.7 + 3.3) * 0.2;
  float wash = uWash * behindStern * core * smoothstep(0.3, 0.75, churn + 0.3 * exp(-age / 6.0)) * exp(-age / uFoamLife);
  float slick = uWash * behindStern * (1.0 - smoothstep(wTurb * 0.45, wTurb * 0.75, abs(y))) * exp(-age / 120.0);

  // Bow wave breaking along the hull sides at speed (the "bigotes")
  float fr = U / sqrt(G * uL);
  float bowLine = abs(y) - (uBeam * 0.5 + x * 0.42);
  float bow = uBowFoam * smoothstep(0.22, 0.45, fr) * exp(-pow(bowLine / (0.25 + 0.12 * x), 2.0))
    * (1.0 - smoothstep(uL * 0.7, uL * 1.6, x)) * smoothstep(0.35, 0.7, noise(vec2(s * 0.8, y * 2.0)) + 0.3);

  // Crests breaking at the cusps on a big wake
  float whitecap = smoothstep(0.55, 0.9, h / max(0.05, amp)) * smoothstep(0.25, 0.45, amp);

  // Paddles and oars: a swirl where each stroke went in, on one side then the
  // other (kayak) or both at once (rowing), fading as it spreads
  float swirl = 0.0;
  if (uStroke > 0.0) {
    float k = floor(s / uStroke);
    float side = uAlternate > 0.5 ? (mod(k, 2.0) < 1.0 ? 1.0 : -1.0) : sign(y);
    vec2 rel = vec2(s - (k + 0.5) * uStroke, y - side * uSpan);
    float R = 0.3 + 0.22 * sqrt(age);
    float d = length(rel);
    // A dimple with a bright rim, as a paddle leaves
    swirl = (exp(-pow((d - R) / 0.12, 2.0)) + 0.6 * exp(-pow(d / (R * 0.6), 2.0))) * exp(-age / 12.0) * step(0.0, x - uL * 0.3);
  }

  // Light the waves like the river shader does
  vec3 V = toCam / dist;
  vec3 R = reflect(-V, N);
  float fresnel = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.6));
  // Faces tilted towards the camera show the muddy water, away from it the sky
  float facing = dot(normalize(vec2(N.x, N.z) + 1e-5), normalize(vec2(V.x, V.z) + 1e-5)) * length(N.xz) * 6.0;
  vec3 col = mix(uBody * (0.8 + 0.5 * dot(N, normalize(vec3(0.3, 1.0, -0.3))) - 0.25 * clamp(facing, 0.0, 1.0)), sky, clamp(fresnel * 0.9 + 0.35 * clamp(-facing, 0.0, 1.0), 0.0, 1.0));
  float glint = pow(max(dot(N, normalize(uSunDir + V)), 0.0), 220.0) * 1.4;
  col += vec3(1.0, 0.95, 0.82) * glint;
  float alpha = clamp(slope * 11.0, 0.0, 0.9) + glint * 0.5;

  // The slick: smoother, a touch darker than the ruffled river around it
  col = mix(col, uBody * 0.9, slick * 0.35 * (1.0 - alpha));
  alpha = max(alpha, slick * 0.22);

  vec3 foamCol = vec3(0.93, 0.92, 0.88);
  float foam = clamp(wash + bow + whitecap * 0.6, 0.0, 1.0);
  col = mix(col, foamCol, foam);
  alpha = max(alpha, foam * 0.9);
  col = mix(col, mix(uBody * 0.6, uHorizon, 0.35), clamp(swirl, 0.0, 1.0) * 0.7);
  alpha = max(alpha, clamp(swirl, 0.0, 1.0) * 0.55);

  float fog = clamp(exp(-pow(dist * uFogDensity, 2.0)), 0.0, 1.0);
  gl_FragColor = vec4(mix(uFogColor, col, fog), alpha * fade * fog);
}`;

interface TrailPoint {
  /** World position of the bow (units). */
  x: number;
  z: number;
  /** Distance along the whole path (m), real speed (m/s), wave height (m), time (s). */
  s: number;
  U: number;
  amp: number;
  t: number;
}

/** A new trail point every this many metres travelled. */
const STEP = 2;

export class WakeRibbon {
  readonly mesh: Mesh;
  private material: ShaderMaterial;
  private points: TrailPoint[] = [];
  private time = 0;
  private traveled = 0;
  private readonly maxPoints: number;
  private readonly trailLength: number;
  private source: WakeSource;
  private positions: Float32Array;
  private wake: Float32Array;
  private aux: Float32Array;

  constructor(scene: Scene, private o: WakeRibbonOptions) {
    this.source = { U: 0, L: o.length, beam: o.beam, height: o.height, topFroude: froude(o.topSpeed, o.length), hull: o.hull };
    // Long enough to see the pattern spread; short enough to keep it cheap
    this.trailLength = Math.max(110, Math.min(260, o.length * 25));
    this.maxPoints = Math.ceil(this.trailLength / STEP) + 2;
    const n = this.maxPoints + 1;
    this.positions = new Float32Array(n * 2 * 3);
    this.wake = new Float32Array(n * 2 * 4);
    this.aux = new Float32Array(n * 2 * 4);
    const indices: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    this.mesh = new Mesh("estela", scene);
    const data = new VertexData();
    data.positions = this.positions;
    data.indices = indices;
    data.applyToMesh(this.mesh, true);
    this.mesh.setVerticesData("wake", this.wake, true, 4);
    this.mesh.setVerticesData("aux", this.aux, true, 4);
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;

    const m = new ShaderMaterial(
      "estelaMat",
      scene,
      { vertexSource: VERTEX, fragmentSource: FRAGMENT },
      {
        attributes: ["position", "wake", "aux"],
        uniforms: [
          "viewProjection", "uL", "uBeam", "uTrail", "uWash", "uWashBeam", "uFoamLife", "uStroke", "uSpan", "uAlternate", "uBowFoam", "uPixel",
          "uCameraPos", "uSunDir", "uZenith", "uHorizon", "uBody", "uFogColor", "uFogDensity",
        ],
        needAlphaBlending: true,
      }
    );
    m.backFaceCulling = false;
    m.alphaMode = Constants.ALPHA_COMBINE;
    m.disableDepthWrite = true;
    m.setFloat("uL", o.length);
    m.setFloat("uBeam", o.beam);
    m.setFloat("uTrail", this.trailLength);
    const motor = o.propulsion === "helice" || o.propulsion === "turbina";
    m.setFloat("uWash", o.propulsion === "turbina" ? 1.2 : motor ? (o.hull === "planing" ? 1 : 0.75) : 0);
    // A jet throws its wash wider than the hull; small hulls still churn a metre or more
    m.setFloat("uWashBeam", o.propulsion === "turbina" ? Math.max(o.beam, 2.6) : Math.max(o.beam, 1.5));
    // White water lasts longer behind bigger hulls (more air churned in)
    m.setFloat("uFoamLife", 6 + o.length * 1.1);
    m.setFloat("uBowFoam", motor ? (o.hull === "planing" ? 1 : 0.7) : 0.15);
    // Strokes: a kayak paddle every ~2.5 m on alternate sides; oars every ~7 m on both
    m.setFloat("uStroke", o.propulsion === "pala" ? 2.6 : o.propulsion === "remo" ? 7 : 0);
    m.setFloat("uSpan", o.propulsion === "pala" ? 1.3 : 2.4);
    m.setFloat("uAlternate", o.propulsion === "pala" ? 1 : 0);
    m.setVector3("uSunDir", new Vector3(0.5, 1, -0.5).normalize());
    m.setColor3("uZenith", new Color3(0.47, 0.64, 0.82));
    m.setColor3("uHorizon", new Color3(0.8, 0.85, 0.88));
    m.setColor3("uBody", new Color3(0.42, 0.32, 0.2));
    this.material = m;
    this.mesh.material = m;
    this.mesh.setEnabled(false);
  }

  /**
   * Follows the boat. (x, z) is the bow (world units), heading in the game
   * convention, speedRatio the fraction of top speed (negative: reversing,
   * which makes no Kelvin wake from the bow).
   */
  update(dt: number, x: number, z: number, speedRatio: number, level: number): void {
    this.time += dt;
    const U = Math.max(0, speedRatio) * this.o.topSpeed;
    this.source.U = U;
    const amp = wakeAmplitude(this.source);
    const last = this.points[0];
    const moved = last ? Math.hypot(x - last.x, z - last.z) * METERS_PER_UNIT : Infinity;
    if (U > 0.2 && moved >= STEP) {
      this.traveled += Number.isFinite(moved) ? moved : 0;
      this.points.unshift({ x, z, s: this.traveled, U, amp, t: this.time });
      if (this.points.length > this.maxPoints) this.points.pop();
    }
    // Old, calm wakes go away
    while (this.points.length && this.time - this.points[this.points.length - 1].t > 150) this.points.pop();
    if (this.points.length < 2) {
      this.mesh.setEnabled(false);
      return;
    }
    this.mesh.setEnabled(true);
    this.build(x, z, U, amp);
    this.mesh.position.y = level;
    this.setViewUniforms();
  }

  /** Rebuilds the ribbon from the current bow back along the trail. */
  private build(bx: number, bz: number, U: number, amp: number): void {
    const head: TrailPoint = { x: bx, z: bz, s: this.traveled + Math.hypot(bx - this.points[0].x, bz - this.points[0].z) * METERS_PER_UNIT, U, amp, t: this.time };
    const pts = [head, ...this.points];
    const n = this.maxPoints + 1;
    let along = 0;
    const y = WATER_LEVEL + 0.012;
    for (let i = 0; i < n; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      if (i > 0 && i < pts.length) along += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) * METERS_PER_UNIT;
      // Track direction here (towards the bow)
      const a = pts[Math.max(0, Math.min(i, pts.length - 1) - 1)];
      const b = pts[Math.min(pts.length - 1, Math.max(1, i + 1))];
      let dx = a.x - b.x;
      let dz = a.z - b.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      // Wide as the Kelvin wedge plus the hull, the turbulent wake and the bow wave
      const half = (along * KELVIN_TAN * 1.12 + this.o.beam * 1.6 + 2) / METERS_PER_UNIT;
      const rx = dz;
      const rz = -dx;
      // Age as if the boat went at its real speed (the game runs boats much
      // faster than real): the wash then trails as far as in real life
      const age = along / Math.max(1, p.U) + (this.time - p.t) * 0.25;
      for (const side of [-1, 1]) {
        const v = i * 2 + (side > 0 ? 1 : 0);
        this.positions[v * 3] = p.x + rx * half * side;
        this.positions[v * 3 + 1] = y;
        this.positions[v * 3 + 2] = p.z + rz * half * side;
        this.wake.set([along, side * half * METERS_PER_UNIT, p.U, age], v * 4);
        this.aux.set([p.s, p.amp, dx, dz], v * 4);
      }
    }
    this.mesh.updateVerticesData("position", this.positions);
    this.mesh.updateVerticesData("wake", this.wake);
    this.mesh.updateVerticesData("aux", this.aux);
  }

  private setViewUniforms(): void {
    const scene = this.mesh.getScene();
    const camera = scene.activeCamera;
    if (!camera) return;
    const m = this.material;
    m.setVector3("uCameraPos", camera.globalPosition);
    // World size of one pixel per unit of distance (for anti-aliasing)
    const fov = (camera as unknown as { fov?: number }).fov ?? 0.8;
    m.setFloat("uPixel", (2 * Math.tan(fov / 2)) / Math.max(1, scene.getEngine().getRenderHeight()));
    m.setColor3("uFogColor", scene.fogColor);
    m.setFloat("uFogDensity", scene.fogEnabled && scene.fogMode !== 0 ? scene.fogDensity : 0);
  }

  dispose(): void {
    this.mesh.dispose(false, true);
  }
}
