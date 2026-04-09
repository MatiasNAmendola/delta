import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import {
  RIVER_MAP,
  WATER_LEVEL,
  WORLD_SIZE,
  type RiverSegment,
} from "../utils/constants";
import { getPointOnPath } from "../utils/helpers";

// ---------------------------------------------------------------------------
// Wave layer definition for multi-frequency wave simulation
// ---------------------------------------------------------------------------

interface WaveLayer {
  dirX: number;     // wave propagation direction X
  dirZ: number;     // wave propagation direction Z
  frequency: number; // spatial frequency
  amplitude: number; // height contribution
  speed: number;     // temporal speed
  phase: number;     // initial phase offset
}

/** Six overlapping wave layers for realistic Delta river surface */
const WAVE_LAYERS: WaveLayer[] = [
  // Primary long swell (river current direction)
  { dirX: 0.8, dirZ: 0.6, frequency: 0.06, amplitude: 0.045, speed: 0.8, phase: 0.0 },
  // Secondary cross-current swell
  { dirX: -0.3, dirZ: 0.95, frequency: 0.09, amplitude: 0.032, speed: 1.1, phase: 1.3 },
  // Medium chop
  { dirX: 0.5, dirZ: -0.86, frequency: 0.15, amplitude: 0.022, speed: 1.6, phase: 2.7 },
  // Wind ripple A
  { dirX: -0.7, dirZ: 0.7, frequency: 0.28, amplitude: 0.012, speed: 2.2, phase: 0.5 },
  // Wind ripple B
  { dirX: 0.9, dirZ: -0.4, frequency: 0.38, amplitude: 0.008, speed: 2.8, phase: 4.1 },
  // Fine capillary ripple
  { dirX: 0.1, dirZ: 1.0, frequency: 0.55, amplitude: 0.004, speed: 3.5, phase: 1.9 },
];

export class WaterSystem {
  private scene: THREE.Scene;
  private waterMeshes: THREE.Mesh[] = [];
  private time = 0;
  private riverCollisionMap: boolean[][] = [];
  private mapResolution = 400;
  private normalTexture: THREE.CanvasTexture | null = null;

  // Edge foam
  private edgeFoamMesh: THREE.Mesh | null = null;

