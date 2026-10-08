import { Scene } from "@babylonjs/core/scene";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";

/**
 * Water of the Paraná Delta: opaque, muddy "café con leche" water whose look
 * comes from the sky sheen on the ripples, sun glints, the dark reflection of
 * the trees along the banks and a lapping foam line at the shore.
 *
 * Unlike Babylon's WaterMaterial it needs no reflection/refraction render
 * passes (two extra scene renders per frame): the sky is evaluated
 * analytically and the shore comes from a precomputed distance texture.
 */
const VERTEX = `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vWorld;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = viewProjection * w;
}
`;

const FRAGMENT = `
precision highp float;
varying vec3 vWorld;
uniform float uTime;
uniform float uWorldSize;
uniform float uShoreRange;
uniform float uFogDensity;
uniform vec3 uCameraPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uBank;
uniform vec3 uFoam;
uniform vec3 uFogColor;
/** Wind direction (xz) and strength 0..1 in z. */
uniform vec3 uWind;
/** How far the river's current has carried the surface (world units). */
uniform vec2 uDrift;
uniform sampler2D normalMap;
uniform sampler2D shoreMap;

vec2 slopeAt(vec2 uv) {
  return texture2D(normalMap, uv).xy * 2.0 - 1.0;
}

void main(void) {
  vec2 p = vWorld.xz;
  // Distance to the nearest bank, in world units
  float shore = texture2D(shoreMap, p / uWorldSize + 0.5).r * uShoreRange;

  // Three ripple layers: carried by the current, pushed by the wind
  vec2 flow = uWind.xy;
  vec2 q = p - uDrift;
  // Ripple scales are relative to the boat (2 units long at 8 m per unit)
  vec2 s1 = slopeAt(q * 0.2 + flow * uTime * (0.02 + 0.05 * uWind.z));
  vec2 s2 = slopeAt(q * 0.55 - flow.yx * uTime * 0.05);
  vec2 s3 = slopeAt(q * 1.4 + vec2(-flow.x, flow.y) * uTime * 0.08);
  vec2 slope = s1 * 0.5 + s2 * 0.35 + s3 * 0.3;
  // Choppier with the wind (a sudestada whips the river up)
  // Choppier with the wind, glassy near the banks of narrow arroyos
  float rough = (0.45 + 1.1 * uWind.z) * mix(0.45, 1.0, smoothstep(2.0, 12.0, shore));
  vec3 N = normalize(vec3(slope.x * rough, 1.0, slope.y * rough));

  vec3 toCam = uCameraPos - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float NdV = max(dot(N, V), 0.0);
  float fresnel = 0.03 + 0.97 * pow(1.0 - NdV, 5.0);

  // Sky reflected by the ripples
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.6));

  // The trees and houses on the bank mirrored in the water (photos of the
  // Delta: calm arroyos are mirrors). Where does the reflected ray reach the
  // bank, and is it still below the treetops there? The bank is found from
  // the shore distance and its gradient; no second render.
  float e = 2.0 / uWorldSize;
  vec2 uvS = p / uWorldSize + 0.5;
  vec2 grad = vec2(
    texture2D(shoreMap, uvS + vec2(e, 0.0)).r - texture2D(shoreMap, uvS - vec2(e, 0.0)).r,
    texture2D(shoreMap, uvS + vec2(0.0, e)).r - texture2D(shoreMap, uvS - vec2(0.0, e)).r
  );
  vec2 toBank = -normalize(grad + vec2(1e-5));
  // The ripples only make the mirror image tremble: use a gently rippled surface for it
  vec3 Nm = normalize(vec3(N.x * 0.18, 1.0, N.z * 0.18));
  vec3 Rm = reflect(-V, Nm);
  vec2 rh = normalize(Rm.xz + vec2(1e-5));
  float facing = dot(rh, toBank);
  float dBank = shore / max(facing, 0.12);
  float rise = Rm.y / max(length(Rm.xz), 1e-3) * dBank;
  // Canopy height along the bank: casuarinas and poplars, gaps, lower willows (world units, 8 m)
  vec2 along = p + rh * dBank;
  float canopy = 1.2 + 2.2 * smoothstep(0.25, 0.8, fract(sin(dot(floor(along * 0.35), vec2(12.9898, 78.233))) * 43758.5453) * 0.6 + 0.4 * sin(along.x * 0.7 + along.y * 0.5));
  float mirror = (1.0 - smoothstep(canopy * 0.85, canopy, rise)) * step(0.0, facing) * (1.0 - smoothstep(10.0, 15.0, shore));
  // Dark green foliage, darker trunks low down, a lighter sky gap between tufts
  float tuft = 0.55 + 0.45 * sin(along.x * 3.1 + rise * 2.3) * sin(along.y * 2.7 - rise * 1.7);
  // Lit foliage as the trees look on the bank, darker low down (trunks, shade)
  vec3 trees = mix(vec3(0.11, 0.14, 0.07), vec3(0.3, 0.4, 0.17), tuft * smoothstep(0.0, canopy, rise) * 0.8 + 0.2);
  // The mirror's strength follows the calm surface, not every ripple
  float fresnelM = 0.03 + 0.97 * pow(1.0 - max(dot(Nm, V), 0.0), 5.0);

  // Sediment-laden body color: lighter and yellower in the shallows by the bank
  vec3 body = mix(uShallow, uDeep, smoothstep(0.2, 3.0, shore));
  body *= 0.93 + 0.14 * slope.x;

  vec3 color = mix(body, sky, clamp(fresnel * 0.85, 0.0, 1.0));
  // Against the dark, opaque brown water the mirror image shows even looking down
  color = mix(color, trees, mirror * clamp(0.3 + fresnelM, 0.0, 0.88));

  // Sun: tight glints that sparkle on the ripples plus a soft sheen. Far
  // away the ripples are smaller than a pixel, so glints would only alias
  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(N, H), 0.0);
  float near = 1.0 - smoothstep(25.0, 80.0, dist);
  color += uSunColor * (pow(nh, 500.0) * 1.8 * near + pow(nh, 80.0) * 0.05);

  // Water lapping the bank: a thin, moving line of foam
  float lap = 0.5 + 0.5 * sin(uTime * 1.4 + p.x * 1.2 + p.y * 0.9);
  float foam = 1.0 - smoothstep(0.0, 0.2 + lap * 0.15, shore + slope.y * 0.15);
  color = mix(color, uFoam, foam * 0.35);

  // Same EXP2 fog as the rest of the scene
  float fog = clamp(exp(-pow(dist * uFogDensity, 2.0)), 0.0, 1.0);
  gl_FragColor = vec4(mix(uFogColor, color, fog), 1.0);
}
`;

