# Three.js Mobile Performance Research

> Compiled from 35+ sources. Applied to Delta de Tigre boat game.

## Hard Limits for Mobile

| Metric | Mobile Target | Desktop | Notes |
|---|---|---|---|
| Draw calls | < 50-100 | < 500 | Water reflections DOUBLE this |
| Triangles | < 100-200K | < 1M+ | Count with `renderer.info.render.triangles` |
| Textures in GPU | < 20-30 | < 100 | Each Water render target = +1 |
| Texture max size | 1024x1024 | 4096+ | 512 for normal maps |
| Shadow map | 512px or OFF | 1024-2048 | PCFSoft = expensive |
| Pixel ratio (DPR) | 1.0-1.5 | 2.0 | DPR 3 = 9x more pixels |
| Camera far plane | 300-400 | 800+ | Use fog to hide cutoff |
| Post-processing | 0-1 pass | 3-5 | SSAO + DOF = too heavy for mobile |
| InstancedMesh | < 500 per mesh | < 5000 | No per-instance frustum culling |
| iOS memory | ~200-300MB total | Much more | CPU+GPU shared on iOS |

## Critical Optimizations (Ranked by Impact)

### 1. Water Reflections (BIGGEST impact)
Three.js `Water` class re-renders the ENTIRE scene from a mirrored camera every frame. This doubles all draw calls.

**Solutions:**
- Mobile: Use simple animated shader without reflections (120fps on mid-range phones)
- Hide expensive objects during reflection pass:
```javascript
water.onBeforeRender = () => { forestGroup.visible = false; };
water.onAfterRender = () => { forestGroup.visible = true; };
```
- Reduce render target: 128x128 on mobile
- Update reflections every 2-3 frames instead of every frame

### 2. Pixel Ratio
Reducing DPR from 3 to 1.5 = 4x fewer pixels to shade.
```javascript
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
```
Research shows: "Reducing from WQHD to FHD improves from 30fps to 60fps."

### 3. Shadow Maps
Single DirectionalLight shadow at 512px max, or OFF on mobile.
```javascript
renderer.shadowMap.enabled = false; // mobile
// OR
renderer.shadowMap.type = THREE.BasicShadowMap; // cheapest
```

### 4. Material Choice
- Mobile: `MeshLambertMaterial` (no PBR = much cheaper per fragment)
- Desktop: `MeshStandardMaterial` (PBR)

### 5. Draw Call Batching
Merge static geometry (houses, docks) into single BufferGeometry per material.
```javascript
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
```

## Renderer Settings for Mobile

```javascript
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,           // save GPU; use FXAA if needed
  alpha: false,               // opaque = faster compositing
  stencil: false,             // save memory
  depth: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = false;
```

## Touch Events + Rendering

### The Core Problem
WebGL rendering on the main thread. When a frame > 16ms, touch events queue up and UI becomes unresponsive.

### Solutions
1. **CSS `touch-action: manipulation`** on body (NOT `none` — blocks events on Android)
2. **CSS `touch-action: none`** only on the canvas element
3. **Passive event listeners** where possible: `{ passive: true }`
4. **Don't render until game starts** — zero GPU work on menu screen
5. **Budget frame time**: 33ms for 30fps, subtract ~5ms for event processing
6. **OffscreenCanvas** (future): move rendering to Web Worker

### Critical Finding
`touch-action: none` on `<body>` prevents ALL touch events from being dispatched on some Android browsers. Use `touch-action: manipulation` instead.

## Scene Complexity Budget (Mobile)

| Element | Draw Calls | Target |
|---|---|---|
| Water (simple shader) | 1 | No reflection render target |
| Terrain | 1-2 | Merged geometry |
| Trees near camera | 2-4 | InstancedMesh + LOD |
| Distant trees | 0 | Fog hides them |
| Boat | 1-3 | |
| Docks/houses | 2-4 | Merged per material |
| Particles (wake) | 1-2 | THREE.Points |
| Sky | 1 | |
| **Total** | **~15-25** | |

## Loading Without Freezing

### Use `requestIdleCallback` for yields
```javascript
async function yieldToMain() {
  return new Promise(resolve => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(resolve, { timeout: 50 });
    } else {
      setTimeout(resolve, 16); // at least 1 frame
    }
  });
}
```

### Chunk heavy operations
```javascript
for (let chunk = 0; chunk < total; chunk += 100) {
  processChunk(chunk, Math.min(chunk + 100, total));
  await yieldToMain();
}
```

### Web Workers for geometry generation
ProcTree, collision map building = pure computation, can run in Worker. Transfer Float32Arrays back to main thread.

### Shader pre-compilation
```javascript
await renderer.compileAsync(scene, camera); // Three.js v158+
```

## Quality Tier System

### Low (mobile default)
- DPR: 1.0
- Far plane: 300
- Shadows: OFF
- Water: simple shader, no reflections
- Trees: 50, basic materials
- Grass/Forest: OFF
- PostProcessing: OFF
- Fog: dense (hide short far plane)

