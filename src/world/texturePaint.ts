import type { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { clamp } from "../utils/helpers";

/**
 * Fills a square DynamicTexture in one upload. `shade` writes RGB in 0..1
 * into `out` for pixel (x, y); writing an ImageData is orders of magnitude
 * faster than one fillRect per pixel.
 */
export function paintPixels(
  tex: DynamicTexture,
  size: number,
  shade: (x: number, y: number, out: [number, number, number]) => void
): void {
  const ctx = tex.getContext();
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  const rgb: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      shade(x, y, rgb);
      const k = (y * size + x) * 4;
      data[k] = clamp(rgb[0], 0, 1) * 255;
      data[k + 1] = clamp(rgb[1], 0, 1) * 255;
      data[k + 2] = clamp(rgb[2], 0, 1) * 255;
      data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.update(true);
}

