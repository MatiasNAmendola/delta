import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import {
  RIVER_MAP,
  WATER_LEVEL,
  WORLD_SIZE,
  type RiverSegment,
} from "../utils/constants";
import { getPointOnPath } from "../utils/helpers";

export class WaterSystem {
  private scene: THREE.Scene;
  private waterMeshes: Water[] = [];
  private time = 0;
  private riverCollisionMap: boolean[][] = [];
  private mapResolution = 400;
  private normalTexture: THREE.CanvasTexture | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildCollisionMap();
    this.normalTexture = this.createBumpTexture();
    this.createRiverMeshes();
  }

  private buildCollisionMap(): void {
    const res = this.mapResolution;
    const cellSize = WORLD_SIZE / res;
    this.riverCollisionMap = Array.from({ length: res }, () =>
      new Array(res).fill(false)
    );

    // Mark cells by sampling along the river path and painting
    // perpendicular to the flow direction (not axis-aligned squares)
    for (const river of RIVER_MAP) {
      const samples = river.points.length * 20;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const [rx, rz] = getPointOnPath(river.points, t);

        // Compute tangent direction at this point
        const t2 = Math.min(1, t + 0.005);
        const [rx2, rz2] = getPointOnPath(river.points, t2);
        const tdx = rx2 - rx;
        const tdz = rz2 - rz;
        const len = Math.sqrt(tdx * tdx + tdz * tdz) || 1;
        // Normal (perpendicular to tangent)
        const nx = -tdz / len;
        const nz = tdx / len;

        // Paint cells along the perpendicular, not an axis-aligned box
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

  /** Fast grid-based check — used for terrain generation, trees, etc. */
  public isWater(worldX: number, worldZ: number): boolean {
    const res = this.mapResolution;
    const gx = Math.floor(((worldX + WORLD_SIZE / 2) / WORLD_SIZE) * res);
    const gz = Math.floor(((worldZ + WORLD_SIZE / 2) / WORLD_SIZE) * res);
    if (gx < 0 || gx >= res || gz < 0 || gz >= res) return false;
    return this.riverCollisionMap[gx][gz];
  }

  /** Precise distance-to-path check — used for boat collision.
   *  Computes actual distance from point to the nearest river centerline
   *  and compares against river.width/2. No grid quantization errors. */
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

  /**
   * Create a procedural normal map as a CanvasTexture for the Water shader.
   */
  private createBumpTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Fill with a base color first, then read back
    ctx.fillStyle = "rgb(128,128,255)";
    ctx.fillRect(0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    // Simple hash-based noise for tileable patterns
    const hash = (x: number, y: number): number => {
      let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
      h = ((h >> 13) ^ h) | 0;
      h = (h * (h * h * 15731 + 789221) + 1376312589) | 0;
      return ((h >> 16) & 0x7fff) / 0x7fff;
    };

    // Smooth noise with cosine interpolation (tileable)
    const smoothNoise = (x: number, y: number, period: number): number => {
      const ix = Math.floor(x) % period;
      const iy = Math.floor(y) % period;
      const fx = x - Math.floor(x);
      const fy = y - Math.floor(y);
      // Cosine interpolation
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

    // Multi-octave turbulence (tileable)
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
        // Combine turbulence with directional waves
        const h = turbulence(nx, ny) * 0.6
          + Math.sin(nx * 3.5 + ny * 2.1) * 0.15
          + Math.sin(nx * 1.3 - ny * 4.7) * 0.12
          + Math.sin((nx + ny) * 5.3) * 0.08;
        heights[y * size + x] = h;
      }
    }

    // Convert height map to normal map (Sobel-like derivatives)
    const strength = 2.5;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        // Tileable sampling
        const xp = (x + 1) % size;
        const xm = (x - 1 + size) % size;
        const yp = (y + 1) % size;
        const ym = (y - 1 + size) % size;

        const hL = heights[y * size + xm];
        const hR = heights[y * size + xp];
        const hU = heights[ym * size + x];
        const hD = heights[yp * size + x];

        // Normal from height differences
        const dx = (hR - hL) * strength;
        const dy = (hD - hU) * strength;
        // Normalize
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        const rnx = dx / len;
        const rny = dy / len;
        const rnz = 1 / len;

        // Encode normal to RGB ([-1,1] → [0,255])
        data[idx + 0] = Math.floor((rnx * 0.5 + 0.5) * 255); // R = X
        data[idx + 1] = Math.floor((rny * 0.5 + 0.5) * 255); // G = Y
        data[idx + 2] = Math.floor((rnz * 0.5 + 0.5) * 255); // B = Z
        data[idx + 3] = 255; // A
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  private createRiverMeshes(): void {
    if (!this.normalTexture) return;

    // Create river strip meshes, each as a Water object
    for (const river of RIVER_MAP) {
      const water = this.createRiverStrip(river);
      this.waterMeshes.push(water);
      this.scene.add(water);
    }
  }

  private createRiverStrip(river: RiverSegment): Water {
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
      const dx = x2 - x;
      const dz = z2 - z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const halfW = river.width / 2;

      // Left vertex
      positions.push(x + nx * halfW, WATER_LEVEL + 0.05, z + nz * halfW);
      normals.push(0, 1, 0);
      uvs.push(0, t * 4);

      // Right vertex
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

    // Detect mobile for smaller reflection render targets
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || "ontouchstart" in window;
    const rtSize = isMobile ? 256 : 512;

    const water = new Water(geometry, {
      textureWidth: rtSize,
      textureHeight: rtSize,
      waterNormals: this.normalTexture!,
      sunDirection: new THREE.Vector3(0.7, 0.8, 0.6).normalize(),
      sunColor: 0xffffff,
      waterColor: 0x2d5a3f, // Delta brown-green
      distortionScale: 3.7,
      fog: false,
    });

    // Set the 'size' uniform to control UV tiling in the Water shader
    (water.material as THREE.ShaderMaterial).uniforms['size'].value = 6.0;

    water.name = "river_" + river.name;
    water.rotation.x = 0; // Water geometry is already in the XZ plane

    return water;
  }

  /**
   * Add a mesh to the water's reflection render list.
   * Three.js Water handles reflections internally via onBeforeRender —
   * it renders the entire scene from a mirrored camera. No explicit
   * render list management is needed.
   */
  public addToRenderList(_mesh: THREE.Mesh): void {
    // Three.js Water renders the full scene for reflections automatically.
    // This method is kept for API compatibility but is a no-op.
  }

  /**
   * Add all scene meshes to the water render list.
   * Three.js Water handles this automatically — kept for API compatibility.
   */
  public addSceneToRenderList(): void {
    // Three.js Water renders the full scene for reflections automatically.
    // No explicit render list needed.
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;
    // Update the time uniform on all Water meshes so the shader animates
    for (const water of this.waterMeshes) {
      const material = water.material as THREE.ShaderMaterial;
      if (material.uniforms && material.uniforms['time']) {
        material.uniforms['time'].value = this.time;
      }
    }
  }

  /** Get wave height at a position for boat bobbing */
  public getWaveHeight(x: number, z: number, time: number): number {
    return (
      Math.sin(x * 0.1 + time * 1.5) * 0.04 +
      Math.sin(z * 0.08 + time * 1.2) * 0.03 +
      Math.sin((x + z) * 0.05 + time * 0.8) * 0.02
    );
  }
}
