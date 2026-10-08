import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { METERS_PER_UNIT, WATER_LEVEL } from "../../utils/constants";
import { seededRandom } from "../../utils/helpers";
import { StreamedBatch } from "./StreamedBatch";
import type { Lot } from "./lots";

/** Houses and docks are drawn up to here (the fog hides what is farther). */
const FAR = 230;
/** Small details (stilts, railings, windows, piles) only up to here. */
const NEAR = 75;
/** Designed in meters: one meter in world units. */
const M = 1 / METERS_PER_UNIT;

const c = (hex: string) => Color3.FromHexString(hex);
/** Painted wood of island houses: whites, creams, the Delta greens, reds and blues. */
const WOOD_PAINT = ["#f1ece0", "#e9dfc6", "#5f7f5a", "#2f5d46", "#9b3b2f", "#c8a24a", "#4f6f8f", "#7b5537", "#d9d4c7"].map(c);
const VARNISH = ["#6b4226", "#80522f", "#5a3820"].map(c);
const MASONRY = ["#f3f0e8", "#ede4d3", "#e8d9c2", "#f6efe4"].map(c);
const SHEET_ROOF = ["#8e2f25", "#2f5b3d", "#6d7377", "#3f4c5a", "#a24a2a"].map(c);
const TILE_ROOF = ["#a4532e", "#94452a", "#b5643a"].map(c);
const TRIM = ["#f4f1ea", "#2b2b2b", "#e8e2d4"].map(c);
const GLASS = c("#1d2a33");
const PILE = c("#4a3a2c");
const DECK = ["#8a6a48", "#7a5c3f", "#9b7b56", "#6f5944"].map(c);
const RAIL = c("#e8e2d4");
const FLOAT = c("#9aa3a7");

export interface SettlementOptions {
  /** World y of the island ground. */
  groundY: number;
  /** Gardens in flower (spring and summer): santa ritas by the houses. */
  flowers?: boolean;
  /** Marinas and boat clubs (OSM water areas): filled with rows of moored boats. */
  marinas?: Array<{ outer: Array<[number, number]>; isWater: (x: number, z: number) => boolean }>;
}

/** Colors of the boats you see moored in the Delta: white fibreglass, some blue, red, varnished wood. */
const HULL = ["#f2f2ee", "#f2f2ee", "#eceae2", "#2f4f7a", "#9b2f26", "#6b4226", "#e8e2d0"].map(c);
/** Santa rita (bougainvillea) colours: magenta, fuchsia, pink, orange. */
const BLOOM = ["#c2186b", "#d63384", "#e05a9b", "#e8743b", "#b5179e"].map(c);
/** Painted docks: red, white, green, blue (photos of the Delta). */
const PAINT = ["#a8322c", "#efebe2", "#2f6a4a", "#2f4f7a"].map(c);

/**
 * The houses and private docks of the Delta (ADR 0011): procedural houses
 * of four kinds (palafito, isleña, material, alpina) facing the river, each
 * with its own muelle of one of five kinds (simple, with a glorieta, in T,
 * a floating pontón, or just steps down the bank). Everything goes into
 * a handful of streamed batches: a few draw calls for the whole Delta, and
 * only what is around the camera is uploaded.
 */
export class Settlement {
  private far: StreamedBatch;
  private gables: StreamedBatch;
  private near: StreamedBatch;
  private glass: StreamedBatch;
  /** Pontones and moored boats: they rise and fall with the tide. */
  private floating: StreamedBatch;
  private hulls: StreamedBatch;
  private blooms: StreamedBatch;
  private batches: StreamedBatch[];

