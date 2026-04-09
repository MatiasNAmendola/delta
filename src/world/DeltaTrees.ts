/**
 * DeltaTrees — Realistic Delta de Tigre tree species using @dgreenheck/ez-tree.
 *
 * Provides five distinct species native to the Parana Delta region:
 *   - Sauce lloron (Weeping willow) — drooping branches, wide canopy
 *   - Ceibo (Erythrina crista-galli) — gnarled trunk, red flowers
 *   - Timbo (Enterolobium contortisiliquum) — massive spreading canopy
 *   - Casuarina — tall columnar, needle-like foliage
 *   - Alamo (Poplar) — tall columnar, dense upright branches
 *
 * Each species returns a THREE.Group ready for scene insertion via createTreeLOD.
 */
import * as THREE from "three";
import { Tree } from "@dgreenheck/ez-tree";

// ---------------------------------------------------------------------------
//  Species type
// ---------------------------------------------------------------------------
export type DeltaSpecies = "sauce" | "ceibo" | "timbo" | "casuarina" | "alamo";

// ---------------------------------------------------------------------------
//  Ez-tree option partials for each species (deep-merged onto TreeOptions defaults)
// ---------------------------------------------------------------------------

/**
 * Sauce lloron (Weeping willow)
 * Drooping branches, wide spreading canopy, found along water edges.
 * Height ~8-12 m. Bark: willow. Leaves: ash (elongated shape).
 */
function sauceOptions(seed: number): Record<string, any> {
  return {
    seed,
    type: "deciduous",
    bark: {
      type: "willow",
      tint: 0xc8b89a,
      flatShading: false,
      textured: true,
      textureScale: { x: 1, y: 6 },
    },
    branch: {
      levels: 3,
      angle: { 1: 65, 2: 75, 3: 80 },
      children: { 0: 8, 1: 6, 2: 4 },
      force: {
        direction: { x: 0, y: -1, z: 0 },
        strength: 0.04,
      },
      gnarliness: { 0: 0.08, 1: 0.18, 2: 0.35, 3: 0.05 },
      length: { 0: 18, 1: 14, 2: 10, 3: 4 },
      radius: { 0: 1.0, 1: 0.55, 2: 0.5, 3: 0.6 },
      sections: { 0: 10, 1: 8, 2: 6, 3: 4 },
      segments: { 0: 8, 1: 5, 2: 4, 3: 3 },
      start: { 1: 0.3, 2: 0.15, 3: 0.0 },
      taper: { 0: 0.65, 1: 0.55, 2: 0.6, 3: 0.7 },
      twist: { 0: 0.1, 1: 0.15, 2: 0.1, 3: 0 },
    },
    leaves: {
      type: "ash",
      billboard: "double",
      angle: 55,
      count: 14,
      start: 0.1,
      size: 3.0,
      sizeVariance: 0.6,
      tint: 0x5a9e3a,
      alphaTest: 0.45,
    },
    trellis: { enabled: false },
  };
}

/**
 * Ceibo (Erythrina crista-galli)
 * Argentina's national tree. Gnarled, twisted trunk; spreading branches;
 * distinctive red flowers (tinted leaves). Height ~6-10 m.
 * Bark: oak (rough). Leaves: oak (broad lobed) tinted red-coral.
 */
function ceiboOptions(seed: number): Record<string, any> {
  return {
    seed,
    type: "deciduous",
    bark: {
      type: "oak",
      tint: 0xa08060,
      flatShading: false,
      textured: true,
      textureScale: { x: 1.2, y: 4 },
    },
    branch: {
      levels: 3,
      angle: { 1: 55, 2: 50, 3: 40 },
      children: { 0: 6, 1: 5, 2: 3 },
      force: {
        direction: { x: 0, y: 1, z: 0 },
        strength: -0.015,
      },
      gnarliness: { 0: 0.25, 1: 0.35, 2: 0.3, 3: 0.1 },
      length: { 0: 14, 1: 12, 2: 8, 3: 3.5 },
      radius: { 0: 1.4, 1: 0.65, 2: 0.6, 3: 0.8 },
      sections: { 0: 10, 1: 8, 2: 6, 3: 3 },
      segments: { 0: 8, 1: 5, 2: 4, 3: 3 },
      start: { 1: 0.25, 2: 0.15, 3: 0.0 },
      taper: { 0: 0.6, 1: 0.5, 2: 0.65, 3: 0.7 },
      twist: { 0: 0.3, 1: 0.2, 2: 0.1, 3: 0 },
    },
    leaves: {
      type: "oak",
      billboard: "double",
      angle: 40,
      count: 10,
      start: 0.12,
      size: 3.5,
      sizeVariance: 0.5,
      tint: 0xcc3333,
      alphaTest: 0.45,
    },
    trellis: { enabled: false },
  };
}