### Medium (good mobile / weak desktop)
- DPR: 1.5
- Far plane: 500
- Shadows: BasicShadowMap 512px
- Water: reflections at 128px, skip trees in reflection
- Trees: 150, LOD
- Grass: ON (reduced count)
- PostProcessing: bloom only

### High (desktop)
- DPR: 2.0
- Far plane: 800
- Shadows: PCFSoft 1024px
- Water: full reflections 512px
- Trees: 300+ with LOD
- All systems ON
- Full postprocessing

## Memory Management

```javascript
// Always dispose when removing objects
geometry.dispose();
material.dispose();
texture.dispose();

// For ImageBitmap textures
texture.source.data.close(); // before dispose

// Monitor
console.log(renderer.info.memory); // textures, geometries
console.log(renderer.info.render); // calls, triangles, points
```

## Sources

1. [Three.js Performance Guide (GitHub Gist)](https://gist.github.com/iErcann/2a9dfa51ed9fc44854375796c8c24d92)
2. [Draw Calls: The Silent Killer | Three.js Roadmap](https://threejsroadmap.com/blog/draw-calls-the-silent-killer)
3. [100 Three.js Tips (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
4. [Building Efficient Three.js Scenes | Codrops](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes/)
5. [WebGL best practices | MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
6. [Three.js Forum: 55-60fps on mobile](https://discourse.threejs.org/t/how-to-achieve-three-js-55-60-fps-on-mobile/78206)
7. [Three.js Forum: Touchmove blocked rAF](https://discourse.threejs.org/t/touchmove-on-mobile-blocked-requestanimationframe/17735)
8. [Three.js Forum: Water render target performance](https://discourse.threejs.org/t/set-pixel-ratio-on-render-target-of-water-example/67150)
9. [OffscreenCanvas | web.dev](https://web.dev/articles/offscreen-canvas)
10. [WebGL Off Main Thread | Mozilla Hacks](https://hacks.mozilla.org/2016/01/webgl-off-the-main-thread/)
11. [InstancedMesh Performance | VR Me Up](https://www.vrmeup.com/devlog/devlog_10_threejs_instancedmesh_performance_optimizations.html)
12. [Three.js Ocean Scene (120fps mobile)](https://github.com/Nugget8/Three.js-Ocean-Scene)
13. [Optimizing ThreeJs for Mobile | MoldStud](https://moldstud.com/articles/p-optimizing-threejs-for-mobile-devices)
14. [Performance Tips | Three.js Journey](https://threejs-journey.com/lessons/performance-tips)
15. [Three.js LOD docs](https://threejs.org/docs/pages/LOD.html)
16. [Shadow optimization | Three.js Forum](https://discourse.threejs.org/t/how-to-optimize-shadow-rendering/64681)
17. [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)
18. [InstancedMesh frustum culling | Forum](https://discourse.threejs.org/t/ideas-on-performing-fast-per-instance-frustum-culling/85156)
19. [iOS memory limit crash | Forum](https://discourse.threejs.org/t/memory-limit-crash-on-ios-26/86978)
20. [Lazy loading large scenes | Forum](https://discourse.threejs.org/t/lazy-loading-parts-of-a-large-scene/31831)
21. [FPS-based pixel ratio | Forum](https://discourse.threejs.org/t/changing-pixelratio-based-on-fps/34563)
22. [Scaling Performance | R3F docs](https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance)
23. [Shader compile time reduction | Forum](https://discourse.threejs.org/t/reducing-shader-compile-time/56572)
24. [BatchedMesh vs InstancedMesh | Forum](https://discourse.threejs.org/t/how-to-choose-between-instancedmesh-and-batchedmesh/81221)
25. [Cheap interactive water | Forum](https://discourse.threejs.org/t/cheap-interactive-water/73305)
26. [WebGL Context Lost iOS | Apple Forums](https://developer.apple.com/forums/thread/737042)
27. [Chrome touch event FPS drop | Three.js #14013](https://github.com/mrdoob/three.js/issues/14013)
28. [Three.js WebXR off main thread | surma.dev](https://surma.dev/things/omt-for-three-xr/)
29. [Faster WebGL with OffscreenCanvas | Evil Martians](https://evilmartians.com/chronicles/faster-webgl-three-js-3d-graphics-with-offscreencanvas-and-web-workers)
30. [KTX2Loader | Three.js docs](https://threejs.org/docs/pages/KTX2Loader.html)
31. [TextureLoader blocks main thread | Forum](https://discourse.threejs.org/t/loader-textureloader-blocks-js-main-thread/44579)
32. [Billboard trees | Three.js manual](https://threejs.org/manual/en/billboards.html)
33. [High-performance ground fog | Forum](https://discourse.threejs.org/t/high-performance-ground-fog-for-games/88522)
34. [WebGL vs WebGPU performance | Medium](https://gjgalante.medium.com/webgl-vs-webgpu-the-performance-gap-fbd121fb221a)
35. [Three.js Forum: Non-blocking loaders](https://github.com/mrdoob/three.js/issues/11746)