  constructor(scene: Scene, readonly lots: Lot[], private o: SettlementOptions) {
    this.far = new StreamedBatch("casas", scene, { radius: FAR });
    this.gables = new StreamedBatch("casasHastiales", scene, { radius: FAR, shape: "prism" });
    this.near = new StreamedBatch("casasDetalles", scene, { radius: NEAR });
    this.glass = new StreamedBatch("casasVentanas", scene, { radius: NEAR, specular: 0.5 });
    this.floating = new StreamedBatch("pontones", scene, { radius: FAR });
    this.hulls = new StreamedBatch("lanchasAmarradas", scene, { radius: FAR, shape: "hull", specular: 0.3 });
    this.blooms = new StreamedBatch("santaRitas", scene, { radius: NEAR * 1.6, shape: "blob", specular: 0.05, emissive: new Color3(0.08, 0.02, 0.05) });
    this.batches = [this.far, this.gables, this.near, this.glass, this.floating, this.hulls, this.blooms];
    for (const lot of lots) {
      const rng = seededRandom(lot.seed || 1);
      this.house(lot, rng);
      this.dock(lot, rng);
    }
    for (const m of o.marinas ?? []) this.marina(m);
    for (const b of this.batches) b.build();
  }

  /** Streams around the camera; pontones follow the river level. */
  update(cameraX: number, cameraZ: number, level: number): void {
    for (const b of this.batches) b.update(cameraX, cameraZ);
    this.floating.mesh.position.y = level;
    this.hulls.mesh.position.y = level;
  }

  get stats(): { instances: number; visible: number } {
    return {
      instances: this.batches.reduce((n, b) => n + b.total, 0),
      visible: this.batches.reduce((n, b) => n + b.visible, 0),
    };
  }

  private house(lot: Lot, rng: () => number): void {
    const parent = Matrix.Scaling(M, M, M)
      .multiply(Matrix.RotationY(lot.rotation + (rng() - 0.5) * 0.25))
      .multiply(Matrix.Translation(lot.hx, this.o.groundY, lot.hz));
    const pick = <T>(list: T[]) => list[Math.floor(rng() * list.length)];
    // Santa ritas (bougainvillea) climbing by the house in spring and summer (photos)
    if (this.o.flowers && rng() < 0.55) {
      const color = pick(BLOOM);
      for (let k = 0, n = 2 + Math.floor(rng() * 3); k < n; k++) {
        const a = rng() * Math.PI * 2;
        const size = 1.4 + rng() * 1.6;
        this.blooms.add(parent, [size, size * (1.1 + rng() * 0.6), size], [Math.cos(a) * 5.5, size * 0.55, Math.sin(a) * 5 + 1], color);
      }
    }
    switch (lot.house) {
      case "palafito":
        return this.palafito(parent, rng, pick(WOOD_PAINT), pick(SHEET_ROOF), pick(TRIM));
      case "isleña":
        return this.islena(parent, rng, pick(rng() < 0.5 ? VARNISH : WOOD_PAINT), pick(SHEET_ROOF));
      case "material":
        return this.material(parent, rng, pick(MASONRY), pick(TILE_ROOF));
      case "alpina":
        return this.alpina(parent, rng, pick(VARNISH), pick(SHEET_ROOF));
    }
  }

  /** Gable roof of two sheets over a W x D plan, ridge along z, eaves at height y. */
  private gableRoof(parent: Matrix, w: number, d: number, rise: number, y: number, zc: number, color: Color3, wall: Color3 | null): void {
    const over = 0.45;
    const half = w / 2 + over;
    const slope = Math.atan2(rise, w / 2);
    const len = Math.hypot(half, rise * (half / (w / 2)));
    for (const side of [-1, 1]) {
      this.far.add(parent, [len, 0.12, d + 2 * over], [(side * half) / 2, y + rise / 2 - (over * rise) / w, zc], color, [0, 0, -side * slope]);
    }
    if (wall) this.gables.add(parent, [w, rise, d], [0, y, zc], wall);
  }

  /** Windows on a wall: `count` along `span`, centered at (x, y, z), facing ±z or ±x. */
  private windows(parent: Matrix, count: number, span: number, at: [number, number, number], facing: "z" | "x"): void {
    for (let k = 0; k < count; k++) {
      const off = count === 1 ? 0 : -span / 2 + (span * k) / (count - 1);
      const pos: [number, number, number] = facing === "z" ? [at[0] + off, at[1], at[2]] : [at[0], at[1], at[2] + off];
      const size: [number, number, number] = facing === "z" ? [1.1, 1.1, 0.12] : [0.12, 1.1, 1.1];
      this.glass.add(parent, size, pos, GLASS);
      // White frame below the window
      const sill: [number, number, number] = facing === "z" ? [1.35, 0.12, 0.18] : [0.18, 0.12, 1.35];
      this.near.add(parent, sill, [pos[0], pos[1] - 0.62, pos[2]], RAIL);
    }
  }