/**
 * Timbo (Enterolobium contortisiliquum)
 * Massive spreading canopy, broad crown, thick trunk. Height ~15-20 m.
 * Bark: oak (massive ridged). Leaves: ash (compound pinnate).
 */
function timboOptions(seed: number): Record<string, any> {
  return {
    seed,
    type: "deciduous",
    bark: {
      type: "oak",
      tint: 0xb09878,
      flatShading: false,
      textured: true,
      textureScale: { x: 1, y: 8 },
    },
    branch: {
      levels: 3,
      angle: { 1: 60, 2: 50, 3: 35 },
      children: { 0: 10, 1: 6, 2: 4 },
      force: {
        direction: { x: 0, y: 1, z: 0 },
        strength: -0.02,
      },
      gnarliness: { 0: 0.06, 1: 0.14, 2: 0.2, 3: 0.08 },
      length: { 0: 40, 1: 28, 2: 16, 3: 6 },
      radius: { 0: 2.8, 1: 0.7, 2: 0.65, 3: 1.0 },
      sections: { 0: 14, 1: 10, 2: 8, 3: 4 },
      segments: { 0: 10, 1: 6, 2: 4, 3: 3 },
      start: { 1: 0.35, 2: 0.1, 3: 0.0 },
      taper: { 0: 0.7, 1: 0.45, 2: 0.65, 3: 0.75 },
      twist: { 0: -0.15, 1: 0.2, 2: 0, 3: 0 },
    },
    leaves: {
      type: "ash",
      billboard: "double",
      angle: 32,
      count: 16,
      start: 0.1,
      size: 4.0,
      sizeVariance: 0.6,
      tint: 0x3d8c28,
      alphaTest: 0.5,
    },
    trellis: { enabled: false },
  };
}

/**
 * Casuarina (Casuarina cunninghamiana)
 * Tall columnar/conical shape, thin needle-like drooping foliage.
 * Height ~12-18 m. Bark: pine (furrowed). Leaves: pine (needle sprays).
 */
function casuarinaOptions(seed: number): Record<string, any> {
  return {
    seed,
    type: "evergreen",
    bark: {
      type: "pine",
      tint: 0xb0a090,
      flatShading: false,
      textured: true,
      textureScale: { x: 1, y: 5 },
    },
    branch: {
      levels: 1,
      angle: { 1: 110, 2: 20, 3: 60 },
      children: { 0: 70, 1: 4, 2: 0 },
      force: {
        direction: { x: 0, y: 1, z: 0 },
        strength: 0.012,
      },
      gnarliness: { 0: 0.04, 1: 0.06, 2: 0, 3: 0 },
      length: { 0: 55, 1: 22, 2: 12, 3: 1 },
      radius: { 0: 0.9, 1: 0.3, 2: 0.7, 3: 0.7 },
      sections: { 0: 12, 1: 8, 2: 6, 3: 4 },
      segments: { 0: 7, 1: 5, 2: 4, 3: 3 },
      start: { 1: 0.2, 2: 0.1, 3: 0.3 },
      taper: { 0: 0.7, 1: 0.7, 2: 0.7, 3: 0.7 },
      twist: { 0: 0.05, 1: 0, 2: 0, 3: 0 },
    },
    leaves: {
      type: "pine",
      billboard: "double",
      angle: 20,
      count: 14,
      start: 0.05,
      size: 2.2,
      sizeVariance: 0.3,
      tint: 0x3a6e30,
      alphaTest: 0.35,
    },
    trellis: { enabled: false },
  };
}

/**
 * Alamo (Populus spp. — Poplar)
 * Tall, narrow columnar crown. Upward-angled branches with dense foliage.
 * Height ~12-18 m. Bark: birch (smooth silvery). Leaves: aspen (round, trembling).
 */
