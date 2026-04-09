/**
 * GrassSystem — Efficient grass rendering using InstancedMesh + ShaderMaterial
 *
 * Technique based on community research:
 * - Cross-billboard quads (2 intersecting planes per grass clump)
 * - InstancedMesh for GPU-efficient rendering of thousands of blades
 * - Vertex shader wind displacement with sin-based sway
 * - Y-based sway (only tips move, base stays planted)
 *
 * Three.js implementation using InstancedMesh and ShaderMaterial.
 */
import * as THREE from 'three';
import { WATER_LEVEL, RIVER_MAP, WORLD_SIZE } from "../utils/constants";
import { WaterSystem } from "./WaterSystem";
import { seededRandom, getPointOnPath } from "../utils/helpers";

// Inline vertex shader
const GRASS_VERTEX = `
precision highp float;

uniform float time;
uniform float windStrength;
uniform vec2 windDirection;

varying vec2 vUV;
varying float vHeight;
varying float vShade;

void main() {
    vec3 pos = position;

    // Wind sway — only affects upper part of blade (uv.y = 0 is base, 1 is tip)
    float swayFactor = uv.y * uv.y; // quadratic: tips sway most

    // Use world position for varied wind phase across the field
    vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
    float phase = worldPos.x * 0.15 + worldPos.z * 0.12 + time * 2.5;
    float phase2 = worldPos.x * 0.08 - worldPos.z * 0.1 + time * 1.8;

    // Primary sway + secondary sway for organic feel
    float sway = sin(phase) * 0.6 + sin(phase2 * 1.3) * 0.3 + sin(phase * 2.7 + 0.5) * 0.15;

    pos.x += sway * swayFactor * windStrength * windDirection.x;
    pos.z += sway * swayFactor * windStrength * windDirection.y;
    // Slight vertical compression when swaying
    pos.y -= abs(sway) * swayFactor * windStrength * 0.1;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    vUV = uv;
    vHeight = uv.y;
    // Simple ambient occlusion: darker at base
    vShade = 0.55 + 0.45 * uv.y;
}
`;

// Inline fragment shader
const GRASS_FRAGMENT = `
precision highp float;

uniform vec3 grassColorBase;
uniform vec3 grassColorTip;
uniform sampler2D grassTex;
uniform vec3 fogColor;
uniform float fogDensity;

varying vec2 vUV;
varying float vHeight;
varying float vShade;

void main() {
    vec4 texColor = texture2D(grassTex, vUV);

    // Alpha cutout for grass blade shape
    if (texColor.a < 0.3) discard;

    // Blend from dark base to bright tip
    vec3 color = mix(grassColorBase, grassColorTip, vHeight);
    color *= vShade;
    color *= texColor.rgb;

    // Exp2 fog
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * depth * depth);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    color = mix(color, fogColor, fogFactor);

    gl_FragColor = vec4(color, texColor.a);
}
`;

export class GrassSystem {
  private scene: THREE.Scene;
  private grassMesh: THREE.InstancedMesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private time = 0;

  constructor(scene: THREE.Scene, waterSystem: WaterSystem) {
    this.scene = scene;
    this.createGrassField(waterSystem);
  }

