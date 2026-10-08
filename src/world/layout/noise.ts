/**
 * Value noise shared by the world layout (computed at build time) and the
 * renderer. Pure and deterministic: the same numbers in Node and browsers.
 */

/** Simple value noise for coherent terrain patterns, 0..1. */
export function noise2D(x: number, z: number, seed: number): number {
  const hash = (ix: number, iz: number) => {
    let h = ix * 374761393 + iz * 668265263 + seed * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
  };
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const v00 = hash(ix, iz);
  const v10 = hash(ix + 1, iz);
  const v01 = hash(ix, iz + 1);
  const v11 = hash(ix + 1, iz + 1);
  return v00 * (1 - sx) * (1 - sz) + v10 * sx * (1 - sz) + v01 * (1 - sx) * sz + v11 * sx * sz;
}

/** Multi-octave fractal noise, roughly 0..1. */
export function fbm(x: number, z: number, octaves: number, seed: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, z * frequency, seed + i * 31) * amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
