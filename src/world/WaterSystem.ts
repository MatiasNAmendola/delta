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
    this.createRiverBed();
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

  /** Create a procedural bump/normal map texture for the water */
  private createBumpTexture(): DynamicTexture {
    const size = 512;
    const tex = new DynamicTexture("waterBump", size, this.scene, true);
    const ctx = tex.getContext();

    // Generate a tileable bump-map pattern
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = x / size;
        const ny = y / size;

        // Layered sine waves to simulate water normal perturbation
        const wave1 = Math.sin(nx * 20 + ny * 10) * 0.3;
        const wave2 = Math.sin(nx * 35 - ny * 25) * 0.2;
        const wave3 = Math.sin(nx * 8 + ny * 40) * 0.15;
        const wave4 = Math.sin((nx + ny) * 50) * 0.1;
        const combined = (wave1 + wave2 + wave3 + wave4 + 0.75) * 0.5;

        const val = Math.floor(Math.max(0, Math.min(255, combined * 255)));
        ctx.fillStyle = `rgb(${val},${val},255)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.update();
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

    // Bump texture for wave normals
    this.waterMaterial.bumpTexture = this.createBumpTexture();
    this.waterMaterial.bumpHeight = 0.4;
    this.waterMaterial.bumpSuperimpose = true;
    this.waterMaterial.bumpAffectsReflection = true;

    // Wave properties - Delta river style (gentle muddy water)
    this.waterMaterial.windForce = 8;
    this.waterMaterial.windDirection = new Vector2(0.5, 0.8);
    this.waterMaterial.waveHeight = 0.3;
    this.waterMaterial.waveLength = 0.3;
    this.waterMaterial.waveSpeed = 30;
    this.waterMaterial.waveCount = 3;

    // Water colors - murky Delta brown-green
    this.waterMaterial.waterColor = new Color3(0.15, 0.28, 0.18);
    this.waterMaterial.waterColor2 = new Color3(0.1, 0.2, 0.12);
    this.waterMaterial.colorBlendFactor = 0.4;
    this.waterMaterial.colorBlendFactor2 = 0.3;

    // Fresnel for realistic reflection angle
    this.waterMaterial.fresnelSeparate = true;

    // Specular
    this.waterMaterial.specularColor = new Color3(0.2, 0.2, 0.15);
    this.waterMaterial.specularPower = 64;

    // Use world coordinates so all river strips share the same wave pattern
    this.waterMaterial.useWorldCoordinatesForWaveDeformation = true;

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
