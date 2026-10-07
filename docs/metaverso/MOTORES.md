# Motores web: ¿cuáles son más eficientes que Babylon.js, y por cuánto?

> Relevamiento: 2026-10-07 · Complementa a [`PLAN-MVP.md`](./PLAN-MVP.md) y [`CATALOGO-OPEN-SOURCE.md`](./CATALOGO-OPEN-SOURCE.md)

Contexto: PWA en TypeScript + Vite con Babylon.js 7 (Apache-2.0). Escena: lancha por ríos, unos 600 árboles y 80 casas hechos de cajitas, WaterMaterial, sistemas de partículas, TerrainMaterial. Objetivo: Android baratos.

## TL;DR

1. **El problema principal es cómo armamos la escena, no el motor.** Medí el build actual en Chromium headless: **~1.550 draw calls por frame**. Para móviles de gama baja se recomiendan entre 100 y 200. Cada árbol son 3 mallas con 3 materiales propios y cada casa unas 8 mallas. Encima, `addSceneToRenderList()` mete **toda la escena** en los render targets de reflexión y refracción del WaterMaterial, así que la escena se dibuja unas 3 veces por frame.
2. En el micro-benchmark (2.400 cajas, CPU por frame, lado JS), cambiar de motor con la escena tal cual **reduce la CPU como máximo 2,3x (three.js)**, y PlayCanvas y Galacean salieron *peores* que Babylon. Instanciar dentro de Babylon la reduce **unas 100x** (de 20,9 ms a 0,2 ms) y pasa de 2.304 draw calls a 1.
3. En tamaño, three.js pesa la mitad que Babylon (133 KB contra 300 KB gzip en una escena mínima equivalente). Es una ganancia real pero secundaria: unos 170 KB, alrededor de 1 s en 3G malo.
4. **Recomendación: quedarse en Babylon y arreglar la escena** (de 1 a 2 semanas de trabajo). Migrar a three.js solo tendría sentido si, ya arreglada la escena, el tamaño del bundle o el overhead que quede siguen siendo un problema medido en dispositivos reales. Costo estimado: 4 a 7 semanas por persona.

## Metodología y advertencias (léanlas)

- **Tamaños**: los medí yo. Hice `npm install` de cada paquete en `tools/engine-bench` y armé una escena mínima equivalente (motor, escena, cámara, luz, caja, material estándar e instancing cuando existe) con esbuild `--bundle --minify`, y después `gzip -9`. Así se mide el **tree-shaking real** y no el tamaño del paquete completo. Los entries están en `tools/engine-bench/entries/` y los resultados en `tools/engine-bench/out/`.
- **CPU por frame**: Chromium headless (Playwright) con **SwiftShader (GPU por software)**. **No es representativo del rendimiento de GPU.** Solo sirve para comparar el **overhead de CPU/JS por frame** (tiempo de `render()` en JS, mediana de 120 frames, mediana de 3 corridas) y el arranque. Corrió en una CPU de servidor: en un Android barato esperen tiempos entre 4 y 8 veces mayores. Los p90 (~150 ms) son contrapresión del rasterizador por software y no se usan. Código en `tools/engine-bench/bench/` y `tools/engine-bench/runbench.cjs`.
- **Licencias**: leí el LICENSE vía raw.githubusercontent.com con `verify_repo.sh` (primeras líneas y, cuando hizo falta, el texto completo) y lo contrasté con el campo `license` de npm. La fecha del último commit sale de un git fetch superficial hecho hoy.
- **Benchmarks de terceros**: muchos de los que aparecen en las búsquedas son de agencias o vendors (utsubo, cinevva, abratabia) o de foros. Los marco como **evidencia débil**. Incluso hay uno (abratabia) que afirma que WebGPU llegó a iOS en 18.2, cuando en realidad llegó con Safari 26 / iOS 26 (sept. 2025). No me fío de sus números.

## Evidencia propia 1: el juego actual

`tools/engine-bench/gamedraws.cjs` carga el `dist/` real con UA móvil (RT del agua en 256), toca "Jugar" y cuenta llamadas `draw*` de WebGL2:

