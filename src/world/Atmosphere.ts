/**
 * Atmosphere — God rays (light shafts) and ambient floating particles.
 *
 * God rays are implemented as a screen-space radial gradient sprite
 * placed at the sun's projected position with additive blending.
 *
 * Ambient particles are ~200 small floating dust/pollen/insect sprites
 * rendered via THREE.Points, gently drifting with wind. Only visible
 * close to the camera for a subtle, immersive feel.
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// God Rays — additive-blended sprite at the sun's screen position
// ---------------------------------------------------------------------------

function createGodRayTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Radial gradient — bright centre fading to transparent edges
  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  grad.addColorStop(0, 'rgba(255,255,220,1.0)');
  grad.addColorStop(0.15, 'rgba(255,240,180,0.7)');
  grad.addColorStop(0.4, 'rgba(255,220,140,0.25)');
  grad.addColorStop(0.7, 'rgba(255,200,120,0.07)');
  grad.addColorStop(1.0, 'rgba(255,180,100,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Add subtle radial streaks (light shaft impression)
  ctx.globalCompositeOperation = 'lighter';
  const rays = 24;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const len = size * 0.48;
    const x2 = cx + Math.cos(angle) * len;
    const y2 = cy + Math.sin(angle) * len;
    const lineGrad = ctx.createLinearGradient(cx, cy, x2, y2);
    lineGrad.addColorStop(0, 'rgba(255,245,200,0.12)');
    lineGrad.addColorStop(0.5, 'rgba(255,230,160,0.04)');
    lineGrad.addColorStop(1.0, 'rgba(255,210,130,0.0)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 6 + Math.random() * 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Ambient particle texture — tiny soft dot
// ---------------------------------------------------------------------------

function createDustTexture(): THREE.CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, size / 2);
  grad.addColorStop(0, 'rgba(255,255,240,0.9)');
  grad.addColorStop(0.4, 'rgba(255,250,220,0.4)');
  grad.addColorStop(1.0, 'rgba(255,245,200,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 200;
const PARTICLE_RADIUS = 30; // metres around the camera
const PARTICLE_Y_MIN = -1;
const PARTICLE_Y_MAX = 8;

// ---------------------------------------------------------------------------
// Atmosphere class
// ---------------------------------------------------------------------------

export class Atmosphere {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;

  // God rays
  private godRaySprite: THREE.Sprite;
  private godRayMaterial: THREE.SpriteMaterial;
  private sunScreenPos = new THREE.Vector3();

  // Ambient particles
  private particlePoints: THREE.Points;
  private particleGeometry: THREE.BufferGeometry;
  private particlePositions: Float32Array;
  private particleSpeeds: Float32Array; // per-particle random factor
  private particlePhases: Float32Array; // random phase offset
  private elapsedTime = 0;

  // Wind direction (radians) — slowly drifts
  private windAngle = 0;
  private windSpeed = 0.4; // m/s base

  constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    // ---- God ray sprite ----
    const godRayTex = createGodRayTexture();
    this.godRayMaterial = new THREE.SpriteMaterial({
      map: godRayTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      depthTest: false,
    });
    this.godRaySprite = new THREE.Sprite(this.godRayMaterial);
    this.godRaySprite.scale.set(120, 120, 1);
    this.godRaySprite.frustumCulled = false;
    this.godRaySprite.renderOrder = 999;
    scene.add(this.godRaySprite);

    // ---- Ambient particles ----
    this.particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    this.particleSpeeds = new Float32Array(PARTICLE_COUNT);
    this.particlePhases = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Random positions — will be re-centred on camera each frame
      this.particlePositions[i * 3] = (Math.random() - 0.5) * PARTICLE_RADIUS * 2;
      this.particlePositions[i * 3 + 1] = PARTICLE_Y_MIN + Math.random() * (PARTICLE_Y_MAX - PARTICLE_Y_MIN);
      this.particlePositions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_RADIUS * 2;
      this.particleSpeeds[i] = 0.3 + Math.random() * 0.7;
      this.particlePhases[i] = Math.random() * Math.PI * 2;
    }

    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

    const dustTex = createDustTexture();
    const dustMaterial = new THREE.PointsMaterial({
      map: dustTex,
      size: 0.25,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.particlePoints = new THREE.Points(this.particleGeometry, dustMaterial);
    this.particlePoints.frustumCulled = false;
    scene.add(this.particlePoints);
  }

  // --------------------------------------------------------------------------
  // update() — called each frame
  // --------------------------------------------------------------------------

  public update(dt: number, sunPosition: THREE.Vector3, boatX: number, boatZ: number): void {
    this.elapsedTime += dt;

    this.updateGodRays(dt, sunPosition);
    this.updateParticles(dt, boatX, boatZ);
  }

  // --------------------------------------------------------------------------
  // God rays
  // --------------------------------------------------------------------------

  private updateGodRays(dt: number, sunPosition: THREE.Vector3): void {
    const sunDir = sunPosition.clone().normalize();

    // Place the sprite far along the sun direction so it appears behind everything
    const spriteDistance = 600;
    this.godRaySprite.position.copy(sunDir).multiplyScalar(spriteDistance);
    // Offset to camera world position so it stays centred on sun from camera POV
    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    this.godRaySprite.position.add(camPos);

    // Determine visibility: sun must be above horizon and in front of camera
    const sunElevation = sunDir.y; // 0 = horizon, 1 = zenith
    const isSunUp = sunElevation > 0.02;

    // Fade based on elevation: strongest when sun is low-medium, fades at zenith
    let intensityByElevation = 0;
    if (isSunUp) {
      if (sunElevation < 0.15) {
        // Rising / setting — ramp up
        intensityByElevation = THREE.MathUtils.smoothstep(sunElevation, 0.02, 0.15);
      } else if (sunElevation < 0.5) {
        intensityByElevation = 1.0;
      } else {
        // High noon — fade a bit
        intensityByElevation = THREE.MathUtils.lerp(1.0, 0.4, (sunElevation - 0.5) / 0.5);
      }
    }

    // Check if sun is roughly in the camera's forward hemisphere
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    const dot = camDir.dot(sunDir);
    const facingSun = THREE.MathUtils.smoothstep(dot, -0.1, 0.3);

    const targetOpacity = intensityByElevation * facingSun * 0.35;

    // Smooth the opacity to avoid popping
    this.godRayMaterial.opacity += (targetOpacity - this.godRayMaterial.opacity) * Math.min(1, dt * 2);

    // Tint: golden at low sun, whiter at high sun
    const golden = THREE.MathUtils.clamp(1.0 - sunElevation * 2, 0, 1);
    this.godRayMaterial.color.setRGB(
      1.0,
      0.85 + golden * 0.15,
      0.6 + (1 - golden) * 0.35,
    );

    // Subtle scale pulsation
    const pulse = 1.0 + Math.sin(this.elapsedTime * 0.3) * 0.05;
    const baseScale = 100 + intensityByElevation * 60;
    this.godRaySprite.scale.setScalar(baseScale * pulse);
  }

  // --------------------------------------------------------------------------
  // Ambient particles
  // --------------------------------------------------------------------------

  private updateParticles(dt: number, boatX: number, boatZ: number): void {
    // Slowly vary wind direction
    this.windAngle += (Math.sin(this.elapsedTime * 0.07) * 0.3) * dt;

    const windDx = Math.cos(this.windAngle) * this.windSpeed;
    const windDz = Math.sin(this.windAngle) * this.windSpeed;

    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const speed = this.particleSpeeds[i];
      const phase = this.particlePhases[i];

      // Gentle drift with wind
      this.particlePositions[i3] += windDx * speed * dt;
      this.particlePositions[i3 + 2] += windDz * speed * dt;

      // Slow vertical bob (pollen / dust floating)
      this.particlePositions[i3 + 1] += Math.sin(this.elapsedTime * 0.8 + phase) * 0.15 * dt;

      // Small lateral wobble
      this.particlePositions[i3] += Math.sin(this.elapsedTime * 1.2 + phase * 2) * 0.08 * dt;
      this.particlePositions[i3 + 2] += Math.cos(this.elapsedTime * 0.9 + phase * 3) * 0.08 * dt;

      // Wrap particles around the camera so they stay close
      const dx = this.particlePositions[i3] - camPos.x;
      const dz = this.particlePositions[i3 + 2] - camPos.z;
      const dy = this.particlePositions[i3 + 1] - camPos.y;

      if (dx > PARTICLE_RADIUS) this.particlePositions[i3] -= PARTICLE_RADIUS * 2;
      else if (dx < -PARTICLE_RADIUS) this.particlePositions[i3] += PARTICLE_RADIUS * 2;

      if (dz > PARTICLE_RADIUS) this.particlePositions[i3 + 2] -= PARTICLE_RADIUS * 2;
      else if (dz < -PARTICLE_RADIUS) this.particlePositions[i3 + 2] += PARTICLE_RADIUS * 2;

      // Keep within vertical band relative to camera
      if (dy > PARTICLE_Y_MAX) {
        this.particlePositions[i3 + 1] = camPos.y + PARTICLE_Y_MIN + Math.random() * 2;
      } else if (dy < PARTICLE_Y_MIN - 2) {
        this.particlePositions[i3 + 1] = camPos.y + PARTICLE_Y_MAX - Math.random() * 2;
      }
    }

    const posAttr = this.particleGeometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
  }

  // --------------------------------------------------------------------------
  // Dispose
  // --------------------------------------------------------------------------

  public dispose(): void {
    this.scene.remove(this.godRaySprite);
    this.godRayMaterial.map?.dispose();
    this.godRayMaterial.dispose();

    this.scene.remove(this.particlePoints);
    this.particleGeometry.dispose();
    const mat = this.particlePoints.material as THREE.PointsMaterial;
    mat.map?.dispose();
    mat.dispose();
  }
}
