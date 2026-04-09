import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
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
  private time = 0;
  private riverCollisionMap: boolean[][] = [];
  private mapResolution = 400;

  constructor(scene: Scene) {
    this.scene = scene;
    this.buildCollisionMap();
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

  private createWaterTexture(): DynamicTexture {
    const tex = new DynamicTexture("waterTex", 256, this.scene, false);
    const ctx = tex.getContext();
    // Create a simple procedural water texture
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const noise =
          Math.sin(x * 0.1) * Math.cos(y * 0.1) * 20 +
          Math.sin(x * 0.05 + y * 0.03) * 15;
        const r = 30 + noise;
        const g = 90 + noise * 1.5;
        const b = 70 + noise;
        ctx.fillStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.update();
    return tex;
  }

  private createRiverMeshes(): void {
    const waterTex = this.createWaterTexture();
    waterTex.uScale = 8;
    waterTex.vScale = 8;

    for (const river of RIVER_MAP) {
      const mesh = this.createRiverStrip(river, waterTex);
      this.waterMeshes.push(mesh);
    }
  }

  private createRiverStrip(river: RiverSegment, texture: DynamicTexture): Mesh {
    const samples = river.points.length * 8;
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const [x, z] = getPointOnPath(river.points, t);

      // Get direction for perpendicular
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

    const mat = new StandardMaterial("waterMat_" + river.name, this.scene);
    mat.diffuseTexture = texture;
    mat.specularColor = new Color3(0.3, 0.4, 0.35);
    mat.alpha = 0.85;
    mat.backFaceCulling = false;
    mesh.material = mat;

    return mesh;
  }

  private createRiverBed(): void {
    // Create darker riverbed slightly below water
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
    // Animate water UV offset for flowing effect
    for (const mesh of this.waterMeshes) {
      const mat = mesh.material as StandardMaterial;
      if (mat.diffuseTexture) {
        (mat.diffuseTexture as Texture).vOffset = this.time * 0.02;
        (mat.diffuseTexture as Texture).uOffset =
          Math.sin(this.time * 0.3) * 0.02;
      }
    }
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
