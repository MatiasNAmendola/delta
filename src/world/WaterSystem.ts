import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { WaterMaterial } from "@babylonjs/materials/water/waterMaterial";
import {
  RIVER_MAP,
  WATER_LEVEL,
  WORLD_SIZE,
  COLORS,
  type RiverSegment,
} from "../utils/constants";
import { getPointOnPath, hexToColor3 } from "../utils/helpers";

export class WaterSystem {
  private scene: Scene;
  private waterMeshes: Mesh[] = [];
  private waterMaterial: WaterMaterial | null = null;
  private time = 0;
  private riverCollisionMap: boolean[][] = [];
  private mapResolution = 400;

  // Meshes to add to the water render list (reflection/refraction)
  private renderListMeshes: Mesh[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
    this.buildCollisionMap();
    this.createBumpTexture();
    this.createRiverMeshes();
    // Riverbed removed — WaterMaterial handles underwater via refraction/color blend
  }

  private buildCollisionMap(): void {
    const res = this.mapResolution;
    this.riverCollisionMap = Array.from({ length: res }, () =>
      new Array(res).fill(false)
    );

    for (const river of RIVER_MAP) {
      const samples = river.points.length * 20;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const [rx, rz] = getPointOnPath(river.points, t);
        const halfW = river.width / 2 + 2;

        const minX = Math.floor(
          ((rx - halfW + WORLD_SIZE / 2) / WORLD_SIZE) * res
        );
        const maxX = Math.ceil(
          ((rx + halfW + WORLD_SIZE / 2) / WORLD_SIZE) * res
        );
        const minZ = Math.floor(
          ((rz - halfW + WORLD_SIZE / 2) / WORLD_SIZE) * res
        );
        const maxZ = Math.ceil(
          ((rz + halfW + WORLD_SIZE / 2) / WORLD_SIZE) * res
        );

        for (let gx = minX; gx <= maxX; gx++) {
          for (let gz = minZ; gz <= maxZ; gz++) {
            if (gx >= 0 && gx < res && gz >= 0 && gz < res) {
              this.riverCollisionMap[gx][gz] = true;
            }
          }
        }
      }
    }
  }

  public isWater(worldX: number, worldZ: number): boolean {
    const res = this.mapResolution;
    const gx = Math.floor(((worldX + WORLD_SIZE / 2) / WORLD_SIZE) * res);
    const gz = Math.floor(((worldZ + WORLD_SIZE / 2) / WORLD_SIZE) * res);
    if (gx < 0 || gx >= res || gz < 0 || gz >= res) return false;
    return this.riverCollisionMap[gx][gz];
  }

  /**
   * Attempt to load a real water normal map from a CDN.
   * Falls back to a high-quality procedural normal map if loading fails.
   */
  private createBumpTexture(): Texture | DynamicTexture {
    // Try loading a proper water normal map from BabylonJS assets
    try {
      const tex = new Texture(
        "https://assets.babylonjs.com/textures/waterbump.png",
        this.scene,
        false, // no mipmap generation issues
        false, // not inverted Y
        Texture.TRILINEAR_SAMPLINGMODE,
        () => {
          // Loaded successfully
          console.log("Water bump texture loaded from CDN");
        },
        () => {
          // Failed — will use fallback (already set below)
          console.warn("CDN water bump failed, using procedural");
        }
      );
      tex.wrapU = Texture.WRAP_ADDRESSMODE;
      tex.wrapV = Texture.WRAP_ADDRESSMODE;
      tex.uScale = 6;
      tex.vScale = 6;
      return tex;
    } catch {
      // Fallback to procedural
    }
    return this.createProceduralBumpTexture();
  }

  /** High-quality procedural normal map with multi-octave noise */
  private createProceduralBumpTexture(): DynamicTexture {
    const size = 512;
    const tex = new DynamicTexture("waterBump", size, this.scene, true);
    const ctx = tex.getContext();
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
    tex.update(false);
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    return tex;
  }

  private createRiverMeshes(): void {
    // Create the WaterMaterial (with smaller render targets for mobile perf)
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || "ontouchstart" in window;
    const rtSize = isMobile ? 256 : 512;

    this.waterMaterial = new WaterMaterial(
      "waterMaterial",
      this.scene,
      new Vector2(rtSize, rtSize)
    );

    // Bump texture — try CDN first, fallback to procedural normal map
    this.waterMaterial.bumpTexture = this.createBumpTexture();
    this.waterMaterial.bumpHeight = 0.6;
    this.waterMaterial.bumpSuperimpose = true;
    this.waterMaterial.bumpAffectsReflection = true;

    // Wave properties — Delta river: gentle current, not ocean
    this.waterMaterial.windForce = 5;
    this.waterMaterial.windDirection = new Vector2(0.6, 0.8);
    this.waterMaterial.waveHeight = 0.08;
    this.waterMaterial.waveLength = 0.15;
    this.waterMaterial.waveSpeed = 15;
    this.waterMaterial.waveCount = 8;

    // Water colors — Delta Tigre: brown muddy river water (from real photos)
    this.waterMaterial.waterColor = new Color3(0.35, 0.28, 0.15);
    this.waterMaterial.waterColor2 = new Color3(0.25, 0.2, 0.1);
    this.waterMaterial.colorBlendFactor = 0.45;
    this.waterMaterial.colorBlendFactor2 = 0.35;
    this.waterMaterial.diffuseColor = new Color3(0.4, 0.32, 0.18);

    // Fresnel — more reflection at shallow angles
    this.waterMaterial.fresnelSeparate = true;

    // Specular — warm sun glints on brown water
    this.waterMaterial.specularColor = new Color3(0.4, 0.35, 0.25);
    this.waterMaterial.specularPower = 64;

    // Use world coordinates so all river strips share the same wave pattern
    this.waterMaterial.useWorldCoordinatesForWaveDeformation = true;

    // Performance: limit lights
    this.waterMaterial.maxSimultaneousLights = 2;

    // Clip plane: avoids rendering artifacts below the water surface
    this.waterMaterial.disableClipPlane = false;

    // Create river strip meshes using the shared WaterMaterial
    for (const river of RIVER_MAP) {
      const mesh = this.createRiverStrip(river);
      this.waterMeshes.push(mesh);
    }
  }

  private createRiverStrip(river: RiverSegment): Mesh {
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

    const mesh = new Mesh("river_" + river.name, this.scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(mesh);

    // Apply the shared WaterMaterial
    mesh.material = this.waterMaterial;

    return mesh;
  }

  /** Add a mesh to the water's reflection/refraction render list */
  public addToRenderList(mesh: Mesh): void {
    this.renderListMeshes.push(mesh);
    if (this.waterMaterial) {
      this.waterMaterial.addToRenderList(mesh);
    }
  }

  /** Add all scene meshes to the water render list (call after environment is built) */
  public addSceneToRenderList(): void {
    if (!this.waterMaterial) return;

    for (const mesh of this.scene.meshes) {
      // Don't add water meshes to their own render list
      if (mesh.material === this.waterMaterial) continue;
      // Don't add riverbed meshes
      if (mesh.name.startsWith("riverbed_")) continue;
      this.waterMaterial.addToRenderList(mesh);
    }
  }

  private createRiverBed(): void {
    for (const river of RIVER_MAP) {
      const samples = river.points.length * 6;
      const positions: number[] = [];
      const indices: number[] = [];
      const normals: number[] = [];
      const colors: number[] = [];

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

        const halfW = river.width / 2 + 1;

        positions.push(x + nx * halfW, WATER_LEVEL - 1.5, z + nz * halfW);
        normals.push(0, 1, 0);
        colors.push(0.15, 0.25, 0.18, 1);

        positions.push(x - nx * halfW, WATER_LEVEL - 1.5, z - nz * halfW);
        normals.push(0, 1, 0);
        colors.push(0.12, 0.22, 0.15, 1);

        if (i < samples) {
          const vi = i * 2;
          indices.push(vi, vi + 1, vi + 2);
          indices.push(vi + 1, vi + 3, vi + 2);
        }
      }

      const mesh = new Mesh("riverbed_" + river.name, this.scene);
      const vertexData = new VertexData();
      vertexData.positions = positions;
      vertexData.indices = indices;
      vertexData.normals = normals;
      vertexData.colors = colors;
      vertexData.applyToMesh(mesh);

      const mat = new StandardMaterial("riverbedMat_" + river.name, this.scene);
      mat.diffuseColor = hexToColor3(COLORS.waterDeep);
      mat.specularColor = Color3.Black();
      mesh.material = mat;
    }
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;
    // WaterMaterial handles its own animation internally - no manual update needed
  }

  /** Get wave height at a position for boat bobbing */
  public getWaveHeight(x: number, z: number, time: number): number {
    return (
      Math.sin(x * 0.1 + time * 1.5) * 0.15 +
      Math.sin(z * 0.08 + time * 1.2) * 0.1 +
      Math.sin((x + z) * 0.05 + time * 0.8) * 0.08
    );
  }
}
