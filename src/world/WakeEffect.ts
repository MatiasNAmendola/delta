import * as THREE from "three";
import { WATER_LEVEL } from "../utils/constants";

/** Kelvin wake half-angle in radians (~19.47 degrees) */
const KELVIN_ANGLE = Math.asin(1 / 3);

/** Max trail points per ribbon side */
const TRAIL_LENGTH = 40;

/** Max lifetime for trail points (seconds) */
const TRAIL_MAX_AGE = 4.0;

/** Max foam particles */
const MAX_FOAM = 400;

interface TrailPoint {
  x: number;
  z: number;
  age: number;
  speed: number;
}

interface FoamParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
}

// ---------------------------------------------------------------------------
// Procedural texture helpers
// ---------------------------------------------------------------------------

function makeHash(): (x: number, y: number) => number {
  return (x: number, y: number): number => {
    let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
    h = ((h >> 13) ^ h) | 0;
    h = (h * (h * h * 15731 + 789221) + 1376312589) | 0;
    return ((h >> 16) & 0x7fff) / 0x7fff;
  };
}

function fbm(
  hash: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number
): number {
  let val = 0,
    amp = 1,
    freq = 1,
    max = 0;
  for (let o = 0; o < octaves; o++) {
    const period = Math.max(1, Math.floor(4 * freq));
    const ix = Math.floor(x * freq) % period;
    const iy = Math.floor(y * freq) % period;
    const fx = x * freq - Math.floor(x * freq);
    const fy = y * freq - Math.floor(y * freq);
    const cx = (1 - Math.cos(fx * Math.PI)) * 0.5;
    const cy = (1 - Math.cos(fy * Math.PI)) * 0.5;
    const ix1 = (ix + 1) % period;
    const iy1 = (iy + 1) % period;
    const v =
      (hash(ix, iy) * (1 - cx) + hash(ix1, iy) * cx) * (1 - cy) +
      (hash(ix, iy1) * (1 - cx) + hash(ix1, iy1) * cx) * cy;
    val += v * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / max;
}

/** Create a soft radial gradient circle texture for foam / spray particles */
function createFoamTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const center = size / 2;
  const hash = makeHash();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy) / center;
      const radial = Math.max(0, 1 - dist);
      const noise = fbm(hash, (x / size) * 6, (y / size) * 6, 3);
      const foam = radial * (0.4 + noise * 0.6);
      const alpha = Math.pow(Math.max(0, foam), 0.7);
      const bright = 220 + Math.floor(noise * 35);
      ctx.fillStyle = `rgba(${bright}, ${bright}, ${Math.min(255, bright + 5)}, ${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// WakeEffect
// ---------------------------------------------------------------------------

export class WakeEffect {
  private scene: THREE.Scene;

  // V-wake trail ribbons
  private portTrail: TrailPoint[] = [];
  private starboardTrail: TrailPoint[] = [];
  private centerTrail: TrailPoint[] = [];

  private portTrailMesh: THREE.Mesh;
  private starboardTrailMesh: THREE.Mesh;
  private centerTrailMesh: THREE.Mesh;

  // Pre-allocated ribbon buffers (avoids GC churn from creating new geometry every frame)
  private ribbonPositions: Float32Array;
  private ribbonColors: Float32Array;
  private ribbonIndices: Uint16Array;

  // Foam particle system (replaces BabylonJS ParticleSystem)
  private foamParticles: FoamParticle[] = [];
  private foamPoints: THREE.Points;
  private foamPositions: Float32Array;
  private foamSizes: Float32Array;
  private foamAlphas: Float32Array;

  // Bow wave disc
  private bowWave: THREE.Mesh;

  // Performance toggles
  private foamEnabled = true;
  private trailsEnabled = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Pre-allocate ribbon buffers sized for TRAIL_LENGTH (reused each frame)
    const maxVerts = TRAIL_LENGTH * 2;
    this.ribbonPositions = new Float32Array(maxVerts * 3);
    this.ribbonColors = new Float32Array(maxVerts * 4);
    this.ribbonIndices = new Uint16Array((TRAIL_LENGTH - 1) * 6);

    // --- Trail ribbon meshes ---
    this.portTrailMesh = this.createTrailMesh("portTrail", 0xccbf99);
    this.starboardTrailMesh = this.createTrailMesh("starboardTrail", 0xccbf99);
    this.centerTrailMesh = this.createTrailMesh("centerTrail", 0x997f52);

    // --- Foam points ---
    this.foamPositions = new Float32Array(MAX_FOAM * 3);
    this.foamSizes = new Float32Array(MAX_FOAM);
    this.foamAlphas = new Float32Array(MAX_FOAM);
    const foamGeom = new THREE.BufferGeometry();
    foamGeom.setAttribute("position", new THREE.Float32BufferAttribute(this.foamPositions, 3));
    foamGeom.setAttribute("size", new THREE.Float32BufferAttribute(this.foamSizes, 1));
    foamGeom.setAttribute("alpha", new THREE.Float32BufferAttribute(this.foamAlphas, 1));

    const foamTexture = createFoamTexture();
    const foamMat = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: foamTexture },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTexture;
        varying float vAlpha;
        void main() {
          vec4 texColor = texture2D(uTexture, gl_PointCoord);
          gl_FragColor = vec4(texColor.rgb, texColor.a * vAlpha);
          if (gl_FragColor.a < 0.01) discard;
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.foamPoints = new THREE.Points(foamGeom, foamMat);
    this.foamPoints.frustumCulled = false;
    scene.add(this.foamPoints);

    // --- Bow wave disc ---
    const bowGeom = new THREE.CircleGeometry(1, 16);
    bowGeom.rotateX(-Math.PI / 2);
    const bowMat = new THREE.MeshBasicMaterial({
      color: 0xeee8d5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.bowWave = new THREE.Mesh(bowGeom, bowMat);
    this.bowWave.position.y = WATER_LEVEL + 0.08;
    scene.add(this.bowWave);
  }

  // -----------------------------------------------------------------------
  // Trail mesh creation
  // -----------------------------------------------------------------------

  private createTrailMesh(name: string, color: number): THREE.Mesh {
    const geom = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = name;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  // -----------------------------------------------------------------------
  // Performance toggles
  // -----------------------------------------------------------------------

  public setFoamEnabled(enabled: boolean): void {
    this.foamEnabled = enabled;
    this.foamPoints.visible = enabled;
  }

  public setTrailsEnabled(enabled: boolean): void {
    this.trailsEnabled = enabled;
    this.portTrailMesh.visible = enabled;
    this.starboardTrailMesh.visible = enabled;
    this.centerTrailMesh.visible = enabled;
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------

  public update(
    dt: number,
    boatX: number,
    boatZ: number,
    boatRotation: number,
    boatSpeed: number
  ): void {
    const absSpeed = Math.abs(boatSpeed);
    const sinR = Math.sin(boatRotation);
    const cosR = Math.cos(boatRotation);

    // Stern position (behind boat)
    const sternX = boatX - sinR * 3.0;
    const sternZ = boatZ - cosR * 3.0;

    // Bow position (front of boat)
    const bowX = boatX + sinR * 3.5;
    const bowZ = boatZ + cosR * 3.5;

    // --- Add new trail points when moving ---
    if (absSpeed > 0.03) {
      const spread = 2.0;

      // Port side: Kelvin angle to the left
      const portAngle = boatRotation + Math.PI - KELVIN_ANGLE;
      const portX = sternX + Math.sin(portAngle) * spread;
      const portZ = sternZ + Math.cos(portAngle) * spread;
      this.portTrail.unshift({ x: portX, z: portZ, age: 0, speed: absSpeed });

      // Starboard side: Kelvin angle to the right
      const stbdAngle = boatRotation + Math.PI + KELVIN_ANGLE;
      const stbdX = sternX + Math.sin(stbdAngle) * spread;
      const stbdZ = sternZ + Math.cos(stbdAngle) * spread;
      this.starboardTrail.unshift({ x: stbdX, z: stbdZ, age: 0, speed: absSpeed });

      // Center trail (churned water area)
      this.centerTrail.unshift({ x: sternX, z: sternZ, age: 0, speed: absSpeed });
    }

    // Age and trim all trails
    for (const trail of [this.portTrail, this.starboardTrail, this.centerTrail]) {
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].age += dt;
        if (trail[i].age > TRAIL_MAX_AGE) {
          trail.splice(i, 1);
        }
      }
      while (trail.length > TRAIL_LENGTH) {
        trail.pop();
      }
    }

    // Rebuild ribbon meshes
    this.buildWakeRibbon(this.portTrail, this.portTrailMesh, -1);
    this.buildWakeRibbon(this.starboardTrail, this.starboardTrailMesh, 1);
    this.buildCenterRibbon(this.centerTrail, this.centerTrailMesh);

    // --- Foam particles ---
    this.updateFoamEmission(dt, sternX, sternZ, absSpeed, boatRotation);
    this.updateFoamParticles(dt);

    // --- Bow wave ---
    if (absSpeed > 0.05) {
      const intensity = Math.min(absSpeed / 0.35, 1);
      const scale = 0.5 + intensity * 1.5;
      this.bowWave.position.set(bowX, WATER_LEVEL + 0.08, bowZ);
      this.bowWave.rotation.y = -boatRotation;
      this.bowWave.scale.set(scale * 1.5, 1, scale);
      (this.bowWave.material as THREE.MeshBasicMaterial).opacity = intensity * 0.35;
      this.bowWave.visible = true;
    } else {
      this.bowWave.visible = false;
    }
  }

  // -----------------------------------------------------------------------
  // V-wake ribbon builder
  // -----------------------------------------------------------------------

  private buildWakeRibbon(
    trail: TrailPoint[],
    mesh: THREE.Mesh,
    side: number
  ): void {
    if (trail.length < 3) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    const vertCount = trail.length * 2;
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 4);
    const indices: number[] = [];
    const y = WATER_LEVEL + 0.07;

    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const ageFactor = 1 - p.age / TRAIL_MAX_AGE;
      const baseWidth = 0.3 + p.speed * 2.5;
      const ageSpread = 1 + p.age * 0.3;
      const width = baseWidth * ageSpread * ageFactor;

      // Compute perpendicular direction
      let dx = 0,
        dz = 0;
      if (i < trail.length - 1) {
        dx = trail[i + 1].x - p.x;
        dz = trail[i + 1].z - p.z;
      } else if (i > 0) {
        dx = p.x - trail[i - 1].x;
        dz = p.z - trail[i - 1].z;
      }
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const alpha = ageFactor * 0.6;
      const vi = i * 2;

      // Inner edge
      positions[vi * 3] = p.x;
      positions[vi * 3 + 1] = y;
      positions[vi * 3 + 2] = p.z;
      colors[vi * 4] = 0.78;
      colors[vi * 4 + 1] = 0.72;
      colors[vi * 4 + 2] = 0.58;
      colors[vi * 4 + 3] = alpha;

      // Outer edge
      positions[(vi + 1) * 3] = p.x + nx * width * side;
      positions[(vi + 1) * 3 + 1] = y + 0.04 * ageFactor;
      positions[(vi + 1) * 3 + 2] = p.z + nz * width * side;
      colors[(vi + 1) * 4] = 0.92;
      colors[(vi + 1) * 4 + 1] = 0.88;
      colors[(vi + 1) * 4 + 2] = 0.78;
      colors[(vi + 1) * 4 + 3] = alpha * 0.5;

      if (i < trail.length - 1) {
        indices.push(vi, vi + 1, vi + 2);
        indices.push(vi + 1, vi + 3, vi + 2);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    geom.setIndex(indices);

    // Dispose old geometry and swap
    mesh.geometry.dispose();
    mesh.geometry = geom;
  }

  // -----------------------------------------------------------------------
  // Center churned-water ribbon
  // -----------------------------------------------------------------------

  private buildCenterRibbon(trail: TrailPoint[], mesh: THREE.Mesh): void {
    if (trail.length < 3) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    const vertCount = trail.length * 2;
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 4);
    const indices: number[] = [];
    const y = WATER_LEVEL + 0.05;

    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const ageFactor = 1 - p.age / TRAIL_MAX_AGE;
      const halfWidth =
        (0.8 + p.speed * 2.0) * ageFactor * (1 + p.age * 0.15);

      let dx = 0,
        dz = 0;
      if (i < trail.length - 1) {
        dx = trail[i + 1].x - p.x;
        dz = trail[i + 1].z - p.z;
      } else if (i > 0) {
        dx = p.x - trail[i - 1].x;
        dz = p.z - trail[i - 1].z;
      }
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const alpha = ageFactor * 0.45;
      const vi = i * 2;

      // Left edge
      positions[vi * 3] = p.x + nx * halfWidth;
      positions[vi * 3 + 1] = y;
      positions[vi * 3 + 2] = p.z + nz * halfWidth;
      colors[vi * 4] = 0.55;
      colors[vi * 4 + 1] = 0.45;
      colors[vi * 4 + 2] = 0.28;
      colors[vi * 4 + 3] = alpha;

      // Right edge
      positions[(vi + 1) * 3] = p.x - nx * halfWidth;
      positions[(vi + 1) * 3 + 1] = y;
      positions[(vi + 1) * 3 + 2] = p.z - nz * halfWidth;
      colors[(vi + 1) * 4] = 0.55;
      colors[(vi + 1) * 4 + 1] = 0.45;
      colors[(vi + 1) * 4 + 2] = 0.28;
      colors[(vi + 1) * 4 + 3] = alpha;

      if (i < trail.length - 1) {
        indices.push(vi, vi + 1, vi + 2);
        indices.push(vi + 1, vi + 3, vi + 2);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    geom.setIndex(indices);

    mesh.geometry.dispose();
    mesh.geometry = geom;
  }

  // -----------------------------------------------------------------------
  // Foam particle emission + update
  // -----------------------------------------------------------------------

  private updateFoamEmission(
    dt: number,
    sternX: number,
    sternZ: number,
    absSpeed: number,
    boatRotation: number
  ): void {
    if (absSpeed < 0.03) return;

    const intensity = Math.min(absSpeed / 0.35, 1);
    // Emit rate scales with speed — roughly 60-250 particles/sec
    const emitCount = Math.floor(intensity * 250 * dt);

    const sinR = Math.sin(boatRotation);
    const cosR = Math.cos(boatRotation);

    for (let i = 0; i < emitCount && this.foamParticles.length < MAX_FOAM; i++) {
      const spreadX = (Math.random() - 0.5) * 3.0;
      const spreadZ = (Math.random() - 0.5) * 1.0;
      // Transform spread to world space (behind boat)
      const wx = sternX + cosR * spreadX - sinR * spreadZ;
      const wz = sternZ + sinR * spreadX + cosR * spreadZ;

      // Velocity: mostly backwards + outward
      const localVx = (Math.random() - 0.5) * 1.5;
      const localVz = -(0.3 + Math.random() * 1.5) * intensity;
      const vx = cosR * localVx - sinR * localVz;
      const vz = sinR * localVx + cosR * localVz;

      const life = 2.0 + Math.random() * 3.0;
      this.foamParticles.push({
        x: wx,
        y: WATER_LEVEL + 0.12 + Math.random() * 0.05,
        z: wz,
        vx,
        vy: 0,
        vz,
        life,
        maxLife: life,
        size: (0.5 + Math.random() * 1.5) * (0.5 + intensity),
      });
    }
  }

  private updateFoamParticles(dt: number): void {
    // Age and move particles
    for (let i = this.foamParticles.length - 1; i >= 0; i--) {
      const p = this.foamParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.foamParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      // Slight gravity to keep on water
      p.y += -0.03 * dt;
      if (p.y < WATER_LEVEL + 0.05) p.y = WATER_LEVEL + 0.05;
      // Dampen velocity
      p.vx *= 0.98;
      p.vz *= 0.98;
    }

    // Update GPU buffers
    const posAttr = this.foamPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
    const sizeAttr = this.foamPoints.geometry.getAttribute("size") as THREE.BufferAttribute;
    const alphaAttr = this.foamPoints.geometry.getAttribute("alpha") as THREE.BufferAttribute;

    const count = Math.min(this.foamParticles.length, MAX_FOAM);
    for (let i = 0; i < count; i++) {
      const p = this.foamParticles[i];
      const t = p.life / p.maxLife;
      this.foamPositions[i * 3] = p.x;
      this.foamPositions[i * 3 + 1] = p.y;
      this.foamPositions[i * 3 + 2] = p.z;
      this.foamSizes[i] = p.size;
      this.foamAlphas[i] = t * 0.7; // fade out
    }
    // Zero out unused slots
    for (let i = count; i < MAX_FOAM; i++) {
      this.foamPositions[i * 3 + 1] = -100; // hide below scene
      this.foamSizes[i] = 0;
      this.foamAlphas[i] = 0;
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    this.foamPoints.geometry.setDrawRange(0, count);
  }

  // -----------------------------------------------------------------------
  // Dispose
  // -----------------------------------------------------------------------

  public dispose(): void {
    this.portTrailMesh.geometry.dispose();
    (this.portTrailMesh.material as THREE.Material).dispose();
    this.scene.remove(this.portTrailMesh);

    this.starboardTrailMesh.geometry.dispose();
    (this.starboardTrailMesh.material as THREE.Material).dispose();
    this.scene.remove(this.starboardTrailMesh);

    this.centerTrailMesh.geometry.dispose();
    (this.centerTrailMesh.material as THREE.Material).dispose();
    this.scene.remove(this.centerTrailMesh);

    this.foamPoints.geometry.dispose();
    (this.foamPoints.material as THREE.Material).dispose();
    this.scene.remove(this.foamPoints);

    this.bowWave.geometry.dispose();
    (this.bowWave.material as THREE.Material).dispose();
    this.scene.remove(this.bowWave);
  }
}