| Métrica | Valor |
|---|---|
| Draw calls por frame (vista inicial, con frustum culling) | **~1.554** |
| `useProgram` por frame | 11 (los StandardMaterial comparten shader; el costo está en los ~1.500 cambios de uniforms/UBO y draws, no en cambiar de shader) |
| Bundle principal | `index-*.js` 1,94 MB minificado / **469 KB gzip** (más chunks lazy de loaders/glTF/flowgraph) |
| Origen en el código | `Environment.ts`: `createTree` = 3 `CreateBox` + 3 `new StandardMaterial` por árbol; `createHouse` = 4 pilotes + paredes + techo + cumbrera + puerta, con material propio; muelles con 8+ cajas. `WaterSystem.addSceneToRenderList()` (llamado en `GameEngine.ts:121`) agrega **todas** las mallas a reflexión y refracción. |

## Evidencia propia 2: micro-benchmark de CPU por frame (2.400 cajas, SwiftShader)

Modos: **separate** = una malla y un material por caja (como hoy); **shared** = una malla por caja con un material compartido; **instanced** = una sola malla con 2.400 instancias (thin instances / InstancedMesh / setInstancing).

| Motor (versión) | separate: ms CPU/frame | shared | instanced | draws (sep → inst) | primer frame con 2.400 cajas separadas | primer frame instanced |
|---|---|---|---|---|---|---|
| **Babylon.js 7** (`@babylonjs/core` 7.x) | **20,9** | 11,5 (12,4 con freeze) | **0,2** | 2.304 → 1 | 580 ms | 139 ms |
| Babylon.js 9.29 | 21,2 | 15,1 (10,7 con freeze) | 0,2 | 2.304 → 1 | 676 ms | 153 ms |
| **three.js r186** (WebGLRenderer) | **9,2** | 3,6 | 0,1 | 2.400 → 1 | 171 ms | 60 ms |
| PlayCanvas 2.23.1 | 63,5 | 10,2 | 0,3 | 2.279 → 1 | 849 ms | 208 ms |
| Galacean 1.6.13 | 73,8 | 78,1 | (sin auto-instancing: 2.280 draws) | 2.280 → 2.280 | 279 ms | — |

Lectura:
- **Cambiar de motor sin arreglar la escena**: three.js consume ~2,3x menos CPU que Babylon (20,9 → 9,2 ms) y arranca ~3x más rápido. PlayCanvas y Galacean salieron **peor** que Babylon con mallas y materiales sueltos. (En Galacean puede haber una API de batching que no usé; el número indica que no instancia automáticamente con `MeshRenderer` y un material compartido.)
- **Arreglar la escena sin cambiar de motor**: Babylon pasa de 20,9 a 0,2 ms (**~100x**) y de 2.304 draws a 1. Con instancing, **todos los motores quedan en 0,1–0,3 ms**: la diferencia entre motores desaparece.
- Babylon 9 no aporta mejoras de CPU en este caso.

## Tabla comparativa

Tamaño "core gzip" = escena mínima medida con tree-shaking (esbuild + gzip -9) salvo que se indique otra cosa. Brotli suele ser un 20–25 % menor.

