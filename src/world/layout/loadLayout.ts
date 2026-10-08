import type { WorldDoc } from "../WorldDoc";
import { decodeLayout } from "./layoutCodec";
import { computeWorldLayout, hashText, LAYOUT_VERSION, type WorldLayout } from "./worldLayout";

export type LayoutOrigin = "precalculado" | "worker" | "en vivo";

/**
 * The world layout: the baked file when it matches this World Doc (fast:
 * download and unpack), else computed in a Web Worker, else on this thread.
 */
export async function loadLayout(world: WorldDoc): Promise<{ layout: WorldLayout; origin: LayoutOrigin }> {
  const source = hashText(JSON.stringify(world));
  const skipBaked = new URLSearchParams(window.location.search).get("bake") === "0";
  if (!skipBaked) {
    try {
      const base = document.querySelector("base")?.href || window.location.href;
      const res = await fetch(new URL(`worlds/${world.world.id}.layout.bin`, base));
      if (res.ok) {
        const layout = decodeLayout(await gunzipIfNeeded(new Uint8Array(await res.arrayBuffer())));
        if (layout.version === LAYOUT_VERSION && layout.source === source) return { layout, origin: "precalculado" };
        console.warn("Baked world layout is stale; computing it");
      }
    } catch (error) {
      console.warn("No baked world layout:", error);
    }
  }
  try {
    return { layout: await computeInWorker(world, source), origin: "worker" };
  } catch (error) {
    console.warn("Layout worker failed, computing on the main thread:", error);
    return { layout: computeWorldLayout(world, source), origin: "en vivo" };
  }
}

async function gunzipIfNeeded(bytes: Uint8Array): Promise<Uint8Array> {
  // Some servers already undo the gzip (Content-Encoding); only unpack real gzip data
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function computeInWorker(world: WorldDoc, source: string): Promise<WorldLayout> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./layoutWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorldLayout>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ world, source });
  });
}