  // Underwater tint plane
  private underwaterPlane: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildCollisionMap();
    this.normalTexture = this.createBumpTexture();
    this.createRiverMeshes();
    this.createEdgeFoam();
    this.createUnderwaterTintPlane();
  }

  // =========================================================================
  // Collision map (unchanged)
  // =========================================================================

  private buildCollisionMap(): void {
    const res = this.mapResolution;
    const cellSize = WORLD_SIZE / res;
    this.riverCollisionMap = Array.from({ length: res }, () =>
      new Array(res).fill(false)
    );

    for (const river of RIVER_MAP) {
      const samples = river.points.length * 20;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const [rx, rz] = getPointOnPath(river.points, t);

        const t2 = Math.min(1, t + 0.005);
        const [rx2, rz2] = getPointOnPath(river.points, t2);
        const tdx = rx2 - rx;
        const tdz = rz2 - rz;
        const len = Math.sqrt(tdx * tdx + tdz * tdz) || 1;
        const nx = -tdz / len;
        const nz = tdx / len;

        const halfW = river.width / 2;
        for (let w = -halfW; w <= halfW; w += cellSize * 0.5) {
          const wx = rx + nx * w;
          const wz = rz + nz * w;
          const gx = Math.floor(((wx + WORLD_SIZE / 2) / WORLD_SIZE) * res);
          const gz = Math.floor(((wz + WORLD_SIZE / 2) / WORLD_SIZE) * res);
          if (gx >= 0 && gx < res && gz >= 0 && gz < res) {
            this.riverCollisionMap[gx][gz] = true;
          }
        }
      }
    }
  }

  /** Fast grid-based check -- used for terrain generation, trees, etc. */
  public isWater(worldX: number, worldZ: number): boolean {
    const res = this.mapResolution;
    const gx = Math.floor(((worldX + WORLD_SIZE / 2) / WORLD_SIZE) * res);
    const gz = Math.floor(((worldZ + WORLD_SIZE / 2) / WORLD_SIZE) * res);
    if (gx < 0 || gx >= res || gz < 0 || gz >= res) return false;
    return this.riverCollisionMap[gx][gz];
  }

  /** Precise distance-to-path check -- used for boat collision. */
  public isWaterPrecise(worldX: number, worldZ: number): boolean {
    for (const river of RIVER_MAP) {
      const halfW = river.width / 2;
      const halfWSq = halfW * halfW;
      const samples = river.points.length * 10;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const [rx, rz] = getPointOnPath(river.points, t);
        const dx = worldX - rx;
        const dz = worldZ - rz;
        if (dx * dx + dz * dz < halfWSq) {
          return true;
        }
      }
    }
    return false;
  }

  // =========================================================================
  // Procedural normal map
  // =========================================================================

  private createBumpTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = "rgb(128,128,255)";
    ctx.fillRect(0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    const hash = (x: number, y: number): number => {
      let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
      h = ((h >> 13) ^ h) | 0;
      h = (h * (h * h * 15731 + 789221) + 1376312589) | 0;
      return ((h >> 16) & 0x7fff) / 0x7fff;
    };

    const smoothNoise = (x: number, y: number, period: number): number => {
      const ix = Math.floor(x) % period;
      const iy = Math.floor(y) % period;
      const fx = x - Math.floor(x);
      const fy = y - Math.floor(y);
      const cx = (1 - Math.cos(fx * Math.PI)) * 0.5;
      const cy = (1 - Math.cos(fy * Math.PI)) * 0.5;
      const ix1 = (ix + 1) % period;
      const iy1 = (iy + 1) % period;
      const v00 = hash(ix, iy);
      const v10 = hash(ix1, iy);
      const v01 = hash(ix, iy1);
      const v11 = hash(ix1, iy1);
      const i1 = v00 * (1 - cx) + v10 * cx;
      const i2 = v01 * (1 - cx) + v11 * cx;
      return i1 * (1 - cy) + i2 * cy;
    };

    const turbulence = (x: number, y: number): number => {
      let val = 0;
      let amp = 1;
      let freq = 1;
      let maxVal = 0;
      for (let oct = 0; oct < 5; oct++) {
        const period = Math.max(1, Math.floor(4 * freq));
        val += smoothNoise(x * freq, y * freq, period) * amp;
        maxVal += amp;
        amp *= 0.5;
        freq *= 2;
      }
      return val / maxVal;
    };

    // Generate height map
    const heights = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * 4;
        const ny = (y / size) * 4;
        // Richer detail: turbulence + multiple directional wave patterns
        const h = turbulence(nx, ny) * 0.50
          + Math.sin(nx * 3.5 + ny * 2.1) * 0.12
          + Math.sin(nx * 1.3 - ny * 4.7) * 0.10
          + Math.sin((nx + ny) * 5.3) * 0.08
          + Math.sin(nx * 7.1 - ny * 1.9) * 0.06
          + Math.sin((nx * 2.3 + ny * 6.7)) * 0.04;
        heights[y * size + x] = h;
      }
    }

    // Convert height map to normal map (Sobel-like derivatives) -- stronger
    const strength = 3.0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const xp = (x + 1) % size;
        const xm = (x - 1 + size) % size;
        const yp = (y + 1) % size;
        const ym = (y - 1 + size) % size;

        const hL = heights[y * size + xm];
        const hR = heights[y * size + xp];
        const hU = heights[ym * size + x];
        const hD = heights[yp * size + x];

        const dx = (hR - hL) * strength;
        const dy = (hD - hU) * strength;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        const rnx = dx / len;
        const rny = dy / len;
        const rnz = 1 / len;

        data[idx + 0] = Math.floor((rnx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.floor((rny * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.floor((rnz * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // =========================================================================
  // River water meshes
  // =========================================================================

  private simpleMaterials: THREE.MeshStandardMaterial[] = [];

  private createRiverMeshes(): void {
    for (const river of RIVER_MAP) {
      const mesh = this.createRiverStripSimple(river);
      this.scene.add(mesh);
    }
  }

  /** Simple water using MeshStandardMaterial — works on ALL devices, no reflections */
  private createRiverStripSimple(river: RiverSegment): THREE.Mesh {
    const samples = river.points.length * 8;
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const [x, z] = getPointOnPath(river.points, t);
      const t2 = Math.min(1, t + 0.01);
      const [x2, z2] = getPointOnPath(river.points, t2);
      const dx = x2 - x, dz = z2 - z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len, nz = dx / len;
      const halfW = river.width / 2;

      positions.push(x + nx * halfW, WATER_LEVEL + 0.05, z + nz * halfW);
      normals.push(0, 1, 0);
      uvs.push(0, t * 4);

      positions.push(x - nx * halfW, WATER_LEVEL + 0.05, z - nz * halfW);
      normals.push(0, 1, 0);
      uvs.push(1, t * 4);

      if (i < samples) {
        const vi = i * 2;
        indices.push(vi, vi + 1, vi + 2);
        indices.push(vi + 1, vi + 3, vi + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

    // Simple water material — muddy brown Delta color, slightly transparent
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3d5a3f,      // Delta brown-green
      roughness: 0.15,        // smooth/reflective water
      metalness: 0.3,         // slight metallic for reflection
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });

    // Add bump map for wave detail if available
    if (this.normalTexture) {
      mat.bumpMap = this.normalTexture;
      mat.bumpScale = 0.3;
      this.normalTexture.wrapS = THREE.RepeatWrapping;
      this.normalTexture.wrapT = THREE.RepeatWrapping;
      this.normalTexture.repeat.set(8, 8);
    }

    this.simpleMaterials.push(mat);

    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = "river_" + river.name;
    return mesh;
  }

  // =========================================================================
  // Edge foam — transparent quads along river banks
  // =========================================================================

  private createEdgeFoam(): void {
    // Generate foam strip positions along both edges of every river
    const foamPositions: number[] = [];
    const foamUvs: number[] = [];
    const foamIndices: number[] = [];
    const foamAlphas: number[] = [];
    let vertIndex = 0;

    for (const river of RIVER_MAP) {
      const samples = river.points.length * 6;
      const foamWidth = 2.5; // how far foam extends from edge

      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i <= samples; i++) {
          const t = i / samples;
          const [cx, cz] = getPointOnPath(river.points, t);

          const t2 = Math.min(1, t + 0.01);
          const [cx2, cz2] = getPointOnPath(river.points, t2);
          const dx = cx2 - cx;
          const dz = cz2 - cz;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          const nx = -dz / len;
          const nz = dx / len;

          const halfW = river.width / 2;

          // Inner edge (at water boundary)
          const innerX = cx + nx * halfW * side;
          const innerZ = cz + nz * halfW * side;
          // Outer edge (on land, slightly beyond water edge)
          const outerX = cx + nx * (halfW + foamWidth) * side;
          const outerZ = cz + nz * (halfW + foamWidth) * side;

          foamPositions.push(innerX, WATER_LEVEL + 0.08, innerZ);
          foamPositions.push(outerX, WATER_LEVEL + 0.06, outerZ);

          foamUvs.push(0, t * 8);
          foamUvs.push(1, t * 8);

          // Alpha: full at inner edge, zero at outer edge
          foamAlphas.push(0.7);
          foamAlphas.push(0.0);

          if (i < samples) {
            const vi = vertIndex;
            foamIndices.push(vi, vi + 1, vi + 2);
            foamIndices.push(vi + 1, vi + 3, vi + 2);
          }
          vertIndex += 2;
        }
      }
    }

    if (foamPositions.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(foamPositions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(foamUvs, 2));
    geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(foamAlphas, 1));
    geometry.setIndex(foamIndices);

    // Create a procedural foam texture
    const foamTex = this.createFoamTexture();

    const foamMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: foamTex },
        uTime: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        attribute float alpha;
        varying float vAlpha;
        varying vec2 vUv;
        void main() {
          vAlpha = alpha;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTexture;
        uniform float uTime;
        varying float vAlpha;
        varying vec2 vUv;
        void main() {
          // Scroll and animate foam UVs
          vec2 uv1 = vUv * vec2(1.0, 1.0) + vec2(uTime * 0.02, uTime * 0.05);
          vec2 uv2 = vUv * vec2(1.5, 0.8) + vec2(-uTime * 0.03, uTime * 0.04);
          vec4 foam1 = texture2D(uTexture, uv1);
          vec4 foam2 = texture2D(uTexture, uv2);
          // Combine two foam layers for variety
          float foamIntensity = (foam1.r * 0.6 + foam2.r * 0.4);
          // Pulsating edge foam
          float pulse = 0.8 + 0.2 * sin(uTime * 1.5 + vUv.y * 12.0);
          float finalAlpha = vAlpha * foamIntensity * pulse;
          // Foam is off-white with slight brown tint for Delta mud
          vec3 foamColor = vec3(0.92, 0.88, 0.78);
          gl_FragColor = vec4(foamColor, finalAlpha * 0.65);
          if (gl_FragColor.a < 0.02) discard;
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.edgeFoamMesh = new THREE.Mesh(geometry, foamMaterial);
    this.edgeFoamMesh.name = "edgeFoam";
    this.edgeFoamMesh.renderOrder = 1;
    this.scene.add(this.edgeFoamMesh);
  }

  /** Procedural tileable foam texture */
  private createFoamTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    const hash = (x: number, y: number): number => {
      let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
      h = ((h >> 13) ^ h) | 0;
      h = (h * (h * h * 15731 + 789221) + 1376312589) | 0;
      return ((h >> 16) & 0x7fff) / 0x7fff;
    };

    const smoothNoise = (x: number, y: number, period: number): number => {
      const ix = Math.floor(x) % period;
      const iy = Math.floor(y) % period;
      const fx = x - Math.floor(x);
      const fy = y - Math.floor(y);
      const cx = (1 - Math.cos(fx * Math.PI)) * 0.5;
      const cy = (1 - Math.cos(fy * Math.PI)) * 0.5;
      const ix1 = (ix + 1) % period;
      const iy1 = (iy + 1) % period;
      return (hash(ix, iy) * (1 - cx) + hash(ix1, iy) * cx) * (1 - cy)
           + (hash(ix, iy1) * (1 - cx) + hash(ix1, iy1) * cx) * cy;
    };

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const nx = (x / size) * 8;
        const ny = (y / size) * 8;

        // Multi-octave cellular/bubbly noise
        let val = 0;
        let amp = 1;
        let freq = 1;
        let max = 0;
        for (let oct = 0; oct < 4; oct++) {
          const period = Math.max(1, Math.floor(8 * freq));
          val += smoothNoise(nx * freq, ny * freq, period) * amp;
          max += amp;
          amp *= 0.5;
          freq *= 2;
        }
        val /= max;

        // Create bubbly/cellular pattern by thresholding
        const bubble = Math.pow(val, 0.6);
        const foam = bubble > 0.45 ? (bubble - 0.45) / 0.55 : 0;
        const bright = Math.floor(foam * 255);

        data[idx + 0] = Math.min(255, bright + 20);
        data[idx + 1] = Math.min(255, bright + 15);
        data[idx + 2] = Math.min(255, bright + 5);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // =========================================================================
  // Underwater tint plane (brown refraction tint)
  // =========================================================================

  /**
   * Creates a large semi-transparent brown plane just below water level.
   * When the camera looks through the water surface, refracted/reflected
   * light picks up this brown tint, simulating sediment-laden Delta water.
   * This sits below the Water mesh so it colors the refraction pass.
   */
  private createUnderwaterTintPlane(): void {
    const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      color: 0x3a2512,         // Dark muddy brown
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.underwaterPlane = new THREE.Mesh(geometry, material);
    this.underwaterPlane.position.y = WATER_LEVEL - 0.5;
    this.underwaterPlane.name = "underwaterTint";
    this.underwaterPlane.renderOrder = -1;
    this.scene.add(this.underwaterPlane);
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Add a mesh to the water's reflection render list.
   * Three.js Water handles reflections internally via onBeforeRender --
   * it renders the entire scene from a mirrored camera. No explicit
   * render list management is needed.
   */
  public addToRenderList(_mesh: THREE.Mesh): void {
    // Three.js Water renders the full scene for reflections automatically.
  }

  /**
   * Add all scene meshes to the water render list.
   * Three.js Water handles this automatically -- kept for API compatibility.
   */
  public addSceneToRenderList(): void {
    // Three.js Water renders the full scene for reflections automatically.
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;

    // Animate water bump texture offset for wave movement
    for (const mat of this.simpleMaterials) {
      if (mat.bumpMap) {
        mat.bumpMap.offset.x = this.time * 0.02;
        mat.bumpMap.offset.y = this.time * 0.015;
      }
    }

    // Animate edge foam
    if (this.edgeFoamMesh) {
      const foamMat = this.edgeFoamMesh.material as THREE.ShaderMaterial;
      if (foamMat.uniforms && foamMat.uniforms['uTime']) {
        foamMat.uniforms['uTime'].value = this.time;
      }
    }
  }

  // =========================================================================
  // Multi-frequency wave height (6 overlapping sine waves)
  // =========================================================================

  /**
   * Get wave height at a world position for boat bobbing.
   * Uses 6 overlapping sine waves with different directions, frequencies,
   * amplitudes, and speeds to produce a natural-looking river surface.
   */
  public getWaveHeight(x: number, z: number, time: number): number {
    let height = 0;
    for (let i = 0; i < WAVE_LAYERS.length; i++) {
      const w = WAVE_LAYERS[i];
      // dot(position, direction) * frequency + time * speed + phase
      const d = (x * w.dirX + z * w.dirZ) * w.frequency + time * w.speed + w.phase;
      height += Math.sin(d) * w.amplitude;
    }
    return height;
  }
}
