import * as THREE from "three";

export function hexToColor3(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distance2D(
  x1: number,
  z1: number,
  x2: number,
  z2: number
): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Get point on a bezier-interpolated river path at parameter t */
export function getPointOnPath(
  points: [number, number][],
  t: number
): [number, number] {
  const totalSegments = points.length - 1;
  const segT = t * totalSegments;
  const seg = Math.min(Math.floor(segT), totalSegments - 1);
  const localT = segT - seg;

  const p0 = points[Math.max(0, seg - 1)];
  const p1 = points[seg];
  const p2 = points[Math.min(points.length - 1, seg + 1)];
  const p3 = points[Math.min(points.length - 1, seg + 2)];

  // Catmull-Rom interpolation
  const tt = localT * localT;
  const ttt = tt * localT;

  const x =
    0.5 *
    (2 * p1[0] +
      (-p0[0] + p2[0]) * localT +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * tt +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * ttt);
  const z =
    0.5 *
    (2 * p1[1] +
      (-p0[1] + p2[1]) * localT +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * tt +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * ttt);

  return [x, z];
}

/** Check if a point is inside any river */
export function isPointInRiver(
  x: number,
  z: number,
  rivers: { points: [number, number][]; width: number }[]
): boolean {
  for (const river of rivers) {
    const samples = river.points.length * 5;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const [rx, rz] = getPointOnPath(river.points, t);
      const dist = distance2D(x, z, rx, rz);
      if (dist < river.width / 2) {
        return true;
      }
    }
  }
  return false;
}

/** Simple seeded random for deterministic generation */
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
