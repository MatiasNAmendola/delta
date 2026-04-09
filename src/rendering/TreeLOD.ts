/**
 * TreeLOD — Level-of-Detail helper for procedural trees.
 *
 * Three LOD levels:
 *   Close  (<40 m) : Full ProcTree mesh (trunk + twig geometry)
 *   Medium (<120 m): Billboard — two crossed planes with a tree-colored texture
 *   Far    (<400 m): Single colored sprite / point
 *
 * Uses THREE.LOD which automatically switches based on camera distance.
 */
import * as THREE from "three";

// Shared billboard texture — created once
let billboardTexture: THREE.CanvasTexture | null = null;

function getTreeBillboardTexture(): THREE.CanvasTexture {
  if (billboardTexture) return billboardTexture;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size * 1.5;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Trunk
  const trunkW = size * 0.08;
  const trunkH = size * 0.6;
  ctx.fillStyle = "#6b4226";
  ctx.fillRect(
    canvas.width / 2 - trunkW / 2,
    canvas.height - trunkH,
    trunkW,
    trunkH
  );

  // Canopy (layered circles for organic look)
  const canopyCenterY = canvas.height * 0.35;
  const canopyRadius = size * 0.38;

  // Simple seeded RNG
  let seed = 42;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 20; i++) {
    const ox = (rng() - 0.5) * canopyRadius * 1.2;
    const oy = (rng() - 0.5) * canopyRadius * 0.9;
    const r = canopyRadius * (0.3 + rng() * 0.5);
    const g = 60 + Math.floor(rng() * 80);
    const rb = 15 + Math.floor(rng() * 30);
    const b = 10 + Math.floor(rng() * 20);
    ctx.fillStyle = `rgba(${rb}, ${g}, ${b}, 0.7)`;
    ctx.beginPath();
    ctx.arc(canvas.width / 2 + ox, canopyCenterY + oy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  billboardTexture = tex;
  return tex;
}

// Shared sprite material for the far-distance point
let farSpriteMaterial: THREE.SpriteMaterial | null = null;

function getFarSpriteMaterial(): THREE.SpriteMaterial {
  if (farSpriteMaterial) return farSpriteMaterial;

  // Simple 16x16 green dot texture
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  const grad = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  grad.addColorStop(0, "rgba(50, 120, 40, 0.9)");
  grad.addColorStop(1, "rgba(40, 100, 30, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;

  farSpriteMaterial = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return farSpriteMaterial;
}

/** LOD distance thresholds */
const LOD_CLOSE = 0;    // full mesh
const LOD_MED = 50;     // billboard
const LOD_FAR = 140;    // sprite

/**
 * Create a THREE.LOD node that wraps a full-detail tree group,
 * a billboard, and a far sprite.
 *
 * @param fullDetailGroup  The full ProcTree group (trunk + twigs). Will be consumed.
 * @param treeHeight       Approximate height for sizing billboards/sprites.
 * @param leafColor        Hex color string for tinting the billboard.
 */
export function createTreeLOD(
  fullDetailGroup: THREE.Group,
  treeHeight: number,
  leafColor?: string
): THREE.LOD {
  const lod = new THREE.LOD();

  // --- Level 0: full detail ---
  lod.addLevel(fullDetailGroup, LOD_CLOSE);

  // --- Level 1: billboard (two crossed planes) ---
  const bbGroup = createBillboard(treeHeight, leafColor);
  lod.addLevel(bbGroup, LOD_MED);

  // --- Level 2: far sprite ---
  const sprite = new THREE.Sprite(getFarSpriteMaterial());
  sprite.scale.set(treeHeight * 0.6, treeHeight * 0.8, 1);
  sprite.position.y = treeHeight * 0.4;
  const spriteWrap = new THREE.Group();
  spriteWrap.add(sprite);
  lod.addLevel(spriteWrap, LOD_FAR);

  return lod;
}

function createBillboard(height: number, _leafColor?: string): THREE.Group {
  const tex = getTreeBillboardTexture();

  const w = height * 0.7;
  const h = height;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const geom = new THREE.PlaneGeometry(w, h);

  // Shift geometry up so base is at y=0
  geom.translate(0, h / 2, 0);

  const plane1 = new THREE.Mesh(geom, mat);
  const plane2 = new THREE.Mesh(geom, mat);
  plane2.rotation.y = Math.PI / 2;

  const group = new THREE.Group();
  group.add(plane1);
  group.add(plane2);
  return group;
}
