import { Scene } from "@babylonjs/core/scene";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

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
uniform sampler2D normalMap;
uniform sampler2D shoreMap;

vec2 slopeAt(vec2 uv) {
  return texture2D(normalMap, uv).xy * 2.0 - 1.0;
}

void main(void) {
  vec2 p = vWorld.xz;
  // Distance to the nearest bank, in world units
  float shore = texture2D(shoreMap, p / uWorldSize + 0.5).r * uShoreRange;

  // Three ripple layers drifting with the current at different scales
  vec2 flow = vec2(0.6, 0.8);
  vec2 s1 = slopeAt(p * 0.06 + flow * uTime * 0.015);
  vec2 s2 = slopeAt(p * 0.17 - flow.yx * uTime * 0.025);
  vec2 s3 = slopeAt(p * 0.43 + vec2(-flow.x, flow.y) * uTime * 0.04);
  vec2 slope = s1 * 0.5 + s2 * 0.35 + s3 * 0.3;
  vec3 N = normalize(vec3(slope.x * 0.7, 1.0, slope.y * 0.7));

  vec3 toCam = uCameraPos - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float NdV = max(dot(N, V), 0.0);
  float fresnel = 0.03 + 0.97 * pow(1.0 - NdV, 5.0);

  // Sky reflected by the ripples; near the banks the trees reflect dark green
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.6));
  float underTrees = 1.0 - smoothstep(1.5, 12.0, shore);
  sky = mix(sky, uBank, underTrees * 0.8);

  // Sediment-laden body color: lighter and yellower in the shallows by the bank
  vec3 body = mix(uShallow, uDeep, smoothstep(0.5, 9.0, shore));
  body *= 0.93 + 0.14 * slope.x;

  vec3 color = mix(body, sky, clamp(fresnel * 0.85, 0.0, 1.0));

  // Sun: tight glints that sparkle on the ripples plus a soft sheen
  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(N, H), 0.0);
  color += uSunColor * (pow(nh, 500.0) * 1.8 + pow(nh, 80.0) * 0.05);

  // Water lapping the bank: a thin, moving line of foam
  float lap = 0.5 + 0.5 * sin(uTime * 1.4 + p.x * 0.35 + p.y * 0.27);
  float foam = 1.0 - smoothstep(0.0, 0.7 + lap * 0.5, shore + slope.y * 0.5);
  color = mix(color, uFoam, foam * 0.6);

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
          "uBank", "uFoam", "uFogColor",
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
    this.update(0);
  }

  setNormalMap(texture: BaseTexture): void {
    this.material.setTexture("normalMap", texture);
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
