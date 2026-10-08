/**
 * Binary format of a baked world layout: a small JSON header followed by
 * the typed arrays, 4-byte aligned, then gzipped as a whole.
 *
 *   magic "DLY1" | u32 headerLength | header JSON | padding | arrays...
 *
 * Gzip is decompressed in the browser with DecompressionStream (no library).
 */
import { POINT_QUANTUM, type WorldLayout } from "./worldLayout";

const MAGIC = 0x31594c44; // "DLY1" little-endian

type ArrayField = "grid" | "ringStarts" | "shoreSdf" | "shoreMap" | "splat";
const ARRAYS: ArrayField[] = ["grid", "ringStarts", "shoreSdf", "shoreMap", "splat"];
type Typed = Uint8Array | Uint32Array | Float32Array | Int32Array;
const KINDS = { u8: Uint8Array, u32: Uint32Array, f32: Float32Array, i32: Int32Array } as const;
type Kind = keyof typeof KINDS;

function kindOf(a: Typed): Kind {
  if (a instanceof Uint8Array) return "u8";
  if (a instanceof Uint32Array) return "u32";
  if (a instanceof Int32Array) return "i32";
  return "f32";
}

/**
 * Flattens the layout into named typed arrays. Points are stored as
 * quantized deltas (x run then z run) and triangle indices as deltas:
 * small numbers that gzip several times better than raw floats.
 */
function entries(l: WorldLayout): Array<[string, Typed]> {
  return [
    ...ARRAYS.map((k) => [k, l[k]] as [string, Typed]),
    ["points.delta", encodePoints(l.points)],
    ["waterIndices.delta", deltaEncode(l.waterIndices)],
    ["landIndices.delta", deltaEncode(l.landIndices)],
  ];
}

function encodePoints(points: Float32Array): Int32Array {
  const n = points.length / 2;
  const out = new Int32Array(points.length);
  for (let axis = 0; axis < 2; axis++) {
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const q = Math.round(points[i * 2 + axis] * POINT_QUANTUM);
      out[axis * n + i] = q - prev;
      prev = q;
    }
  }
  return out;
}

function decodePoints(deltas: Int32Array): Float32Array {
  const n = deltas.length / 2;
  const out = new Float32Array(deltas.length);
  for (let axis = 0; axis < 2; axis++) {
    let q = 0;
    for (let i = 0; i < n; i++) {
      q += deltas[axis * n + i];
      out[i * 2 + axis] = q / POINT_QUANTUM;
    }
  }
  return out;
}

function deltaEncode(a: Uint32Array): Int32Array {
  const out = new Int32Array(a.length);
  let prev = 0;
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] - prev;
    prev = a[i];
  }
  return out;
}

function deltaDecode(d: Int32Array): Uint32Array {
  const out = new Uint32Array(d.length);
  let v = 0;
  for (let i = 0; i < d.length; i++) {
    v += d[i];
    out[i] = v;
  }
  return out;
}

export function encodeLayout(layout: WorldLayout): Uint8Array {
  const list = entries(layout);
  const header = {
    version: layout.version,
    source: layout.source,
    size: layout.size,
    gridRes: layout.gridRes,
    shoreMapRes: layout.shoreMapRes,
    splatRes: layout.splatRes,
    arrays: list.map(([name, a]) => ({ name, kind: kindOf(a), length: a.length })),
  };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const headerEnd = align4(8 + json.length);
  let total = headerEnd;
  for (const [, a] of list) total = align4(total + a.byteLength);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, json.length, true);
  out.set(json, 8);
  let offset = headerEnd;
  for (const [, a] of list) {
    out.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), offset);
    offset = align4(offset + a.byteLength);
  }
  return out;
}

export function decodeLayout(bytes: Uint8Array): WorldLayout {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) throw new Error("Not a world layout file");
  const jsonLength = view.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + jsonLength)));
  // Copy into an aligned buffer so typed arrays can view it directly
  const buffer = (bytes.byteOffset % 4 === 0 ? bytes.buffer : bytes.slice().buffer) as ArrayBuffer;
  const base = bytes.byteOffset % 4 === 0 ? bytes.byteOffset : 0;
  let offset = align4(8 + jsonLength);
  const arrays = new Map<string, Typed>();
  for (const { name, kind, length } of header.arrays as Array<{ name: string; kind: Kind; length: number }>) {
    const Ctor = KINDS[kind];
    arrays.set(name, new Ctor(buffer, base + offset, length));
    offset = align4(offset + length * Ctor.BYTES_PER_ELEMENT);
  }
  const get = <T extends Typed>(name: string) => arrays.get(name) as T;
  return {
    version: header.version,
    source: header.source,
    size: header.size,
    gridRes: header.gridRes,
    grid: get<Uint8Array>("grid"),
    points: decodePoints(get<Int32Array>("points.delta")),
    ringStarts: get<Uint32Array>("ringStarts"),
    waterIndices: deltaDecode(get<Int32Array>("waterIndices.delta")),
    landIndices: deltaDecode(get<Int32Array>("landIndices.delta")),
    shoreSdf: get<Uint8Array>("shoreSdf"),
    shoreMapRes: header.shoreMapRes,
    shoreMap: get<Uint8Array>("shoreMap"),
    splatRes: header.splatRes,
    splat: get<Uint8Array>("splat"),
  };
}

function align4(n: number): number {
  return (n + 3) & ~3;
}
