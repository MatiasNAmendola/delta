import * as THREE from "three";
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  VignetteEffect,
  SMAAEffect,
  SMAAPreset,
  DepthOfFieldEffect,
  SSAOEffect,
  NormalPass,
  ToneMappingEffect,
  ToneMappingMode,
  BrightnessContrastEffect,
  HueSaturationEffect,
  BlendFunction,
} from "postprocessing";

/**
 * Manages the full postprocessing pipeline for the boat game.
 *
 * Effects included:
 *  1. Bloom        — subtle glow on sun reflections / water highlights
 *  2. Depth of Field — slight bokeh blur on distant objects
 *  3. Color Grading — warm cinematic tint + contrast boost via
 *                     ToneMapping + BrightnessContrast + HueSaturation
 *  4. Vignette     — darkening at screen edges
 *  5. SSAO         — ambient occlusion for depth
 *  6. SMAA         — anti-aliasing to replace the built-in AA
 *
 * The pipeline is toggleable at runtime for low-end devices.
 */
export class PostProcessing {
  private composer: EffectComposer;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  /** When disabled the engine should fall back to renderer.render(). */
  private _enabled = true;

  // Keep references so we can dispose individually if needed
  private renderPass: RenderPass;
  private normalPass: NormalPass;
  private bloomEffect: BloomEffect;
  private dofEffect: DepthOfFieldEffect;
  private ssaoEffect: SSAOEffect;
  private vignetteEffect: VignetteEffect;
  private toneMappingEffect: ToneMappingEffect;
  private brightnessContrastEffect: BrightnessContrastEffect;
  private hueSaturationEffect: HueSaturationEffect;
  private smaaEffect: SMAAEffect;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // --- Composer -----------------------------------------------------------
    this.composer = new EffectComposer(renderer, {
      depthBuffer: true,
      stencilBuffer: true,
      frameBufferType: THREE.HalfFloatType,
      multisampling: 0, // we use SMAA instead of MSAA
    });

    // --- Render pass (renders the scene into the pipeline) ------------------
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // --- Normal pass (needed by SSAO) ---------------------------------------
    this.normalPass = new NormalPass(scene, camera);
    this.composer.addPass(this.normalPass);

    // --- Individual effects -------------------------------------------------

    // 1. Bloom — subtle glow on bright spots (sun reflections, water highlights)
    this.bloomEffect = new BloomEffect({
      intensity: 0.3,
      luminanceThreshold: 0.85,
      luminanceSmoothing: 0.05,
      mipmapBlur: true,
      radius: 0.75,
      levels: 6,
    });

    // 2. Depth of Field — slight blur on distant objects
    this.dofEffect = new DepthOfFieldEffect(camera, {
      focusDistance: 10.0,   // world units — roughly mid-range for a chase cam
      focusRange: 15.0,      // world units — wide range so the boat stays sharp
      bokehScale: 2.0,
      blendFunction: BlendFunction.NORMAL,
    });

    // 3a. Tone mapping — cinematic ACES filmic
    this.toneMappingEffect = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
      whitePoint: 4.0,
    });

    // 3b. Brightness / Contrast — slight contrast boost
    this.brightnessContrastEffect = new BrightnessContrastEffect({
      brightness: 0.0,
      contrast: 0.08,
    });

    // 3c. Hue / Saturation — warm tint (slight positive hue shift toward amber)
    this.hueSaturationEffect = new HueSaturationEffect({
      hue: 0.05,         // small shift toward warm
      saturation: 0.1,   // gentle saturation bump
    });

    // 4. Vignette — subtle darkening at screen edges
    this.vignetteEffect = new VignetteEffect({
      darkness: 0.4,
      offset: 0.35,
    });

    // 5. SSAO — ambient occlusion for depth
    this.ssaoEffect = new SSAOEffect(camera, this.normalPass.texture, {
      radius: 0.5,
      intensity: 1.0,
      luminanceInfluence: 0.6,
      bias: 0.025,
      samples: 16,
      rings: 7,
      blendFunction: BlendFunction.MULTIPLY,
    });

    // 6. SMAA — sub-pixel anti-aliasing
    this.smaaEffect = new SMAAEffect({
      preset: SMAAPreset.MEDIUM,
    });

    // --- Combine effects into passes ----------------------------------------
    // The postprocessing library merges multiple effects into a single shader
    // when they share an EffectPass, which is more efficient.

    // Pass A: SSAO (needs normalPass output, best in its own pass)
    const ssaoPass = new EffectPass(camera, this.ssaoEffect);
    this.composer.addPass(ssaoPass);

    // Pass B: Bloom + DOF + color grading + vignette + SMAA
    const mainEffectsPass = new EffectPass(
      camera,
      this.bloomEffect,
      this.dofEffect,
      this.toneMappingEffect,
      this.brightnessContrastEffect,
      this.hueSaturationEffect,
      this.vignetteEffect,
      this.smaaEffect
    );
    this.composer.addPass(mainEffectsPass);
  }

  // ---- Public API ----------------------------------------------------------

  /** Whether the postprocessing pipeline is active. */
  get enabled(): boolean {
    return this._enabled;
  }

  /** Toggle the entire pipeline on or off at runtime. */
  setEnabled(value: boolean): void {
    this._enabled = value;
  }

  /**
   * Render one frame.
   *
   * When the pipeline is disabled this is a no-op — the caller should fall
   * back to `renderer.render(scene, camera)`.
   *
   * @param deltaTime  Seconds since the last frame (optional).
   */
  render(deltaTime?: number): void {
    if (!this._enabled) return;
    this.composer.render(deltaTime);
  }

  /** Must be called when the window / canvas is resized. */
  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  /** Free GPU resources. */
  dispose(): void {
    this.composer.dispose();
  }
}
