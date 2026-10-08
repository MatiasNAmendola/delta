import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { WaterMaterial } from "@babylonjs/materials/water/waterMaterial";
import { WATER_LEVEL, COLORS } from "../utils/constants";
import type { River, WorldDoc } from "./WorldDoc";
import {
  createGrid,
  isSet,
  rasterizeAreas,
  riverCoverage,
  triangulateAreas,
  uncoveredRuns,
  type WaterGrid,
} from "./waterGeometry";
import { getPointOnPath, hexToColor3 } from "../utils/helpers";

/** Rivers this much inside water areas are drawn only where the areas miss them. */
const STRIP_SKIP_COVERAGE = 0.7;
/**
 * Extra navigable width beside each drawn strip. Kept small so the boat
 * (2 units wide, collision tested at its center) never sails over visible land.
 */
const STRIP_COLLISION_MARGIN = 0.5;

export class WaterSystem {
  private scene: Scene;
  private world: WorldDoc;
  private waterMeshes: Mesh[] = [];
  private waterMaterial: WaterMaterial | null = null;
  private time = 0;
  private waterGrid!: WaterGrid;
  /** Cells covered by water areas only (null when the world has none). */
  private areaGrid: WaterGrid | null = null;
  /** River center lines drawn as water strips (see planStrips). */
  private strips: River[] = [];
  /** Water lookup grid cells per side: ~2 world units per cell (400 for the original 800-unit Delta). */
  private mapResolution: number;

  // Meshes to add to the water render list (reflection/refraction)
  private renderListMeshes: Mesh[] = [];

  constructor(scene: Scene, world: WorldDoc) {
    this.scene = scene;
    this.world = world;
    this.mapResolution = Math.min(1600, Math.max(400, Math.round(world.world.size / 2)));
    this.buildCollisionMap();
    this.createBumpTexture();
    this.createRiverMeshes();
    // Riverbed removed — WaterMaterial handles underwater via refraction/color blend
  }

  private buildCollisionMap(): void {
    const res = this.mapResolution;
    const size = this.world.world.size;
    this.waterGrid = createGrid(size, res);

    // Real water shapes (OSM polygons) first: they decide which river strips are drawn
    const areas = this.world.waterAreas ?? [];
    if (areas.length > 0) {
      this.areaGrid = createGrid(size, res);
      rasterizeAreas(this.areaGrid, areas);
      this.waterGrid.cells.set(this.areaGrid.cells);
    }
    this.strips = this.planStrips();

    // Navigable water = exactly what is drawn: areas ∪ strips (no hidden water)
    for (const river of this.strips) {
      const samples = river.points.length * 20;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const [rx, rz] = getPointOnPath(river.points, t);
        const halfW = river.width / 2 + STRIP_COLLISION_MARGIN;

        const minX = Math.floor(((rx - halfW + size / 2) / size) * res);
        const maxX = Math.ceil(((rx + halfW + size / 2) / size) * res);
        const minZ = Math.floor(((rz - halfW + size / 2) / size) * res);
        const maxZ = Math.ceil(((rz + halfW + size / 2) / size) * res);

        for (let gx = Math.max(0, minX); gx <= Math.min(res - 1, maxX); gx++) {
          for (let gz = Math.max(0, minZ); gz <= Math.min(res - 1, maxZ); gz++) {
            this.waterGrid.cells[gx * res + gz] = 1;
          }
        }
      }
    }
  }

  /**
   * River strips to draw: whole rivers, except those already mostly drawn by
   * their real polygon — for those only the stretches the polygons miss, so
   * the channel stays continuous without overlapping (flickering) water.
   */
  private planStrips(): River[] {
    const strips: River[] = [];
    for (const river of this.world.rivers) {
      if (!this.areaGrid || riverCoverage(river, this.areaGrid) < STRIP_SKIP_COVERAGE) {
        strips.push(river);
        continue;
      }
      uncoveredRuns(river, this.areaGrid, 6).forEach((points, k) => {
        strips.push({ ...river, id: `${river.id}-tramo-${k}`, points });
      });
    }
    return strips;
  }

  public isWater(worldX: number, worldZ: number): boolean {
    return isSet(this.waterGrid, worldX, worldZ);
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

    // Water colors — Delta Tigre: brown-green murky river water
    this.waterMaterial.waterColor = new Color3(0.18, 0.3, 0.2);
    this.waterMaterial.waterColor2 = new Color3(0.12, 0.22, 0.14);
    this.waterMaterial.colorBlendFactor = 0.35;
    this.waterMaterial.colorBlendFactor2 = 0.25;
    this.waterMaterial.diffuseColor = new Color3(0.25, 0.35, 0.2);

    // Fresnel — more reflection at shallow angles
    this.waterMaterial.fresnelSeparate = true;

    // Specular — subtle sun glints
    this.waterMaterial.specularColor = new Color3(0.3, 0.3, 0.25);
    this.waterMaterial.specularPower = 128;

    // Use world coordinates so all river strips share the same wave pattern
    this.waterMaterial.useWorldCoordinatesForWaveDeformation = true;

    // Performance: limit lights
    this.waterMaterial.maxSimultaneousLights = 2;

    // Clip plane: avoids rendering artifacts below the water surface
    this.waterMaterial.disableClipPlane = false;

    // Create river strip meshes using the shared WaterMaterial
    if (this.world.waterAreas && this.world.waterAreas.length > 0) {
      this.waterMeshes.push(this.createWaterAreasMesh());
    }
    // All strips share the material: merge them into a single draw call
    const strips = this.strips.map((river) => this.createRiverStrip(river));
    const merged = strips.length > 1 ? Mesh.MergeMeshes(strips, true, true) : strips[0];
    if (merged) {
      merged.name = "riverStrips";
      merged.material = this.waterMaterial;
      this.waterMeshes.push(merged);
    }
  }

  /** All water areas as one triangulated mesh: a single draw call. */
  private createWaterAreasMesh(): Mesh {
    const { vertices, indices } = triangulateAreas(this.world.waterAreas ?? []);
    const count = vertices.length / 2;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = vertices[i * 2];
      const z = vertices[i * 2 + 1];
      positions.set([x, WATER_LEVEL + 0.04, z], i * 3);
      normals.set([0, 1, 0], i * 3);
      uvs.set([x / 20, z / 20], i * 2);
    }
    const mesh = new Mesh("waterAreas", this.scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(mesh);
    mesh.material = this.waterMaterial;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    return mesh;
  }

  private createRiverStrip(river: River): Mesh {
    // ~8 samples per control point, but no denser than one every 2 units
    let length = 0;
    for (let i = 1; i < river.points.length; i++) {
      length += Math.hypot(river.points[i][0] - river.points[i - 1][0], river.points[i][1] - river.points[i - 1][1]);
    }
    const samples = Math.max(8, Math.min(river.points.length * 8, Math.ceil(length / 2)));
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
  /**
   * Meshes rendered into the water reflection and refraction passes. Each
   * one is drawn twice more per frame, so only add what is worth seeing in
   * the water (static world batches, the boat), never effects like the wake.
   */
  public addToReflections(meshes: AbstractMesh[]): void {
    if (!this.waterMaterial) return;
    for (const mesh of meshes) {
      if (mesh.material === this.waterMaterial) continue;
      this.waterMaterial.addToRenderList(mesh);
    }
  }


  private createRiverBed(): void {
    for (const river of this.world.rivers) {
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