function alamoOptions(seed: number): Record<string, any> {
  return {
    seed,
    type: "deciduous",
    bark: {
      type: "birch",
      tint: 0xe0ddd0,
      flatShading: false,
      textured: true,
      textureScale: { x: 1, y: 3 },
    },
    branch: {
      levels: 2,
      angle: { 1: 30, 2: 40, 3: 10 },
      children: { 0: 12, 1: 7, 2: 0 },
      force: {
        direction: { x: 0, y: 1, z: 0 },
        strength: 0.035,
      },
      gnarliness: { 0: 0.03, 1: 0.05, 2: 0.1, 3: 0.02 },
      length: { 0: 55, 1: 16, 2: 8, 3: 1 },
      radius: { 0: 1.0, 1: 0.5, 2: 0.7, 3: 0.7 },
      sections: { 0: 12, 1: 8, 2: 6, 3: 4 },
      segments: { 0: 7, 1: 5, 2: 4, 3: 3 },
      start: { 1: 0.45, 2: 0.1, 3: 0 },
      taper: { 0: 0.72, 1: 0.2, 2: 0.7, 3: 0.7 },
      twist: { 0: 0, 1: 0, 2: 0, 3: 0 },
    },
    leaves: {
      type: "aspen",
      billboard: "double",
      angle: 30,
      count: 18,
      start: 0.15,
      size: 2.8,
      sizeVariance: 0.5,
      tint: 0x68b848,
      alphaTest: 0.5,
    },
    trellis: { enabled: false },
  };
}

// ---------------------------------------------------------------------------
//  Lookup table: species -> options factory
// ---------------------------------------------------------------------------
const SPECIES_OPTIONS: Record<DeltaSpecies, (seed: number) => Record<string, any>> = {
  sauce: sauceOptions,
  ceibo: ceiboOptions,
  timbo: timboOptions,
  casuarina: casuarinaOptions,
  alamo: alamoOptions,
};

/**
 * Approximate real-world scale factor so that ez-tree internal units map to
 * metres in our scene. ez-tree branch.length values are large (20-60) so we
 * scale the resulting group down. Each species gets an additional per-species
 * multiplier to achieve the correct real-world height.
 *
 *   sauce:      8-12 m   (weeping willow)
 *   ceibo:      6-10 m   (national tree)
 *   timbo:     15-20 m   (massive canopy)
 *   casuarina: 12-18 m   (columnar)
 *   alamo:     12-18 m   (poplar)
 */
const SPECIES_SCALE: Record<DeltaSpecies, { base: number; variance: number }> = {
  sauce:      { base: 0.30, variance: 0.10 },
  ceibo:      { base: 0.28, variance: 0.08 },
  timbo:      { base: 0.32, variance: 0.08 },
  casuarina:  { base: 0.22, variance: 0.06 },
  alamo:      { base: 0.22, variance: 0.06 },
};

/**
 * Leaf color string per species — used by the LOD billboard level so the
 * distant placeholder matches the close-up tree tint.
 */
export const SPECIES_LEAF_COLOR: Record<DeltaSpecies, string> = {
  sauce:     "#5a9e3a",
  ceibo:     "#cc3333",
  timbo:     "#3d8c28",
  casuarina: "#3a6e30",
  alamo:     "#68b848",
};

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

/**
 * Generate a fully formed Delta tree (THREE.Group) for the given species.
 *
 * The returned group includes trunk + leaves meshes with realistic bark
 * textures and alpha-cutout leaf materials. It is **not** added to any scene;
 * the caller is responsible for placement and LOD wrapping.
 *
 * @param species  One of the five Delta species keys.
 * @param seed     Integer seed for deterministic variation.
 * @param rngValue A 0-1 value used for scale variance (pass from caller's RNG).
 * @returns `{ group, height, leafColor }` ready for scene / LOD insertion.
 */
export function createDeltaTree(
  species: DeltaSpecies,
  seed: number,
  rngValue: number = 0.5,
): { group: THREE.Group; height: number; leafColor: string } {
  const optionsFn = SPECIES_OPTIONS[species];
  const opts = optionsFn(seed);

  const tree = new Tree();
  // loadFromJson internally does a deep copy/merge onto defaults, so partial is fine.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tree.loadFromJson(opts as any);

  const scaleInfo = SPECIES_SCALE[species];
  const scale = scaleInfo.base + (rngValue - 0.5) * scaleInfo.variance * 2;
  tree.scale.setScalar(scale);
  tree.name = `delta_${species}_${seed}`;

  // Approximate the height after scaling for LOD billboard sizing.
  // The trunk length (level 0) gives a reasonable proxy.
  const approxHeight = opts.branch.length[0] * scale * 1.3;

  return {
    group: tree,
    height: approxHeight,
    leafColor: SPECIES_LEAF_COLOR[species],
  };
}

/**
 * Convenience: list of all available Delta species.
 */
export const ALL_DELTA_SPECIES: DeltaSpecies[] = [
  "sauce", "ceibo", "timbo", "casuarina", "alamo",
];