  /** Railing along both sides of a walkway (only when the dock is painted). */
  private railing(parent: Matrix, width: number, from: number, to: number, deckY: number, paint: Color3 | null): void {
    if (!paint) return;
    for (const side of [-1, 1]) {
      const x = (side * width) / 2;
      this.near.add(parent, [0.08, 0.08, to - from], [x, deckY + 0.95, (from + to) / 2], paint);
      for (let z = from + 0.3; z <= to; z += 1.6) this.near.add(parent, [0.08, 0.95, 0.08], [x, deckY + 0.5, z], paint);
    }
  }

  /** Steps from the end of a dock down into the water (photo: the red deck with stairs). */
  private stepsDown(parent: Matrix, end: number, deckY: number, plank: Color3, paint: Color3 | null): void {
    const steps = Math.max(2, Math.round(deckY / 0.3));
    for (let k = 1; k <= steps; k++) {
      this.near.add(parent, [1.1, 0.08, 0.32], [0, deckY - k * (deckY / steps), end + 0.15 + k * 0.3], plank);
    }
    for (const side of [-1, 1]) {
      const run = steps * 0.3;
      this.near.add(parent, [0.07, 0.07, Math.hypot(run, deckY + 0.9)], [side * 0.58, deckY / 2 + 0.45, end + run / 2 + 0.15], paint ?? PILE, [Math.atan2(deckY, run), 0, 0]);
    }
  }

  /** Stilts in a grid under a W x D floor. */
  private stilts(parent: Matrix, w: number, d: number, h: number, zc: number): void {
    for (const sx of [-0.45, 0, 0.45]) {
      for (const sz of [-0.45, 0, 0.45]) {
        this.near.add(parent, [0.28, h + 0.6, 0.28], [sx * w, (h - 0.6) / 2, zc + sz * d], PILE);
      }
    }
  }

  /** Front railing of a gallery, with posts holding the roof. */
  private gallery(parent: Matrix, w: number, depth: number, floor: number, zFront: number, height: number, trim: Color3): void {
    this.near.add(parent, [w, 0.1, 0.1], [0, floor + 1.0, zFront], trim);
    this.near.add(parent, [w, 0.08, 0.08], [0, floor + 0.5, zFront], trim);
    for (const side of [-1, 1]) {
      this.near.add(parent, [0.1, 0.1, depth], [(side * w) / 2, floor + 1.0, zFront - depth / 2], trim);
    }
    for (const px of [-0.5, -0.17, 0.17, 0.5]) this.near.add(parent, [0.16, height, 0.16], [px * w, floor + height / 2, zFront], trim);
  }

  /** Palafito: painted wooden house on stilts, front gallery, sheet-metal gable roof facing the river. */
  private palafito(parent: Matrix, rng: () => number, paint: Color3, roof: Color3, trim: Color3): void {
    const w = 7 + rng() * 3.5;
    const d = 6.5 + rng() * 3;
    const h = 1.6 + rng() * 0.9;
    const wall = 2.6;
    const gal = 2.2 + rng() * 0.6;
    this.stilts(parent, w, d + gal, h, gal / 2);
    this.far.add(parent, [w + 0.2, 0.25, d + gal], [0, h, gal / 2], DECK[0]);
    this.far.add(parent, [w, wall, d], [0, h + wall / 2, 0], paint);
    this.gableRoof(parent, w, d + gal, 1.6 + rng() * 0.8, h + wall, gal / 2, roof, paint);
    this.gallery(parent, w, gal, h, d / 2 + gal, wall, trim);
    this.near.add(parent, [1.0, 2.05, 0.12], [0, h + 1.05, d / 2 + 0.02], VARNISH[0]);
    this.windows(parent, 2, w * 0.55, [0, h + 1.5, d / 2 + 0.03], "z");
    this.windows(parent, 2, d * 0.5, [w / 2 + 0.03, h + 1.5, 0], "x");
    this.windows(parent, 2, d * 0.5, [-w / 2 - 0.03, h + 1.5, 0], "x");
    // A wooden ladder against the side too (photo: palafito with its ladder)
    const lx = w / 2 + 0.35;
    for (const dz of [-0.35, 0.35]) this.near.add(parent, [0.08, h + 1.1, 0.08], [lx, (h + 1.1) / 2, -d * 0.2 + dz], VARNISH[1], [0, 0, -0.12]);
    for (let y = 0.35; y < h + 0.6; y += 0.35) this.near.add(parent, [0.06, 0.05, 0.7], [lx - y * 0.12, y, -d * 0.2], VARNISH[1]);
    // Stairs down from the gallery towards the river
    const run = h * 1.2;
    this.near.add(parent, [1.1, 0.18, Math.hypot(run, h)], [w * 0.3, h / 2, d / 2 + gal + run / 2], DECK[1], [Math.atan2(h, run), 0, 0]);
  }

