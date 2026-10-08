import { Scene } from "@babylonjs/core/scene";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas";
import { mulberry32 } from "./treeGenerator";

/**
 * Leaf card textures painted with canvas strokes: transparent background,
 * hundreds of small leaves or needles, lighter at the top where the sun
 * hits and darker inside. White-ish greens: the tree's per-vertex tint
 * gives each species and individual its color.
 */
export type LeafStyle = "fronda" | "casuarina" | "sauce" | "alamo";

const SIZE = 256;

export function createLeafTexture(scene: Scene, style: LeafStyle): DynamicTexture {
  const tex = new DynamicTexture(`hojas_${style}`, SIZE, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, SIZE, SIZE);
  const rng = mulberry32(style.length * 977 + 13);
  switch (style) {
    case "fronda":
      paintClump(ctx, rng, { leaves: 420, leafLen: [9, 15], leafWidth: 0.45, radius: 0.44 });
      break;
    case "alamo":
      paintClump(ctx, rng, { leaves: 520, leafLen: [7, 11], leafWidth: 0.7, radius: 0.42 });
      break;
    case "casuarina":
      paintNeedles(ctx, rng);
      break;
    case "sauce":
      paintStrands(ctx, rng);
      break;
  }
  tex.update(true);
  tex.hasAlpha = true;
  return tex;
}

/** Filled ellipse (the typed canvas interface has no ellipse()). */
function leaf(ctx: ICanvasRenderingContext, x: number, y: number, rx: number, ry: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(rx, ry);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Leaf colour: darker deep in the clump, lighter on top. */
function leafColor(rng: () => number, light: number): string {
  const v = 0.55 + light * 0.4 + (rng() - 0.5) * 0.18;
  const r = Math.round(170 * v);
  const g = Math.round(235 * v);
  const b = Math.round(150 * v);
  return `rgb(${r},${g},${b})`;
}

function paintClump(
  ctx: ICanvasRenderingContext,
  rng: () => number,
  o: { leaves: number; leafLen: [number, number]; leafWidth: number; radius: number }
): void {
  const c = SIZE / 2;
  // A few twigs inside the clump
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgb(90,80,60)";
  for (let k = 0; k < 6; k++) {
    const a = rng() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c, c + SIZE * 0.25);
    ctx.lineTo(c + Math.cos(a) * SIZE * 0.3, c + Math.sin(a) * SIZE * 0.3);
    ctx.stroke();
  }
  // Leaves, back to front: inner (dark) first, outer and upper (light) last
  for (let i = 0; i < o.leaves; i++) {
    const t = i / o.leaves;
    const rad = Math.sqrt(rng()) * SIZE * o.radius * (0.6 + 0.4 * t);
    // Irregular, lumpy outline instead of a perfect disc
    const a = rng() * Math.PI * 2;
    const lump = 1 + 0.18 * Math.sin(a * 5 + 1.3) + 0.1 * Math.sin(a * 9);
    const x = c + Math.cos(a) * rad * lump;
    const y = c + Math.sin(a) * rad * lump * 0.92;
    const light = (1 - y / SIZE) * 0.7 + t * 0.3;
    const len = o.leafLen[0] + rng() * (o.leafLen[1] - o.leafLen[0]);
    ctx.fillStyle = leafColor(rng, light);
    leaf(ctx, x, y, len / 2, (len / 2) * o.leafWidth, rng() * Math.PI);
  }
}

/** Casuarina: fine drooping needles from a few twigs, airy and dark. */
function paintNeedles(ctx: ICanvasRenderingContext, rng: () => number): void {
  const c = SIZE / 2;
  for (let twig = 0; twig < 26; twig++) {
    const a = -Math.PI / 2 + (rng() - 0.5) * 2.6;
    const startR = rng() * SIZE * 0.12;
    const x0 = c + Math.cos(a) * startR;
    const y0 = c * 0.85 + Math.sin(a) * startR;
    const len = SIZE * (0.28 + rng() * 0.18);
    for (let k = 0; k < 34; k++) {
      const t = k / 34;
      // Needles fan out along the twig and droop towards the tip
      const x = x0 + Math.cos(a) * len * t;
      const y = y0 + Math.sin(a) * len * t + t * t * SIZE * 0.25;
      const needle = 12 + rng() * 14;
      const da = Math.PI / 2 + (rng() - 0.5) * 0.9;
      ctx.strokeStyle = leafColor(rng, 1 - y / SIZE);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(da) * needle * 0.4, y + Math.sin(da) * needle);
      ctx.stroke();
    }
  }
}

/** Weeping willow: long vertical strands of narrow leaves, thinning at the bottom. */
function paintStrands(ctx: ICanvasRenderingContext, rng: () => number): void {
  for (let s = 0; s < 34; s++) {
    let x = (0.06 + 0.88 * rng()) * SIZE;
    const sway = (rng() - 0.5) * 0.4;
    const bottom = SIZE * (0.65 + rng() * 0.35);
    ctx.strokeStyle = "rgb(120,140,70)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y < bottom; y += 6) {
      const nx = x + sway * 6 + Math.sin(y * 0.05 + s) * 0.6;
      ctx.lineTo(nx, y);
      // Narrow leaves along the strand, pointing down and out
      if (rng() < 0.9 - (y / bottom) * 0.4) {
        for (const side of [-1, 1]) {
          ctx.fillStyle = leafColor(rng, 1 - (y / SIZE) * 0.6);
          leaf(ctx, nx + side * 3, y + 3, 6 + rng() * 3, 1.6, Math.PI / 2 - side * 0.5);
        }
      }
      x = nx;
    }
    ctx.stroke();
  }
}
