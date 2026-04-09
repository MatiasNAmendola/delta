/**
 * VegetationSystem — density-based vegetation with 4 layers.
 * Places juncos/reeds, bushes, ground grass, and understory plants
 * using InstancedMesh for performance. Wind animation via ShaderMaterial.
 */
import * as THREE from "three";
import { WORLD_SIZE, WATER_LEVEL, RIVER_MAP } from "../utils/constants";
import { seededRandom, getPointOnPath } from "../utils/helpers";
import { WaterSystem } from "./WaterSystem";

// Wind vertex shader chunk (shared across layers)
const WIND_VERTEX = `
  uniform float uTime;
  uniform float uWindStrength;
  attribute vec3 instanceColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = instanceColor;

    vec3 pos = position;

    // Wind: bend top vertices based on Y height
    float heightFactor = pos.y / 2.5; // normalize to ~max height
    heightFactor = clamp(heightFactor, 0.0, 1.0);
    float windPhase = uTime * 1.5
      + (instanceMatrix[3][0]) * 0.08
      + (instanceMatrix[3][2]) * 0.12;
    float wind = sin(windPhase) * uWindStrength * heightFactor * heightFactor;
    float windZ = sin(windPhase * 0.7 + 1.3) * uWindStrength * 0.5 * heightFactor;
    pos.x += wind;
    pos.z += windZ;

    // Alpha fade at top for softer look
    vAlpha = 1.0 - heightFactor * 0.15;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const WIND_FRAGMENT = `
  varying vec3 vColor;
  varying float vAlpha;
  uniform sampler2D uTexture;
  uniform float uAlphaTest;

  void main() {
    vec4 tex = texture2D(uTexture, gl_PointCoord);
    float alpha = tex.a * vAlpha;
    if (alpha < uAlphaTest) discard;
    gl_FragColor = vec4(vColor * tex.rgb, alpha);
  }
`;

// Simple quad vertex shader for instanced quads
const QUAD_WIND_VERTEX = `
  uniform float uTime;
  uniform float uWindStrength;
  varying vec2 vUv;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    // Instance color from attribute
    vColor = vec3(
      float((instanceColor.r)),
      float((instanceColor.g)),
      float((instanceColor.b))
    );

    vec3 pos = position;

    // Wind animation on upper vertices
    float heightFactor = clamp(pos.y / 2.0, 0.0, 1.0);
    float windPhase = uTime * 1.5
      + instanceMatrix[3][0] * 0.08
      + instanceMatrix[3][2] * 0.12;
    pos.x += sin(windPhase) * uWindStrength * heightFactor * heightFactor;
    pos.z += sin(windPhase * 0.7 + 1.3) * uWindStrength * 0.4 * heightFactor;

    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const QUAD_WIND_FRAGMENT = `
  varying vec2 vUv;
  varying vec3 vColor;
  uniform sampler2D uTexture;
  uniform float uAlphaTest;

  void main() {
    vec4 tex = texture2D(uTexture, vUv);
    if (tex.a < uAlphaTest) discard;
    gl_FragColor = vec4(vColor * tex.rgb, tex.a);
  }
`;

export class VegetationSystem {
  private scene: THREE.Scene;
  private time = 0;
  private windMaterials: THREE.ShaderMaterial[] = [];

  constructor(scene: THREE.Scene, waterSystem: WaterSystem) {
    this.scene = scene;
    this.createReeds(waterSystem);
    this.createBushes(waterSystem);
    this.createGroundGrass(waterSystem);
    this.createUnderstory(waterSystem);
  }

  update(dt: number): void {
    this.time += dt;
    for (const mat of this.windMaterials) {
      mat.uniforms.uTime.value = this.time;
    }
  }