  /** Isleña: small, low and simple, single-pitch roof. */
  private islena(parent: Matrix, rng: () => number, paint: Color3, roof: Color3): void {
    const w = 5 + rng() * 2;
    const d = 4.5 + rng() * 1.5;
    const h = 0.9 + rng() * 0.5;
    const wall = 2.4;
    this.stilts(parent, w, d + 1.5, h, 0.75);
    this.far.add(parent, [w + 0.2, 0.22, d + 1.5], [0, h, 0.75], DECK[2]);
    this.far.add(parent, [w, wall, d], [0, h + wall / 2, 0], paint);
    const pitch = 0.22;
    this.far.add(parent, [w + 0.9, 0.12, (d + 2.4) / Math.cos(pitch)], [0, h + wall + 0.45, 0.6], roof, [pitch, 0, 0]);
    this.near.add(parent, [0.9, 1.95, 0.12], [w * 0.2, h + 1.0, d / 2 + 0.02], TRIM[2]);
    this.windows(parent, 1, 0, [-w * 0.22, h + 1.4, d / 2 + 0.03], "z");
    this.near.add(parent, [w, 0.08, 0.08], [0, h + 0.95, d / 2 + 1.5], RAIL);
  }

  /** Casa de material: white walls on a raised plinth, tile roof, larger windows. */
  private material(parent: Matrix, rng: () => number, paint: Color3, roof: Color3): void {
    const w = 9 + rng() * 4;
    const d = 8 + rng() * 3;
    const h = 1.2 + rng() * 0.6;
    const wall = 2.9;
    this.far.add(parent, [w + 0.4, h, d + 0.4], [0, h / 2, 0], c("#c9c2b4"));
    this.far.add(parent, [w, wall, d], [0, h + wall / 2, 0], paint);
    this.gableRoof(parent, w, d, 1.9 + rng() * 0.7, h + wall, 0, roof, paint);
    // Terrace in front, with a white balustrade
    this.far.add(parent, [w * 0.8, h, 3], [0, h / 2, d / 2 + 1.5], c("#bdb5a6"));
    this.near.add(parent, [w * 0.8, 0.9, 0.18], [0, h + 0.45, d / 2 + 3], paint);
    this.near.add(parent, [1.2, 2.2, 0.12], [0, h + 1.1, d / 2 + 0.02], VARNISH[1]);
    this.windows(parent, 2, w * 0.6, [0, h + 1.6, d / 2 + 0.03], "z");
    this.windows(parent, 2, d * 0.55, [w / 2 + 0.03, h + 1.6, 0], "x");
    this.windows(parent, 2, d * 0.55, [-w / 2 - 0.03, h + 1.6, 0], "x");
  }