  private createGrassTexture(): THREE.CanvasTexture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Draw a grass blade shape: narrow at base, slightly wider in middle, pointed at top
    ctx.clearRect(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      const t = y / size; // 0 = bottom, 1 = top
      // Blade width narrows toward tip
      const halfWidth = (size / 2) * (1 - t * t) * 0.4 + 1;
      const cx = size / 2;

      for (let x = 0; x < size; x++) {
        const dx = Math.abs(x - cx);
        if (dx < halfWidth) {
          // Inside blade
          const edgeFade = 1 - dx / halfWidth;
          const brightness = 0.7 + Math.random() * 0.3;
          const g = Math.floor(brightness * 255);
          const alpha = edgeFade > 0.3 ? 1.0 : edgeFade / 0.3;
          ctx.fillStyle = `rgba(${Math.floor(g * 0.8)}, ${g}, ${Math.floor(g * 0.6)}, ${alpha})`;
          ctx.fillRect(x, size - 1 - y, 1, 1); // flip Y so base is at uv.y=0
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /** Create a cross-billboard grass clump geometry (2 intersecting quads) */
  private createGrassClumpGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const addQuad = (rotY: number) => {
      const c = Math.cos(rotY);
      const s = Math.sin(rotY);
      const hw = 0.5; // half width
      const h = 1.0;  // height
      const vi = positions.length / 3;

      // 4 vertices: bottom-left, bottom-right, top-left, top-right
      // Bottom-left
      positions.push(-hw * c, 0, -hw * s);
      normals.push(s, 0, -c);
      uvs.push(0, 0);
      // Bottom-right
      positions.push(hw * c, 0, hw * s);
      normals.push(s, 0, -c);
      uvs.push(1, 0);
      // Top-left
      positions.push(-hw * c, h, -hw * s);
      normals.push(s, 0, -c);
      uvs.push(0, 1);
      // Top-right
      positions.push(hw * c, h, hw * s);
      normals.push(s, 0, -c);
      uvs.push(1, 1);

      // Front face
      indices.push(vi, vi + 1, vi + 2);
      indices.push(vi + 1, vi + 3, vi + 2);
      // Back face
      indices.push(vi + 2, vi + 1, vi);
      indices.push(vi + 2, vi + 3, vi + 1);
    };

    // Two crossing quads at 0deg and 90deg
    addQuad(0);
    addQuad(Math.PI / 2);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    return geometry;
  }

  private createGrassField(waterSystem: WaterSystem): void {
    const grassTex = this.createGrassTexture();

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERTEX,
      fragmentShader: GRASS_FRAGMENT,
      uniforms: {
        time: { value: 0 },
        windStrength: { value: 0.4 },
        windDirection: { value: new THREE.Vector2(0.7, 0.5) },
        grassColorBase: { value: new THREE.Color(0.2, 0.45, 0.12) },
        grassColorTip: { value: new THREE.Color(0.4, 0.7, 0.2) },
        grassTex: { value: grassTex },
        fogColor: { value: new THREE.Color(0.6, 0.78, 0.85) },
        fogDensity: { value: 0.0012 },
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
    });

    // Create base grass clump geometry
    const geometry = this.createGrassClumpGeometry();

    // Collect placement matrices
    const rng = seededRandom(777);
    const matrices: THREE.Matrix4[] = [];
    const tmpPos = new THREE.Vector3();
    const tmpScale = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const upAxis = new THREE.Vector3(0, 1, 0);

    for (const river of RIVER_MAP) {
      const samplesPerRiver = river.points.length * 6;
      for (let i = 0; i < samplesPerRiver; i++) {
        const t = i / samplesPerRiver;
        const [rx, rz] = getPointOnPath(river.points, t);

        // Get perpendicular direction
        const t2 = Math.min(1, t + 0.01);
        const [rx2, rz2] = getPointOnPath(river.points, t2);
        const dx = rx2 - rx;
        const dz = rz2 - rz;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;
        const halfW = river.width / 2;

        // Place grass clumps along both banks
        for (const side of [-1, 1]) {
          // 3-8 clumps per sample point, spread along the bank
          const clumpCount = 2 + Math.floor(rng() * 3);
          for (let c = 0; c < clumpCount; c++) {
            const bankDist = halfW + 1 + rng() * 12; // 1-13m from water edge
            const along = (rng() - 0.5) * 4; // scatter along river

            const px = rx + nx * bankDist * side + dx / len * along;
            const pz = rz + nz * bankDist * side + dz / len * along;

            // Don't place in water
            if (waterSystem.isWater(px, pz)) continue;
            // Don't place too far from world bounds
            if (Math.abs(px) > WORLD_SIZE * 0.45 || Math.abs(pz) > WORLD_SIZE * 0.45) continue;

            const scale = 0.6 + rng() * 1.2; // height variation
            const rotY = rng() * Math.PI * 2;

            tmpPos.set(px, WATER_LEVEL - 0.1, pz);
            tmpScale.set(0.8 + rng() * 0.4, scale, 0.8 + rng() * 0.4);
            tmpQuat.setFromAxisAngle(upAxis, rotY);

            const mat = new THREE.Matrix4();
            mat.compose(tmpPos, tmpQuat, tmpScale);
            matrices.push(mat);
          }
        }
      }
    }

    // Create InstancedMesh
    if (matrices.length > 0) {
      const instancedMesh = new THREE.InstancedMesh(geometry, this.material, matrices.length);
      for (let i = 0; i < matrices.length; i++) {
        instancedMesh.setMatrixAt(i, matrices[i]);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.frustumCulled = false;
      this.scene.add(instancedMesh);
      this.grassMesh = instancedMesh;
    }

    console.log(`GrassSystem: ${matrices.length} grass clumps placed`);
  }

  /** Show or hide the grass system (used by performance optimizer) */
  public setVisible(visible: boolean): void {
    if (this.grassMesh) {
      this.grassMesh.visible = visible;
    }
  }

  public update(deltaTime: number): void {
    // Skip shader update when hidden
    if (this.grassMesh && !this.grassMesh.visible) return;

    this.time += deltaTime;
    if (this.material) {
      this.material.uniforms.time.value = this.time;
    }
  }

  public dispose(): void {
    if (this.grassMesh) {
      this.scene.remove(this.grassMesh);
      this.grassMesh.geometry.dispose();
      (this.grassMesh.material as THREE.ShaderMaterial).dispose();
    }
  }
}