  // ─── Layer 1: Juncos/Reeds (0-3m from water) ───
  private createReeds(ws: WaterSystem): void {
    const maxCount = 2000;
    const geo = this.createReedGeometry();
    const tex = this.createReedTexture();

    const mat = new THREE.ShaderMaterial({
      vertexShader: QUAD_WIND_VERTEX,
      fragmentShader: QUAD_WIND_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: 0.3 },
        uTexture: { value: tex },
        uAlphaTest: { value: 0.3 },
      },
      side: THREE.DoubleSide,
      transparent: false,
    });
    this.windMaterials.push(mat);

    const mesh = new THREE.InstancedMesh(geo, mat, maxCount);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3);
    geo.setAttribute("instanceColor", colorAttr);

    const matrix = new THREE.Matrix4();
    const rng = seededRandom(555);
    let count = 0;

    // Sample along rivers, place reeds very close to water
    for (const river of RIVER_MAP) {
      const samples = river.points.length * 12;
      for (let i = 0; i < samples && count < maxCount; i++) {
        const t = i / samples;
        const [rx, rz] = getPointOnPath(river.points, t);
        const halfW = river.width / 2;

        for (const side of [-1, 1]) {
          if (count >= maxCount) break;
          if (rng() > 0.6) continue; // density control

          const dist = halfW + 0.5 + rng() * 2.5; // 0.5-3m from water edge
          const t2 = Math.min(1, t + 0.005);
          const [rx2, rz2] = getPointOnPath(river.points, t2);
          const dx = rx2 - rx, dz = rz2 - rz;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          const nx = -dz / len, nz = dx / len;

          const px = rx + nx * dist * side + (rng() - 0.5) * 1.5;
          const pz = rz + nz * dist * side + (rng() - 0.5) * 1.5;

          if (ws.isWater(px, pz)) continue;

          const scale = 0.8 + rng() * 1.2;
          const rotY = rng() * Math.PI * 2;

          matrix.makeRotationY(rotY);
          matrix.scale(new THREE.Vector3(scale * 0.3, scale, scale * 0.3));
          matrix.setPosition(px, WATER_LEVEL + 0.05, pz);
          mesh.setMatrixAt(count, matrix);

          // Brown-golden with green tips
          const g = 0.35 + rng() * 0.25;
          colorAttr.setXYZ(count, 0.55 + rng() * 0.15, g, 0.15 + rng() * 0.1);
          count++;
        }
      }
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  // ─── Layer 2: Low Bushes (3-8m from water) ───
  private createBushes(ws: WaterSystem): void {
    const maxCount = 500;
    const geo = new THREE.IcosahedronGeometry(0.5, 1);
    // Perturb vertices for organic shape
    const pos = geo.attributes.position;
    const rng0 = seededRandom(888);
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i,
        pos.getX(i) * (0.7 + rng0() * 0.6),
        pos.getY(i) * (0.6 + rng0() * 0.5),
        pos.getZ(i) * (0.7 + rng0() * 0.6)
      );
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a7a22,
      roughness: 0.9,
      metalness: 0,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, maxCount);
    const matrix = new THREE.Matrix4();
    const rng = seededRandom(666);
    let count = 0;

    for (const river of RIVER_MAP) {
      const samples = river.points.length * 8;
      for (let i = 0; i < samples && count < maxCount; i++) {
        const t = i / samples;
        const [rx, rz] = getPointOnPath(river.points, t);
        const halfW = river.width / 2;

        for (const side of [-1, 1]) {
          if (count >= maxCount || rng() > 0.4) continue;

          const dist = halfW + 3 + rng() * 5;
          const t2 = Math.min(1, t + 0.005);
          const [rx2, rz2] = getPointOnPath(river.points, t2);
          const dx = rx2 - rx, dz = rz2 - rz;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          const nx = -dz / len, nz = dx / len;

          const px = rx + nx * dist * side + (rng() - 0.5) * 3;
          const pz = rz + nz * dist * side + (rng() - 0.5) * 3;
          if (ws.isWater(px, pz)) continue;

          const scale = 0.6 + rng() * 1.0;
          matrix.makeRotationY(rng() * Math.PI * 2);
          matrix.scale(new THREE.Vector3(scale, scale * (0.6 + rng() * 0.4), scale));
          matrix.setPosition(px, WATER_LEVEL + scale * 0.3, pz);
          mesh.setMatrixAt(count, matrix);

          // Vary green shades
          const color = new THREE.Color();
          color.setHSL(0.28 + rng() * 0.08, 0.5 + rng() * 0.3, 0.2 + rng() * 0.15);
          mesh.setColorAt(count, color);
          count++;
        }
      }
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  // ─── Layer 3: Ground Cover Grass (0-30m from water) ───
  private createGroundGrass(ws: WaterSystem): void {
    const maxCount = 5000;
    const geo = this.createGrassBladeGeometry();
    const tex = this.createGrassTexture();

    const mat = new THREE.ShaderMaterial({
      vertexShader: QUAD_WIND_VERTEX,
      fragmentShader: QUAD_WIND_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: 0.15 },
        uTexture: { value: tex },
        uAlphaTest: { value: 0.2 },
      },
      side: THREE.DoubleSide,
      transparent: false,
    });
    this.windMaterials.push(mat);

    const mesh = new THREE.InstancedMesh(geo, mat, maxCount);
    const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3);
    geo.setAttribute("instanceColor", colorAttr);

    const matrix = new THREE.Matrix4();
    const rng = seededRandom(444);
    let count = 0;

    for (const river of RIVER_MAP) {
      const samples = river.points.length * 15;
      for (let i = 0; i < samples && count < maxCount; i++) {
        const t = i / samples;
        const [rx, rz] = getPointOnPath(river.points, t);
        const halfW = river.width / 2;

        for (const side of [-1, 1]) {
          if (count >= maxCount) break;

          // Dense near water, sparse far
          const dist = halfW + 1 + rng() * 28;
          const density = dist < halfW + 5 ? 0.7 : dist < halfW + 15 ? 0.4 : 0.15;
          if (rng() > density) continue;

          const t2 = Math.min(1, t + 0.005);
          const [rx2, rz2] = getPointOnPath(river.points, t2);
          const dx = rx2 - rx, dz = rz2 - rz;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          const nx = -dz / len, nz = dx / len;

          const px = rx + nx * dist * side + (rng() - 0.5) * 4;
          const pz = rz + nz * dist * side + (rng() - 0.5) * 4;
          if (ws.isWater(px, pz)) continue;

          const scale = 0.3 + rng() * 0.5;
          matrix.makeRotationY(rng() * Math.PI * 2);
          matrix.scale(new THREE.Vector3(scale, scale, scale));
          matrix.setPosition(px, WATER_LEVEL + 0.02, pz);
          mesh.setMatrixAt(count, matrix);

          const green = 0.3 + rng() * 0.3;
          colorAttr.setXYZ(count, 0.15 + rng() * 0.15, green, 0.05 + rng() * 0.08);
          count++;
        }
      }
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  // ─── Layer 4: Understory Plants (8-20m from water) ───
  private createUnderstory(ws: WaterSystem): void {
    const maxCount = 300;
    // Fern-like shape: flat wide quad
    const geo = new THREE.PlaneGeometry(1.5, 1.0, 1, 1);
    const tex = this.createFernTexture();

    const mat = new THREE.ShaderMaterial({
      vertexShader: QUAD_WIND_VERTEX,
      fragmentShader: QUAD_WIND_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: 0.1 },
        uTexture: { value: tex },
        uAlphaTest: { value: 0.3 },
      },
      side: THREE.DoubleSide,
      transparent: false,
    });
    this.windMaterials.push(mat);

    const mesh = new THREE.InstancedMesh(geo, mat, maxCount);
    const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3);
    geo.setAttribute("instanceColor", colorAttr);

    const matrix = new THREE.Matrix4();
    const rng = seededRandom(333);
    let count = 0;

    for (const river of RIVER_MAP) {
      const samples = river.points.length * 6;
      for (let i = 0; i < samples && count < maxCount; i++) {
        const t = i / samples;
        const [rx, rz] = getPointOnPath(river.points, t);
        const halfW = river.width / 2;

        for (const side of [-1, 1]) {
          if (count >= maxCount || rng() > 0.35) continue;

          const dist = halfW + 8 + rng() * 12;
          const t2 = Math.min(1, t + 0.005);
          const [rx2, rz2] = getPointOnPath(river.points, t2);
          const dx = rx2 - rx, dz = rz2 - rz;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          const nx = -dz / len, nz = dx / len;

          const px = rx + nx * dist * side + (rng() - 0.5) * 5;
          const pz = rz + nz * dist * side + (rng() - 0.5) * 5;
          if (ws.isWater(px, pz)) continue;

          const scale = 0.5 + rng() * 0.8;
          matrix.makeRotationY(rng() * Math.PI * 2);
          matrix.scale(new THREE.Vector3(scale, scale, scale));
          matrix.setPosition(px, WATER_LEVEL + 0.3, pz);
          mesh.setMatrixAt(count, matrix);

          colorAttr.setXYZ(count, 0.12 + rng() * 0.1, 0.35 + rng() * 0.2, 0.08 + rng() * 0.06);
          count++;
        }
      }
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  // ─── Geometry helpers ───

  private createReedGeometry(): THREE.BufferGeometry {
    // Tall thin quad (reed/junco shape)
    const h = 2.5, w = 0.15;
    const positions = new Float32Array([
      -w, 0, 0,  w, 0, 0,  w, h, 0,  -w, h, 0,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return geo;
  }

  private createGrassBladeGeometry(): THREE.BufferGeometry {
    // Short tapered grass blade
    const h = 0.8, w = 0.08;
    const positions = new Float32Array([
      -w, 0, 0,  w, 0, 0,  w * 0.3, h, 0,  -w * 0.3, h, 0,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 0.8, 1, 0.2, 1]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return geo;
  }

  // ─── Texture helpers ───

  private createReedTexture(): THREE.CanvasTexture {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size * 4;
    const ctx = canvas.getContext("2d")!;

    // Vertical reed with pointed top
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
    grad.addColorStop(0, "rgba(140,110,60,0.9)");  // brown base
    grad.addColorStop(0.6, "rgba(100,130,50,0.85)"); // green middle
    grad.addColorStop(0.9, "rgba(80,120,40,0.7)"); // green tip
    grad.addColorStop(1, "rgba(60,100,30,0)");      // faded top

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(size * 0.2, canvas.height);
    ctx.lineTo(size * 0.8, canvas.height);
    ctx.lineTo(size * 0.55, 0);
    ctx.lineTo(size * 0.45, 0);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private createGrassTexture(): THREE.CanvasTexture {
    const w = 32, h = 64;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;

    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, "rgba(60,100,30,0.9)");
    grad.addColorStop(0.7, "rgba(80,140,40,0.8)");
    grad.addColorStop(1, "rgba(100,160,50,0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h);
    ctx.lineTo(w * 0.9, h);
    ctx.lineTo(w * 0.55, 0);
    ctx.lineTo(w * 0.45, 0);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private createFernTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    ctx.clearRect(0, 0, size, size);

    // Draw fern frond shape
    const rng = seededRandom(789);
    ctx.strokeStyle = "rgba(40,100,25,0.9)";
    ctx.lineWidth = 2;

    // Central stem
    ctx.beginPath();
    ctx.moveTo(size / 2, size);
    ctx.lineTo(size / 2, size * 0.1);
    ctx.stroke();

    // Leaflets along the stem
    for (let i = 0; i < 12; i++) {
      const y = size - (i + 1) * (size * 0.07);
      const leafLen = (size * 0.35) * (1 - i / 14);
      for (const side of [-1, 1]) {
        ctx.fillStyle = `rgba(${30 + rng() * 40},${80 + rng() * 60},${20 + rng() * 20},0.8)`;
        ctx.beginPath();
        ctx.ellipse(
          size / 2 + side * leafLen * 0.5,
          y,
          leafLen * 0.5,
          3 + rng() * 2,
          side * 0.3,
          0, Math.PI * 2
        );
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }
}