| Motor | Licencia (verificada) | Último commit | Core gzip | WebGPU | Instancing / batching | Notas móvil | Evidencia |
|---|---|---|---|---|---|---|---|
| **Babylon.js 7** (base) | Apache-2.0 (license.md; npm Apache-2.0) | 2026-10-07 | **300 KB** (imports profundos; 1,30 MB min). Paquete entero: 1,30 MB gz. Nuestro bundle real: 469 KB | Maduro (desde 5.0); Snapshot Rendering con render bundles; el vendor dice hasta 10x de CPU en escenas estáticas | Instances, **thin instances** (con buffers por instancia de color/matriz), `MergeMeshes`, SPS, `freezeActiveMeshes`, `material.freeze()` | Overhead de CPU por malla alto (20,9 ms/2.400 en mi bench). Tiene herramientas para móvil (`setHardwareScalingLevel`, SceneOptimizer) | Medido aquí; [forum: thin instances](https://forum.babylonjs.com/t/performance-of-instances/48139); [Babylon 7 / snapshot (cinevva, 2024-03, débil)](https://app.cinevva.com/news/2024-03-28-babylonjs-7) |
| **three.js** r186 | MIT | 2026-10-07 | **133 KB** (WebGLRenderer, 535 KB min). WebGPURenderer: **216 KB** | WebGPURenderer + TSL con fallback a WebGL2. Problema conocido de rendimiento con muchos draws en WebGPU: hay que instanciar | `InstancedMesh`, **`BatchedMesh`** (geometrías distintas en 1 draw, opacidad por instancia desde r183), `mergeGeometries` | Menor overhead de CPU medido (9,2 ms separate, 2,3x mejor que Babylon). Ecosistema enorme | Medido aquí; [discourse: problema de rendimiento WebGPU](https://discourse.threejs.org/t/webgpu-performance-issue/87939); [BatchedMesh con alta CPU](https://discourse.threejs.org/t/significant-performance-drop-and-high-cpu-usage-with-batchedmesh/67324); [r183 (cinevva, 2026-03, débil)](https://app.cinevva.com/news/2026-03-18-threejs-r183-render-pipeline) |
| **PlayCanvas** 2.23.1 | MIT (texto MIT, © PlayCanvas Ltd) | 2026-10-07 | **282 KB** con `AppBase` y 3 component systems; **521 KB** con `Application` completa (incluye gsplat). `playcanvas.min.mjs` entero: 655 KB | Sí (WebGPU y WebGL2), maduro | Hardware instancing (`setInstancing`), BatchManager, static batching en el editor | Muy malo con muchos materiales sueltos (63,5 ms); bueno con material compartido o instancing. Las guías del vendor piden 100–200 draws en móviles de gama baja | Medido aquí; [guía de optimización PlayCanvas (vendor)](https://developer.playcanvas.com/user-manual/optimization/guidelines/) |
| **Galacean** 1.6.13 | MIT | 2026-10-07 | **293 KB** (prácticamente no se reduce con tree-shaking: el `browser.min.js` completo pesa 290 KB) | WebGL2 (WebGPU experimental) | No vi auto-instancing para `MeshRenderer`. 2D batching sí | El peor CPU medido (74–78 ms). Comunidad y documentación sobre todo en chino | Medido aquí |
| **Orillusion** 0.9.2 | MIT | 2026-08-02 | **325 KB** | **Solo WebGPU** | Instancing y bundles nativos de WebGPU | **Descartado**: sin WebGPU no corre. En Android, WebGPU exige Android 12+ y Adreno 600+ / Mali-G78+, justo lo que **no** tienen los teléfonos baratos. Pre-1.0 | Medido aquí (solo tamaño); [estado de WebGPU en móvil (abratabia, débil)](https://abratabia.com/mobile-browser-performance/webgpu-on-mobile.php) |
| **Godot 4** (export web) | MIT | 2026-10-07 | WASM de **~9 MB gzip / ~5 MB brotli** (plantilla completa; menos con plantilla recortada) | En la web solo Compatibility (WebGL2) | MultiMesh, GridMap | Pesado para una PWA móvil; arranque lento; `SharedArrayBuffer`/hilos con fricción. Implica reescribir en GDScript/C# | [docs exportar a web](https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_web.html); [dev.to Godot web WASM (débil)](https://dev.to/ziva/godot-4-fur-web-spiele-export-wasm-und-browser-performance-4315); [foro: stutter en móvil](https://forum.godotengine.org/t/godot-4-web-export-stutters-on-mobile-its-probably-your-art-pipeline-not-your-code-31fps-to-60fps-benchmarks-inside/143268) |
| **Bevy** (WASM) | MIT / Apache-2.0 (dual) | 2026-10-07 | **~5 MB brotli / ~7 MB gzip** optimizado (22 MB sin comprimir) | WebGPU (wgpu) y WebGL2 | Instancing automático y batching en el renderer | Pesado; motor pre-1.0 con API inestable; reescritura total en Rust | [docs wavedash: Bevy (débil)](https://docs.wavedash.com/engines/bevy.md) |
| **Defold** | **"Defold License"** (derivada de Apache 2.0 con una restricción: no se puede vender ni comercializar el motor *como producto de game engine*). Para hacer un juego no es problema | 2026-10-07 | **~1,06 MB gzip** el engine WASM (1.12.4) | No (WebGL) | Batching automático fuerte (orientado a 2D) | Muy liviano para su clase, pero es otro editor y Lua: reescritura total, y su 3D es limitado | [foro Defold: tamaño del bundle HTML5](https://forum.defold.com/t/html5-bundle-size/73431); [britzl/dmengine_size](https://github.com/britzl/dmengine_size) |
| **Cocos Creator** (cocos-engine) | MIT (LICENSE.md: MIT, © Xiamen Yaji). El editor es gratuito pero no es open source | 2026-09-21 | Builds web de **2–4 MB** según el vendor (no medido: el engine no está en npm) | WebGL2 y WebGPU (beta) | Instancing, batching estático y dinámico | Muy usado en minijuegos móviles chinos (eso es una buena señal), pero el flujo de trabajo pasa por su editor | [Cocos 3.8.6, tamaño y rendimiento (vendor)](https://www.cocos.com/en/post/f539c7888e620701228458d6b89b80c7) |
| **LayaAir 3** | MIT (LICENSE en layabox/LayaAir). Ojo: el paquete npm `layaair` es otro proyecto (ISC) | 2026-09-24 | No medido (se distribuye con el IDE) | WebGL y WebGPU | Instancing, batching | Orientado a minijuegos chinos; documentación sobre todo en chino | verify_repo; [wiki LayaAir](https://github.com/layabox/layaair/wiki) |
| **Filament** (web) | Apache-2.0 | 2026-10-07 (el repo; el **npm `filament` no se publica desde 2024-08**) | **1,96 MB gzip** de WASM más 52 KB de JS | No en la web (WebGL2) | Renderer PBR, no es un motor de juego | Pesado e inactivo para la web. Descartado | Medido aquí |
| **Wonderland Engine** | API MIT (WonderlandEngine/api), pero **el runtime y el editor son propietarios (EULA)** | API: 2024-10-14 | No medido (el runtime WASM se baja con el editor) | WebGL2 | Batching agresivo (es su punto fuerte) | Muy eficiente según el vendor, pero no es open source | verify_repo; [medevel (débil)](https://medevel.com/wonderlandengine/) |
| **Needle Engine** | **No es open source**: el LICENSE.md del paquete npm 5.1.14 dice "is not open source", uso comercial solo según su EULA | npm 2026-10-06 | No medido (three.js + runtime propio) | Lo que dé three | Lo de three | Descartado por licencia | LICENSE.md de `@needle-tools/engine@5.1.14` |
| **OGL** 1.0.11 | **Unlicense** (package.json; el repo no tiene archivo LICENSE en la raíz) | 2025-04-13 | **14 KB** | No | Instancing manual (atributos instanciados) | Mínimo: no trae materiales, sombras, agua, partículas ni loaders robustos. Habría que escribir el motor nosotros | Medido aquí |
| **twgl.js** 7.0 | MIT | 2026-09-09 | **12 KB** | No | Manual | Helper de WebGL, no es un motor | Medido aquí |
| **regl** 2.1.1 | MIT | 2026-06-21 (npm 2024-11) | **41 KB** | No | Manual | Funcional y sin estado; no es un motor | Medido aquí |
| **luma.gl** 9.4 | MIT | 2026-10-05 | **83 KB** (core + webgl + engine) | Sí (WebGPU y WebGL2) | Manual | Base de deck.gl; demasiado bajo nivel para un juego | Medido aquí |
| **claygl** 1.3 | **BSD-2-Clause** (texto BSD; npm no declara licencia) | 2021-10-31 | **82 KB** | No | Instancing básico | Abandonado | Medido aquí |
| **Hilo3d** 1.19 | MIT | 2026-10-05 | **118 KB** (paquete entero; no se reduce con tree-shaking) | No | Instancing (`useInstanced`) | Activo pero nicho (Alibaba) | Medido aquí |
| **xeogl** 0.9 | MIT | 2020-05-14 | No medido | No | Batching de BIM | Abandonado (sucedido por xeokit, AGPL). Descartado | verify_repo |

## Qué ganamos cambiando de motor vs. arreglando la escena

| Palanca | Ganancia esperada (CPU/frame) | Draw calls | Tamaño | Costo |
|---|---|---|---|---|
| **A. Arreglar la escena en Babylon** (thin instances con color por instancia para troncos y copas; casas en pocas mallas fusionadas o thin instances por tipo de caja; muelles fusionados; materiales compartidos más `freeze()`; `freezeWorldMatrix` en la estática) | **De 10x a 100x** en la parte estática (bench: 20,9 → 0,2 ms con 2.400 cajas) | ~1.550 → **~30–60** | 0 | **3–6 días** |
| **B. Agua: render list mínima** (solo la lancha y quizás un impostor de la orilla en reflexión; nada en refracción, o `refractionTexture` sin lista; `refreshRate = 2`; en gama baja, agua sin RTT: shader simple con fresnel + normal map) | Elimina **~2/3** del costo restante (hoy la escena se dibuja ~3 veces) | ÷3 | 0 | 1–2 días |
| **C. Ajustes de móvil en Babylon** (`setHardwareScalingLevel` según el DPR, que da 2–4x menos fill-rate en pantallas de DPR 3; menos partículas en gama baja; `skipPointerMovePicking`; sin antialias en gama baja) | Gran ganancia en **GPU** (fill-rate), que en Android baratos suele ser el cuello de botella | — | 0 | 1 día |
| **D. Cambiar a three.js sin arreglar la escena** | ~2,3x menos CPU que Babylon (20,9 → 9,2 ms) | ~1.550 igual (o ~500 sin el triple pase del agua) | −170 KB gzip (300 → 133) | 4–7 semanas |
| **E. Cambiar a three.js *después* de A+B+C** | Marginal: ambos quedan en 0,1–0,3 ms para la parte estática. El resto (física, lógica, partículas) depende de nosotros | igual | −170 KB gzip, ~80 ms menos de init en desktop (~0,3–0,6 s en un Android barato) | 4–7 semanas |
| **F. PlayCanvas / Galacean** | Igual o **peor** que Babylon con escena ingenua; similar con escena arreglada | — | similar (282–521 KB) | 4–7 semanas |
| **G. Godot / Bevy / Defold / Cocos** | Desconocido en web, y pesado (Godot/Bevy: 5–9 MB de WASM) | — | **+1 a +9 MB** | Reescritura total (8–14 semanas), con pérdida del stack TS/PWA |

Conclusión numérica: **A+B+C se llevan más del 90 % de la ganancia posible**. Un motor nuevo, en el mejor caso (three.js), suma ~2x de CPU solo si dejamos la escena mal y unos 170 KB de bundle. Una vez arreglada la escena, la diferencia de CPU entre motores es de décimas de milisegundo.

## Recomendación

**Quedarse en Babylon.js y arreglar la escena ahora.** Orden sugerido:
1. Thin instances en árboles (3 mallas base con buffer de color y matriz) y en casas, pilotes y muelles (una malla base de caja con color por instancia, o `Mesh.MergeMeshes` por casa). Un solo `StandardMaterial` compartido y congelado. Objetivo: **< 100 draws**.
2. Recortar la render list del WaterMaterial y ofrecer agua sin RTT en gama baja.
3. `setHardwareScalingLevel` adaptativo según el FPS medido, y menos partículas.
4. Medir en un Android barato real (Chrome remote debugging: draws, ms de CPU, FPS). Ojo: el FPS que da SwiftShader no sirve.
5. (Opcional) Reducir el bundle de 469 KB: cargar el glTF loader de forma lazy (ya está en chunks parciales) y revisar qué arrastra `@babylonjs/materials`.

**Cuándo sí migrar, y a qué:** a **three.js** (MIT, el menor overhead de CPU medido, el bundle más chico de los motores completos, `BatchedMesh` ideal para voxel/low-poly, WebGPU con fallback a WebGL2), y solo si después del paso 4 sigue habiendo un problema de CPU o de tamaño atribuible al motor. **Costo estimado** para ~3,8k LOC (de las cuales unas 2,0–2,5k tocan la API de Babylon): reescribir el entorno, la lancha y la cámara (~1 semana); reemplazar el WaterMaterial (Water/Reflector de los examples de three o un shader propio: ~1 semana); el TerrainMaterial (un shader splat propio: 3–5 días); las partículas y el TrailMesh (three no trae sistema de partículas: three.quarks o uno propio, ~1 semana); la UI y las DynamicTexture (2–3 días); y QA y ajuste en móviles (1–2 semanas). **Total: 4–7 semanas para una persona**, con riesgo de regresiones visuales en el agua y las partículas. PlayCanvas costaría parecido y no mostró ventaja medible. Descartados: Orillusion (solo WebGPU), Needle y Wonderland (no son open source), Filament (inactivo en la web), Godot y Bevy (5–9 MB de WASM y reescritura total).

## Archivos de evidencia

Los scripts para reproducir las mediciones están en [`tools/engine-bench/`](../../tools/engine-bench/README.md):
entradas de tamaño (`entries/`), benchmark de CPU por frame (`bench/` + `runbench.cjs`) y conteo de draw calls
del juego real (`gamedraws.cjs`). La licencia de Needle se verificó en el `LICENSE.md` de su paquete npm.
