/**
 * Things streamed around the camera (trees, houses, reeds, docks) fade in
 * and out instead of popping: near the edge of their radius, a growing
 * share of their pixels is dropped with a fine screen-space dither, so
 * they dissolve into the fog. The same dither cross-fades a tree's near
 * and far versions (one takes exactly the pixels the other leaves).
 *
 * A Babylon material plugin: works with Standard and PBR materials, thin
 * instances included (it uses the fragment's world position).
 */
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import type { Material } from "@babylonjs/core/Materials/material";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";

class FadeDefines extends MaterialDefines {
  DISTANCEFADE = false;
}

export interface FadeRange {
  /** Fully visible up to `fadeStart`, gone at `fadeEnd` (world units, horizontal distance to the camera). */
  fadeStart: number;
  fadeEnd: number;
  /**
   * Cross-fade with another level of detail around `lod`: "near" shows only
   * closer than it, "far" only beyond it, blending over ±lodBand.
   */
  lod?: { at: number; band: number; side: "near" | "far" };
}

export class DistanceFadePlugin extends MaterialPluginBase {
  private range: FadeRange;

  constructor(material: Material, range: FadeRange) {
    super(material, "DistanceFade", 210, new FadeDefines());
    this.range = range;
    this._enable(true);
  }

  prepareDefines(defines: FadeDefines): void {
    defines.DISTANCEFADE = true;
  }

  getClassName(): string {
    return "DistanceFadePlugin";
  }

  getUniforms() {
    return {
      ubo: [
        { name: "fadeFar", size: 2, type: "vec2" },
        { name: "fadeLod", size: 3, type: "vec3" },
      ],
      fragment: `#ifdef DISTANCEFADE
        uniform vec2 fadeFar;
        uniform vec3 fadeLod;
      #endif`,
    };
  }

  bindForSubMesh(ubo: UniformBuffer): void {
    const r = this.range;
    ubo.updateFloat2("fadeFar", r.fadeStart, r.fadeEnd);
    const side = r.lod ? (r.lod.side === "near" ? -1 : 1) : 0;
    ubo.updateFloat3("fadeLod", r.lod?.at ?? 0, r.lod?.band ?? 1, side);
  }

  getCustomCode(shaderType: string) {
    if (shaderType !== "fragment") return null;
    return {
      CUSTOM_FRAGMENT_MAIN_BEGIN: `
        #ifdef DISTANCEFADE
          float fadeDist = distance(vPositionW.xz, vEyePosition.xz);
          float fadeVis = 1.0 - smoothstep(fadeFar.x, fadeFar.y, fadeDist);
          if (fadeLod.z != 0.0) {
            float t = smoothstep(fadeLod.x - fadeLod.y, fadeLod.x + fadeLod.y, fadeDist);
            fadeVis *= fadeLod.z > 0.0 ? t : 1.0 - t;
          }
          // Interleaved gradient noise: a fine, stable dither per pixel
          float fadeNoise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          if (fadeNoise >= fadeVis) discard;
        #endif
      `,
    };
  }
}

/** Adds the fade to a material (call before it is first compiled or frozen). */
export function addDistanceFade(material: Material, range: FadeRange): DistanceFadePlugin {
  return new DistanceFadePlugin(material, range);
}