  /** Alpina: the A-frame chalets of the islands, steep roof down to the floor, glazed gable. */
  private alpina(parent: Matrix, rng: () => number, wood: Color3, roof: Color3): void {
    const w = 7 + rng() * 2;
    const d = 8 + rng() * 3;
    const h = 1.5 + rng() * 0.8;
    const rise = w * (0.85 + rng() * 0.2);
    this.stilts(parent, w, d + 2, h, 1);
    this.far.add(parent, [w + 1, 0.25, d + 2], [0, h, 1], DECK[3]);
    this.gables.add(parent, [w - 0.3, rise - 0.3, d], [0, h + 0.1, 0], wood);
    const slope = Math.atan2(rise, w / 2);
    const len = Math.hypot(w / 2 + 0.4, rise + 0.4);
    for (const side of [-1, 1]) {
      this.far.add(parent, [len, 0.15, d + 0.8], [(side * (w / 2 + 0.4)) / 2, h + rise / 2, 0], roof, [0, 0, -side * slope]);
    }
    // Glass gable on the river side
    this.glass.add(parent, [w * 0.45, rise * 0.45, 0.1], [0, h + rise * 0.35, d / 2 + 0.02], GLASS);
    this.near.add(parent, [w + 1, 0.1, 0.1], [0, h + 1.0, d / 2 + 2], RAIL);
  }

  /**
   * A small boat moored alongside: hull (floating with the tide), a console
   * and windshield or a cabin. In metres, inside `parent`, bow towards +z.
   */
  private mooredBoat(parent: Matrix, x: number, z: number, rng: () => number, heading = 0): void {
    const len = 4.5 + rng() * 3;
    const beam = 1.7 + rng() * 0.6;
    const local = Matrix.RotationY(heading).multiply(Matrix.Translation(x, 0, z)).multiply(parent);
    const color = HULL[Math.floor(rng() * HULL.length)];
    this.hulls.add(local, [beam, 0.9, len], [0, -0.35, 0], color);
    if (rng() < 0.6) {
      // Open boat: console and a windshield
      this.floating.add(local, [0.6, 0.8, 0.6], [0, 0.85, -len * 0.05], c("#e9e6dc"));
      this.floating.add(local, [0.7, 0.35, 0.08], [0, 1.4, len * 0.05], GLASS);
    } else {
      // Little cabin
      this.floating.add(local, [beam * 0.75, 0.8, len * 0.38], [0, 0.95, len * 0.05], c("#efece4"));
    }
  }

  /** Rows of moored boats with pontoons between them, inside a marina's water. */
  private marina(m: { outer: Array<[number, number]>; isWater: (x: number, z: number) => boolean }): void {
    const xs = m.outer.map((p) => p[0]);
    const zs = m.outer.map((p) => p[1]);
    const rng = seededRandom(Math.floor(Math.abs(xs[0] * 1000 + zs[0])) + 7);
    const inside = (x: number, z: number) => pointIn(m.outer, x, z) && m.isWater(x, z);
    const slot = 3.2 * M; // a berth every 3.2 m
    const row = 18 * M; // pontoon rows every 18 m
    for (let z = Math.min(...zs) + row / 2; z < Math.max(...zs); z += row) {
      let run = 0;
      for (let x = Math.min(...xs); x < Math.max(...xs); x += slot) {
        if (!inside(x, z) || !inside(x, z + 6 * M) || !inside(x, z - 6 * M)) {
          run = 0;
          continue;
        }
        const parent = Matrix.Scaling(M, M, M).multiply(Matrix.Translation(x, WATER_LEVEL, z));
        // Floating pontoon along the row, boats on both sides
        this.floating.add(parent, [3.2, 0.4, 1.6], [0, 0.2, 0], FLOAT);
        for (const side of [-1, 1]) if (rng() < 0.85) this.mooredBoat(parent, 0, side * 4.3, rng, side > 0 ? 0 : Math.PI);
        run++;
      }
    }
  }