export interface DeltaWaterOptions {
  normalMap: BaseTexture;
  shoreMap: BaseTexture;
  worldSize: number;
  /** World distance encoded by a shore map value of 1. */
  shoreRange: number;
}

export class DeltaWaterMaterial {
  readonly material: ShaderMaterial;
  private time = 0;

  constructor(private scene: Scene, options: DeltaWaterOptions) {
    this.material = new ShaderMaterial(
      "deltaWater",
      scene,
      { vertexSource: VERTEX, fragmentSource: FRAGMENT },
      {
        attributes: ["position"],
        uniforms: [
          "world", "viewProjection", "uTime", "uWorldSize", "uShoreRange", "uFogDensity",
          "uCameraPos", "uSunDir", "uSunColor", "uDeep", "uShallow", "uZenith", "uHorizon",
          "uBank", "uFoam", "uFogColor", "uWind", "uDrift",
        ],
        samplers: ["normalMap", "shoreMap"],
      }
    );
    const m = this.material;
    m.setTexture("normalMap", options.normalMap);
    m.setTexture("shoreMap", options.shoreMap);
    m.setFloat("uWorldSize", options.worldSize);
    m.setFloat("uShoreRange", options.shoreRange);
    // Colors sampled from photos of the Tigre and Luján rivers
    m.setColor3("uDeep", new Color3(0.4, 0.3, 0.19));
    m.setColor3("uShallow", new Color3(0.56, 0.44, 0.29));
    m.setColor3("uZenith", new Color3(0.47, 0.64, 0.82));
    m.setColor3("uHorizon", new Color3(0.8, 0.85, 0.88));
    m.setColor3("uBank", new Color3(0.16, 0.2, 0.11));
    m.setColor3("uFoam", new Color3(0.88, 0.85, 0.78));
    m.setColor3("uSunColor", new Color3(1, 0.95, 0.82));
    // Toward the sun of the scene's DirectionalLight (-0.5, -1, 0.5)
    m.setVector3("uSunDir", new Vector3(0.5, 1, -0.5).normalize());
    m.backFaceCulling = false;
    this.setConditions(0.6, 0.8, 0.25, 0, 0);
    this.update(0);
  }

  setNormalMap(texture: BaseTexture): void {
    this.material.setTexture("normalMap", texture);
  }

  /** Wind (direction and 0..1 strength) and how far the current has carried the surface. */
  setConditions(windX: number, windZ: number, strength: number, driftX: number, driftZ: number): void {
    this.material.setVector3("uWind", new Vector3(windX, windZ, strength));
    this.material.setVector2("uDrift", new Vector2(driftX, driftZ));
  }

  update(dt: number): void {
    this.time += dt;
    const m = this.material;
    m.setFloat("uTime", this.time);
    const camera = this.scene.activeCamera;
    if (camera) m.setVector3("uCameraPos", camera.globalPosition);
    m.setColor3("uFogColor", this.scene.fogColor);
    m.setFloat("uFogDensity", this.scene.fogEnabled && this.scene.fogMode !== 0 ? this.scene.fogDensity : 0);
  }
}
