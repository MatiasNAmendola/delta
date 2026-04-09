/**
 * DeltaTrees -- Realistic Delta de Tigre tree species using @dgreenheck/ez-tree.
 *
 * Provides five distinct species native to the Parana Delta region:
 *   - Sauce lloron (Weeping willow) -- drooping branches, wide canopy
 *   - Ceibo (Erythrina crista-galli) -- gnarled trunk, red flowers
 *   - Timbo (Enterolobium contortisiliquum) -- massive spreading canopy
 *   - Casuarina -- tall columnar, needle-like foliage
 *   - Alamo (Poplar) -- tall columnar, dense upright branches
 *
 * Each species returns a THREE.Group ready for scene insertion via createTreeLOD.
 *
 * Parameter values are derived from the actual ez-tree preset JSON files
 * (oak_large, pine_large, aspen_large, ash_small, etc.) and tuned for each
 * species' real-world growth habit.
 */
import * as THREE from "three";
import {
  Tree,
  BarkType,
  LeafType,
  Billboard,
  TreeType,
} from "@dgreenheck/ez-tree";

// The ez-tree d.ts has a broken declaration for LeafType where Pine and Oak
// are exported as Pine_1/Oak_1 with malformed alias syntax.  We use the
// actual runtime values directly via const aliases.
const LeafTypePine: string = (LeafType as Record<string, string>).Pine ?? LeafType.Pine_1;
const LeafTypeOak: string = (LeafType as Record<string, string>).Oak ?? LeafType.Oak_1;

// ---------------------------------------------------------------------------
//  Species type
// ---------------------------------------------------------------------------
export type DeltaSpecies = "sauce" | "ceibo" | "timbo" | "casuarina" | "alamo";

// ---------------------------------------------------------------------------
//  Type matching TreeOptions shape so we can pass to loadFromJson safely.
//  TreeOptions is not exported from ez-tree, so we define a compatible
//  structural type.  The copy() method on TreeOptions deep-merges only
//  keys that exist on both source and target via hasOwnProperty, so
//  partial trellis objects (just { enabled: false }) are safe.
// ---------------------------------------------------------------------------
interface EzTreeOptionsLike {
  seed: number;
  type: string;
  bark: {
    type: string;
    tint: number;
    flatShading: boolean;
    textured: boolean;
    textureScale: { x: number; y: number };
  };
  branch: {
    levels: number;
    angle: { 1: number; 2: number; 3: number };
    children: { 0: number; 1: number; 2: number };
    force: {
      direction: { x: number; y: number; z: number };
      strength: number;
    };
    gnarliness: { 0: number; 1: number; 2: number; 3: number };
    length: { 0: number; 1: number; 2: number; 3: number };
    radius: { 0: number; 1: number; 2: number; 3: number };
    sections: { 0: number; 1: number; 2: number; 3: number };
    segments: { 0: number; 1: number; 2: number; 3: number };
    start: { 1: number; 2: number; 3: number };
    taper: { 0: number; 1: number; 2: number; 3: number };
    twist: { 0: number; 1: number; 2: number; 3: number };
  };
  leaves: {
    type: string;
    billboard: string;
    angle: number;
    count: number;
    start: number;
    size: number;
    sizeVariance: number;
    tint: number;
    alphaTest: number;
  };
  trellis: { enabled: boolean };
}

// ---------------------------------------------------------------------------
//  Ez-tree option sets for each species.
//
//  Values are based on the shipped ez-tree presets (oak_large, pine_large,
//  aspen_large, ash_small, etc.) and adjusted to match each Delta species'
//  real-world silhouette.  The copy() method on TreeOptions deep-merges
//  these onto its defaults, so every field present here overrides the
//  corresponding default.
// ---------------------------------------------------------------------------

/**
 * Sauce lloron (Weeping willow)
 * Drooping branches with a wide spreading canopy, found along water edges.
 * Height ~8-12 m.  Bark: willow.  Leaves: ash (elongated frond shape).
 *
 * Key characteristics modelled:
 *   - Downward force (gravity droop) via negative-Y force direction
 *   - High gnarliness at outer levels for organic droop
 *   - Wide branch angles at levels 2-3 for the "weeping" curtain
 *   - Moderate trunk with many level-1 children for full canopy
 */