  private dock(lot: Lot, rng: () => number): void {
    // Origin on the shoreline at the water level, +z towards the water
    const parent = Matrix.Scaling(M, M, M)
      .multiply(Matrix.RotationY(lot.rotation))
      .multiply(Matrix.Translation(lot.x, WATER_LEVEL, lot.z));
    const bank = (this.o.groundY - WATER_LEVEL) / M;
    const deckY = bank - 0.15;
    const plank = DECK[Math.floor(rng() * DECK.length)];
    const len = lot.dockLength / M;
    const width = 1.5 + rng() * 0.6;
    // Painted railings on about half the docks (red, white, green, blue)
    const paint = rng() < 0.55 ? PAINT[Math.floor(rng() * PAINT.length)] : null;
    const walkway = (from: number, to: number, wd: number, x = 0) => {
      this.far.add(parent, [wd, 0.18, to - from], [x, deckY, (from + to) / 2], plank);
      for (let z = from + 0.4; z <= to; z += 2.2) {
        for (const side of [-1, 1]) this.near.add(parent, [0.2, deckY + 2, 0.2], [x + (side * wd) / 2, deckY - 1, z], PILE);
      }
    };
    switch (lot.dock) {
      case "bajada": {
        // Wooden steps down the bank to the water
        this.near.add(parent, [1.2, 0.2, Math.hypot(1.4, bank)], [0, bank / 2, 0.2], plank, [Math.atan2(bank, 1.4), 0, 0]);
        return;
      }
      case "simple": {
        walkway(-1, len, width);
        this.railing(parent, width, -1, len, deckY, paint);
        this.stepsDown(parent, len, deckY, plank, paint);
        if (rng() < 0.65) this.mooredBoat(parent, width / 2 + 1.3, len - 2, rng);
        return;
      }
      case "te": {
        walkway(-1, len - 1, width);
        const head = 5 + rng() * 3;
        this.far.add(parent, [head, 0.18, 2.2], [0, deckY, len], plank);
        for (const x of [-head / 2, 0, head / 2]) this.near.add(parent, [0.22, deckY + 2, 0.22], [x, deckY - 1, len + 0.9], PILE);
        // Bollards for mooring
        for (const x of [-head / 2 + 0.4, head / 2 - 0.4]) this.near.add(parent, [0.25, 0.45, 0.25], [x, deckY + 0.3, len + 0.8], c("#2b2b2b"));
        this.railing(parent, width, -1, len - 1, deckY, paint);
        // Moored along the head of the T
        if (rng() < 0.8) this.mooredBoat(parent, 0, len + 2.4, rng, Math.PI / 2);
        return;
      }
      case "glorieta": {
        walkway(-1, len - 1.5, width);
        // Square deck with a little roof at the end: the Delta's quincho over the water
        const s = 3.2;
        this.far.add(parent, [s, 0.2, s], [0, deckY, len], plank);
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          this.near.add(parent, [0.16, 2.4, 0.16], [(x * s) / 2.2, deckY + 1.2, len + (z * s) / 2.2], RAIL);
          this.near.add(parent, [0.22, deckY + 2, 0.22], [(x * s) / 2.2, deckY - 1, len + (z * s) / 2.2], PILE);
        }
        this.near.add(parent, [s, 0.08, 0.08], [0, deckY + 0.95, len + s / 2], RAIL);
        const roof = SHEET_ROOF[Math.floor(rng() * SHEET_ROOF.length)];
        this.gables.add(parent, [s + 0.6, 1.2, s + 0.6], [0, deckY + 2.4, len], roof);
        this.stepsDown(parent, len + s / 2 - 0.4, deckY, plank, paint);
        if (rng() < 0.5) this.mooredBoat(parent, s / 2 + 1.3, len, rng);
        return;
      }
      case "ponton": {
        // Fixed walkway out from the bank, a ramp down to a pontoon that floats with the tide
        const fixed = Math.max(1, len - 6);
        walkway(-1, fixed, width);
        const ramp = 3.5;
        this.near.add(parent, [1.1, 0.12, Math.hypot(ramp, deckY - 0.45)], [0, (deckY + 0.45) / 2, fixed + ramp / 2], plank, [Math.atan2(deckY - 0.45, ramp), 0, 0]);
        const pw = 5 + rng() * 3;
        this.floating.add(parent, [pw, 0.5, 2.6], [0, 0.15, fixed + ramp + 1.3], FLOAT);
        this.floating.add(parent, [pw, 0.1, 2.6], [0, 0.45, fixed + ramp + 1.3], plank);
        if (rng() < 0.85) this.mooredBoat(parent, 0, fixed + ramp + 4, rng, Math.PI / 2);
        return;
      }
    }
  }
}

function pointIn(ring: Array<[number, number]>, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