function sauceOptions(seed: number): EzTreeOptionsLike {
  return {
    seed,
    type: TreeType.Deciduous,
    bark: {
      type: BarkType.Willow,
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
      type: LeafType.Ash,
      billboard: Billboard.Double,
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
 * Argentina's national tree.  Gnarled, twisted trunk; spreading branches;
 * distinctive red flowers (tinted leaves).  Height ~6-10 m.
 * Bark: oak (rough fissured).  Leaves: oak (broad lobed) tinted red-coral.
 *
 * Key characteristics modelled:
 *   - High gnarliness on trunk and level 1 for the twisted, tortuous form
 *   - Moderate upward force to keep crown above water line
 *   - Red-tinted leaves representing the ceibo's iconic flowers
 *   - Thick trunk radius relative to height
 */
function ceiboOptions(seed: number): EzTreeOptionsLike {
  return {
    seed,
    type: TreeType.Deciduous,
    bark: {
      type: BarkType.Oak,
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
      type: LeafType.Oak,
      billboard: Billboard.Double,
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
 * Massive spreading canopy, broad crown, thick trunk.  Height ~15-20 m.
 * Bark: oak (massive ridged).  Leaves: ash (compound pinnate).
 *
 * Key characteristics modelled:
 *   - Based on oak_large preset pattern: tall trunk, many children,
 *     wide angles, large branch lengths
 *   - Very thick trunk radius (2.8) with strong taper
 *   - Moderate force and twist for organic, asymmetric crown
 */
function timboOptions(seed: number): EzTreeOptionsLike {
  return {
    seed,
    type: TreeType.Deciduous,
    bark: {
      type: BarkType.Oak,
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
      type: LeafType.Ash,
      billboard: Billboard.Double,
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
 * Height ~12-18 m.  Bark: pine (furrowed).  Leaves: pine (needle sprays).
 *
 * Key characteristics modelled:
 *   - Based on pine_large preset pattern: evergreen type, single trunk
 *     level (levels: 1), many children on level 0, conical taper
 *   - High child count (70) with steep branch angle (110) for the
 *     dense conical silhouette typical of casuarinas
 *   - Slight upward force to maintain columnar habit
 */
function casuarinaOptions(seed: number): EzTreeOptionsLike {
  return {
    seed,
    type: TreeType.Evergreen,
    bark: {
      type: BarkType.Pine,
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
      type: LeafType.Pine,
      billboard: Billboard.Double,
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
 * Alamo (Populus spp. -- Poplar)
 * Tall, narrow columnar crown.  Upward-angled branches with dense foliage.
 * Height ~12-18 m.  Bark: birch (smooth silvery).  Leaves: aspen (round, trembling).
 *
 * Key characteristics modelled:
 *   - Based on aspen_large preset: birch bark, 2-level branching,
 *     relatively narrow angles, high branch start point (0.45) to
 *     create the columnar habit with a bare lower trunk
 *   - Light upward force for the characteristic spire silhouette
 *   - Many leaves on the outermost branches for dense foliage
 */
function alamoOptions(seed: number): EzTreeOptionsLike {
  return {
    seed,
    type: TreeType.Deciduous,
    bark: {
      type: BarkType.Birch,
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
      type: LeafType.Aspen,
      billboard: Billboard.Double,
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
const SPECIES_OPTIONS: Record<DeltaSpecies, (seed: number) => EzTreeOptionsLike> = {
  sauce: sauceOptions,
  ceibo: ceiboOptions,
  timbo: timboOptions,
  casuarina: casuarinaOptions,
  alamo: alamoOptions,
};

/**
 * Approximate real-world scale factor so that ez-tree internal units map to
 * metres in our scene.  ez-tree branch.length values are large (20-60) so we
 * scale the resulting group down.  Each species gets an additional per-species
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
 * Leaf color string per species -- used by the LOD billboard level so the
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
 * textures and alpha-cutout leaf materials.  It is **not** added to any scene;
 * the caller is responsible for placement and LOD wrapping.
 *
 * Internally this calls `tree.loadFromJson(opts)` which deep-copies the
 * options onto TreeOptions defaults (via its `copy()` method) and then calls
 * `generate()`.  The Tree class extends THREE.Group, so the returned object
 * can be used directly as a group.
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

  // loadFromJson() internally does:
  //   1. this.options.copy(json)   -- deep-merges our partial onto defaults
  //   2. this.generate()           -- builds geometry (branches + leaves meshes)
  //
  // The copy() method iterates own enumerable keys of the source and only
  // writes those that also exist on the target (TreeOptions defaults).
  // Our EzTreeOptionsLike interface matches the TreeOptions shape exactly,
  // so the cast to any below is safe.  We keep it because TreeOptions is
  // not exported from the ez-tree package.
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
