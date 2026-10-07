# Arquitecturas de metaversos abiertos: cómo resuelven rendimiento, mundos y red

> Relevamiento: 2026-10-07, leyendo el código fuente y la documentación de cada proyecto. Complementa a
> [`PLAN-MVP.md`](./PLAN-MVP.md), [`MOTORES.md`](./MOTORES.md) y [`CATALOGO-OPEN-SOURCE.md`](./CATALOGO-OPEN-SOURCE.md).

Fecha: 2026-10-07. Método: clones superficiales anónimos (`git clone --depth 1`) de cada repositorio, búsquedas con grep sobre el código y la documentación de cada repo, y búsquedas web para los postmortems. **docs.decentraland.org y create.roblox.com están bloqueados por el proxy de salida**. Para Roblox se leyó el repo público `Roblox/creator-docs`, que es la fuente Markdown de create.roblox.com. Para Decentraland se leyeron las constantes del cliente oficial (`unity-explorer`), que citan la documentación de límites. Las rutas citadas son relativas a la raíz de cada repo. Lo marcado **[inferencia]** no está verificado en una fuente primaria.

Repos estudiados: `Hubs-Foundation/hubs` (+ `Hubs-Foundation/Spoke`), `matrix-org/thirdroom`, `hyperfy-xyz/hyperfy`, `mml-io/mml`, `mml-io/3d-web-experience`, `decentraland/js-sdk-toolchain`, `decentraland/unity-explorer`, `webaverse/app`, `vircadia/vircadia-web`, `jbaicoianu/janusweb` (el fork `janusxr/janusweb` no clonó; jbaicoianu es el upstream), `cubzh/cubzh` (hoy "Blip"), `voxelize/voxelize`, `fenomas/noa`, `zardoy/minecraft-web-client`, `orion3dgames/t5c` y `Roblox/creator-docs`. Overte no se clonó. Vircadia-web es su cliente web (Babylon.js), así que cubre ese linaje.

---

## 1. Mozilla Hubs / Hubs Foundation (three.js + A-Frame → bitECS)

**Rendimiento de render**
- Tres niveles de calidad de material (`low|medium|high`). **En móvil el valor por defecto es `low`** y en escritorio `high`. Se puede sobrescribir por query string (`default_mobile_material_quality`). Fuente: `src/storage/store.js` (`defaultMaterialQuality`).
- La degradación es real y no cosmética: `convertStandardMaterial()` sustituye PBR por Phong (`medium`) o por Basic/unlit (`low`). Fuente: `src/utils/material-utils.js:213`. El agua (`src/components/simple-water.js:22`), el skybox (`src/components/skybox.js:469`) y otros elementos consultan el mismo ajuste.
- **Pixel ratio automático**: mide la mediana de FPS y baja el `pixelRatio` si cae por debajo de 30 FPS (lo sube por encima de 48). Ignora los primeros 30 s tras cargar la escena y mide en ventanas de 5 s. Fuente: `src/systems/auto-pixel-ratio.js` (`LOW_FPS_THRESHOLD = 30`, `HIGH_FPS_THRESHOLD = 48`). Además hay un `maxResolution` en píxeles físicos (`src/react-components/room/hooks/useResizeViewport.js`).
- Texturas: `KTX2Loader` y `KHR_texture_basisu` en el cargador glTF. La extensión propietaria `MOZ_HUBS_texture_basis` se marca como obsoleta ("use KHR_texture_basisu instead"). También soporta LOD por glTF con `MSFT_lod`. Fuente: `src/components/gltf-model-plus.js:2-7, 680-710, 940-947`.
- Mitigación en Android: el panning de audio en modo "equal power" viene activado por defecto por un bug de WebAudio con muchas personas en la sala (`src/storage/store.js`, issues #5057 y crbug 1308962).

**Presupuestos de contenido (editor Spoke)**. Es la "puntuación de rendimiento" que se muestra antes de publicar. Fuente: `Spoke/src/editor/utils/performance.js:305-400`.
| Métrica | Low (OK) | Medium | High (mal) |
|---|---|---|---|
| Triángulos de escena | ≤ 50 000 | ≤ 75 000 | > 75 000 |
| Luces | ≤ 3 | ≤ 6 | > 6 |
| VRAM de texturas (con mipmaps, sin comprimir) | ≤ 256 MB | ≤ 512 MB | > 512 MB |
| Materiales únicos | ≤ 25 | ≤ 50 | > 50 |
| Tamaño del GLB | < 16 MB | < 50 MB | ≥ 50 MB |
| Texturas > 2048×2048 | 0 | — | cualquiera |
- Avisos **por objeto**: más de 10 000 polígonos, más de 10 materiales, alguna textura > 2048², más de 64 MB de VRAM. Archivo sugerido: glTF ≤ 10 MB, imagen ≤ 4 MB (`performance.js:56-59, 155-173`). La VRAM se estima como `w*h*4` sumando los mipmaps (`calculateUncompressedMipmapedTextureSize`).

**Formato de mundo**: escena = **glTF con la extensión `MOZ_hubs_components`** (componentes por nodo, versionados) más `MOZ_lightmap`. Hay un changelog de versiones de la extensión en la wiki. Fuente: `src/components/gltf-model-plus.js:130-345`, `src/gltf-component-mappings.js` (mapeo de componentes glTF a ECS).

**Red**: Reticulum (Elixir/Phoenix channels) para presencia, permisos y mensajes, `networked-aframe` y un adaptador a **Dialog (SFU mediasoup)** para voz y vídeo (`package.json`: `phoenix`, `mediasoup-client`; `src/naf-dialog-adapter.js`). La autoridad es **por entidad, del cliente**: "ownership" con `lastOwnerTime` (LWW) en `src/utils/take-ownership.ts` y `take-soft-ownership.ts`. Los permisos son por sala (`hubChannel.can("spawn_and_move_media")`).

**Streaming**: no hay. Cada sala es una escena entera que se descarga al entrar.

**Scripting UGC**: no hay scripting de usuario (solo componentes declarativos). Es el modelo más seguro, pero el menos expresivo.

**Por qué murió**: Mozilla anunció el 13-02-2024 una reestructuración y cerró Hubs el 31-05-2024. Citó también la caída de interés en mundos 3D fuera de juegos y educación. El código pasó a la comunidad (Hubs Foundation, "Community Edition" sobre Kubernetes). Fuentes: [hubs.mozilla.com/labs/sunset](https://hubs.mozilla.com/labs/sunset), [RoadToVR](https://roadtovr.com/mozilla-hubs-shutdown-web-xr/), [Ryan Schultz](https://ryanschultz.com/category/mozilla-hubs/). Lección: el coste de operar la infraestructura (Kubernetes, SFU, Reticulum) es alto si no hay un modelo de ingresos.

---

## 2. Third Room (Matrix, three.js multihilo)

- **Arquitectura de 3 hilos**: hilo principal, `GameWorker` (simulación y ECS) y `RenderWorker` (OffscreenCanvas). Se comunican con **SharedArrayBuffer y triple buffer** (`src/engine/MainThread.ts:121-122`, `src/engine/allocator/ObjectBufferView.ts:85-98`). El README advierte que exige COOP/COEP y `Cross-Origin-Resource-Policy` en el servidor de medios.
- **Niveles de calidad**: se mapea el `gpuTier` (detect-gpu) a calidad: tier 0-1 → Low, 2 → Medium, 3 → High (`src/engine/renderer/renderer.common.ts:141`). Por calidad (`src/engine/renderer/RenderPipeline.ts:26-50`): MSAA 1/4/8/16, anisotropía 4/4/8/16, mapa de sombra direccional **ninguno**/512/1024/2048. El propio código avisa de que el pipeline (bloom y outline con render targets Float) "solo está enfocado a escritorio. Para móvil o VR pueden hacer falta más optimizaciones".
- **Pipeline de importación** (`src/asset-pipeline/pipeline.ts`): dedupe de propiedades → **instanciado automático de mallas** (`extensionAwareInstance`, que emite `EXT_mesh_gpu_instancing`) → base color/emisivo reescalados a **2048²**, y metal-rugosidad/AO/normales a **1024²** → compresión **Basis/KTX2** (encoder WASM incluido en `vendor/basis`). Es el mejor ejemplo de "optimizar en la subida y no en el cliente".
- **Formato de mundo**: glTF con extensiones propias documentadas: `MX_lightmap`, `MX_reflection_probes`, `MX_portal`, `MX_spawn_point`, `MX_static` (transform congelado), `MX_tiles_renderer` (3D Tiles), `MX_texture_rgbm`, `MX_character_controller`, más compatibilidad con `MOZ_hubs_components` (`docs/gltf/*`, `src/engine/gltf/GLTF.ts:525-803`).
- **Scripting**: API **WebSG**. Los scripts de usuario (JS mediante QuickJS compilado a WASM con emscripten, o cualquier lenguaje que compile a WASM/WASI) corren en el game worker con **memoria WASM fija de 1024 páginas = 64 MB** (`src/engine/scripting/scripting.game.ts:75`, `src/engine/scripting/emscripten/src/js-runtime`). Es un sandbox de capacidad: el script solo ve la API WebSG.
- **Red**: P2P WebRTC con **elección de host** (`src/engine/network/HostElection.ts`) y señalización y estado sobre salas Matrix. Hay componentes `Networked`/`Authoring`/`Relaying` y migración de host (`docs/protocol/implementation.md`). Voz por WebRTC (TURN del homeserver).
- **Por qué murió**: el último commit del repo es del 11-07-2023. La actualización de fin de año de Matrix de 2023 habla de "extreme focus" y de proyectos pausados por falta de financiación ([matrix.org holiday update 2023](https://matrix.org/blog/2023/12/25/the-matrix-holiday-update-2023/)). **[inferencia]** Lo financiaba Element y se detuvo con los recortes. Su complejidad (SAB/COOP, multihilo, WASM) también encareció la adopción.

---

## 3. Hyperfy v2 (three.js, servidor Node autoritativo)

- **Instanciado automático**: `Stage` agrupa por (geometría, material) en `InstancedMesh`, con un uber-shader que añade atributos por instancia (emisivo) y un **LooseOctree** para culling y raycast (`src/core/systems/Stage.js:5-23, 85-110, 290-323`). La doc pide "Duplicate Linked" en Blender para que mallas repetidas se dibujen en un solo draw call (`docs/supported-files/models.md`).
- **LOD**: nodo `LOD` con `maxDistance` por nivel y modo `scaleAware`. El sistema `LODs` revisa **como máximo 1000 nodos por frame** con un cursor rotatorio, es decir, amortizado (`src/core/systems/LODs.js`, `src/core/nodes/LOD.js`).
- **Calidad en móvil**: preferencias `dpr` (por defecto 1) y `shadows` (`none|low|med|high`; táctil → `low`; med = cascada 2048, high = cascada 4096). Hay un retraso al persistir para que "prefs que crashean no persistan (p. ej. iOS viejo con sombras UHD)" (`src/core/systems/ClientPrefs.js:24-81`).
- **Formato**: `.hyp` = cabecera Uint32 + JSON (`blueprint`: modelo, script, props, frozen) + binarios concatenados (`docs/supported-files/hyp-format.md`). La App es una unidad (modelo + script + config).
- **Scripting y seguridad**: los scripts corren **en servidor y en cada cliente** dentro de **SES Compartments** (`lockdown`, `harden`; `eval: undefined`) con una lista blanca de globales (`src/core/systems/Scripts.js:13-50`, `src/server/index.js:1-2`). Límite de subida `PUBLIC_MAX_UPLOAD_SIZE=12` MB (`.env.example`; `src/core/systems/ClientBuilder.js:1024`).
- **Red**: WebSocket a servidor Node autoritativo con paquetes **msgpackr** (`src/core/packets.js`). Persistencia cada `SAVE_INTERVAL=60` s. Voz con **LiveKit** (`ClientLiveKit.js` y `ServerLiveKit.js`). Para la comunicación entre apps está `app.send/app.on` (servidor↔clientes) y `app.emit/world.on` (`docs/scripting/Networking.md`). Un mundo = un proceso, sin shards.
- **Historia**: v1 vendía mundos como NFT. En enero de 2025 se lanzó v2 open source y autoalojable junto con un token y agentes IA ([The Defiant](https://thedefiant.io/hyperfy-launch-revives-metaverse-narrative-with-ai-agent-integration)). Vivo; el `.env.example` ya trae `AI_PROVIDER=anthropic`.

---

## 4. MML + 3d-web-experience (Improbable / MSquared)

- **Formato**: **HTML con elementos 3D** (`<m-cube>`, `<m-model>`, `<m-frame>`, `<m-character>`, `<m-label>`, `<m-video>`, `<m-attr-anim>`…; lista en `packages/mml-web/src/elements/`). Hay esquema **XSD/JSON** y un validador (`packages/schema`, `packages/schema-validator`). El documento *es* el estado.
- **Streaming**: `<m-frame src=… load-range unload-range min-x … max-z>` incrusta documentos remotos y los carga o descarga según la distancia, con histéresis (`unload-range` por defecto 1) (`packages/mml-web/src/elements/Frame.ts:10-60`). Es composición de mundo a base de "documentos por región".
- **Red**: "Networked DOM". El documento se ejecuta **en el servidor** (JSDOM, `runScripts: "dangerously"` dentro de un contexto `vm`, `packages/observable-dom/src/JSDOMRunner.ts:15-104, 240`) y los clientes reciben **diffs del DOM** (`networked-dom-protocol`). En el navegador hay un runner en **iframe `sandbox="allow-scripts"`** (`packages/networked-dom-web-runner/src/RunnerIframe.ts:22`). Para avatares, **DeltaNet**: componentes int64 por usuario, deltas comprimidos con deflate. Con 6 componentes × 2000 usuarios un tick ocupa **~4.2 KB** (`packages/deltanet/delta-net-protocol/README.md`).
- **Render de multitudes**: los avatares lejanos se convierten en **InstancedMesh2** (vendorizado de three.ez) con colores muestreados del avatar y animación por timeline compartida (`packages/3d-web-threejs/src/character/instancing/*`). Hay además un `LowPolyModel.ts`.
- **Contexto**: es la tecnología de Otherside (Yuga), con demos de más de 7200 concurrentes ([Improbable](https://improbable.io/blog/improbable-technology-powers-a-historic-achievement-for-metaverse)). El riesgo es que el seguimiento JSDOM por documento en el servidor escala en RAM.

---

## 5. Decentraland (SDK7 + unity-explorer; Bevy/web explorers en paralelo)

**Límites por escena (n = parcelas de 16 m × 16 m)**. Fuente de código: `Explorer/Assets/DCL/PerformanceAndDiagnostics/Profiling/SceneContentStatsFormatter.cs` (cita la doc [scene-limitations](https://docs.decentraland.org/creator/scenes-sdk7/optimizing/scene-limitations/)), `.../SceneLoadingLimit/SceneLoadingMemoryConstants.cs` y `Utility/ParcelMathHelper.cs`.
| Límite | Fórmula |
|---|---|
| Triángulos | n × 10 000 |
| Entidades | n × 200 |
| Cuerpos (bodies) | n × 300 |
| Texturas | ⌊log2(n+1) × 10⌋ |
| Materiales | log2(n+1) × 20 (documentado; el explorer no lo muestra con tope, porque en URP el coste real va por variante de shader) |
| Altura | log2(n+1) × 20 m |
| Tamaño en disco | 15 MB por parcela, tope 300 MB |
| Archivo individual (CLI) | 50 MB (`sdk-commands/src/logic/scene-validations.ts:21`) |
- Los límites son **blandos** en runtime: aviso naranja al 80 % y nunca rojo (`SceneContentStatsFormatter.cs`). El CLI sí valida al publicar: parcelas conectadas, parcela base dentro, sin duplicados y tamaño de archivo (`scene-validations.ts:66-177`). Los meshes que salen de los límites de la parcela se **recortan en el shader** con planos y los colliders que cruzan el borde se desactivan (`docs/systems.md`).
- **Formato**: `scene.json` (parcelas, base, spawn, metadatos) más **ECS con CRDT**. Componentes LWW-element-set y grow-only-set (`packages/@dcl/ecs/src/engine/lww-element-set-component-definition.ts`, `grow-only-value-set-component-definition.ts`). Composite estático `main.crdt`, que se aplica antes del primer frame. Entidades de 32 bits: 16 de número y 16 de versión, con **máximo 65 535 entidades** y 512 reservadas (`ecs/src/engine/entity.ts:13-46`).
- **Sandbox de scripts**: cada escena es un **contexto V8 aislado** (ClearScript) en el thread pool. Solo hay `require` de módulos de API vía protobuf (EngineApi para el CRDT, RestrictedActions…). `fetch` y `websocket` están mediados (`docs/scene-runtime.md`). El **FPS de la escena lo fija el host** (`SetTargetFPS`).
- **Streaming e interés (lo más útil)**: "partition buckets" por distancia. `RealmPartitionSettings.asset` define `fpsBuckets` = **40/30/15/10/5/0 Hz** para el tick JS de la escena según su bucket, **1 Hz si está detrás de la cámara**, `maxLoadingDistanceInParcels: 20`, `MinLoadingDistanceInParcels: 5`, `UnloadingDistanceToleranceInParcels: 1` y lotes de 6 escenas por petición (`Explorer/Assets/DCL/Infrastructure/ECS/Unity/Prioritization/Settings/`). Más allá del radio de carga se muestran **LODs de escena** pregenerados (`DCL/LOD/Settings/LODSettingsAsset.cs`, `SDK7LodThreshold = 2`).
- **Presupuesto de memoria por clase de dispositivo** (`SceneLoadingLimit.cs`): con poca RAM caben 1 escena + 1 LOD HQ + 10 LOD LQ (≈ 561 MB); con RAM media, 3 escenas + 5 LOD HQ + 30 LQ (≈ 1925 MB). Hay un `MemoryBudgetProvider` y un `ReleaseMemorySystem` con caches LRU por tipo que se vacían por trozos con presupuesto de frame (`docs/memory-budgeting-and-resource-unloading.md`).
- **Assets**: el explorer **no consume glTF crudo** en producción, sino **asset bundles** convertidos en el servidor por plataforma (`docs/asset-bundles-conversion.md`). Es el equivalente a nuestro "transcodificar a KTX2/meshopt al publicar".
- **Red**: LiveKit (sala "Island" asignada por **Archipelago**, que agrupa jugadores cercanos, más sala de escena "GateKeeper") y **Pulse** (UDP/ENet). Movimiento a **10 Hz al moverse que decae exponencialmente a 1 Hz quieto** (0.1→0.2→0.4→0.8→1 s). Cuantización de 9 bits con curva raíz (`docs/multiplayer.md:238-266`).
- **Qué le hizo daño**: mundo vacío y críticas por bugs. DappRadar contó ~38 usuarios transaccionando al día frente a los 8000 diarios que reclamaba DCL en 2022 ([Wikipedia](https://en.wikipedia.org/wiki/Decentraland), [Hyperallergic](https://hyperallergic.com/769614/metaverse-decentraland-is-empty/)). La tierra escasa (parcelas NFT) fragmentó el mundo en escenas de calidad muy desigual. El cliente web original sufría con escenas pesadas, y por eso se pasó a Unity nativo y se añadieron los buckets de FPS.

---

## 6. Webaverse (three.js, muerto)

- Render avanzado y costoso: `GeometryAllocator` e `InstancedGeometryAllocator` con **multi-draw** (`WEBGL_multi_draw`, `maxNumDraws = 1024`) y **frustum culling por instancia** (`instancing.js:42, 243, 688, 879-944`). LOD por octree con hash (min, lod) (`lod.js`). Terreno procedural con **dual contouring en un worker WASM** (`dc-worker-manager.js`, `dual-contouring.js`). Impostores y sprites de avatar (`avatar-spriter.js`, `mesh-lodder.js`).
- Estado de mundo en **CRDT (zjs, al estilo Yjs)** (`app-manager.js:7, 448`). Las "apps" (metaversefile) son módulos JS cargados **sin sandbox** en el hilo principal (`metaversefile-api.js`).
- **Por qué murió**: último commit el 20-12-2022. Proyecto financiado con NFT (pases "Genesis" / tierra en "The Upstreet") ([Delphi](https://members.delphidigital.io/media/webaverse-pioneering-an-immersive-open-source-metaverse-enabling-community-built-worlds)). **[inferencia]** Ambición técnica desmedida (procgen, IA, física PhysX-WASM, blockchain) y ninguna disciplina de presupuestos en móvil, junto con la caída del mercado NFT. Lección: el código "todo en un monolito sin sandbox" no escala a UGC de terceros.

---

## 7. Vircadia-web (Babylon.js; linaje High Fidelity / Overte) — el más cercano a nuestro stack

- **Babylon 8**, con WebGPU si está disponible y caída a WebGL (en móvil WebGPU queda desactivado salvo flag). Pide `texture-compression-bc/etc2/astc` (`src/modules/scene/renderer.ts:55-110`).
- **Móvil**: `renderScale` por defecto **0.5 en móvil** y 1.0 en escritorio (`setHardwareScalingLevel(1/scale)`, acotado a 0.25-1) (`renderer.ts:78-103`). **SceneOptimizer** `LowDegradationAllowed(60)` más `TextureOptimization(0, 512)`, que **limita las texturas a 512** en móvil (`src/modules/scene/vscene.ts:714-727`).
- **LOD por convención de nombres** `_LOD0…_LOD4` en el glTF, con distancias **0/15/30/60/120 m** o por tamaño en pantalla 1.0/0.25/0.1/0.08/0.05. Hay "AutoTargets" que **simplifican la malla en el cliente** con calidades 0.9/0.3/0.1/0.05/0.01, más billboard por `extras` (`src/modules/scene/LODManager.ts:25-110`).
- Red (servidor Vircadia/Overte): domain server más "assignment clients" (avatar mixer, audio mixer espacializado en el servidor, entity server con octree) vía `@vircadia/web-sdk`. **[inferencia, conocimiento de HiFi/Overte, no verificado en código esta vez]** El audio se mezcla en el servidor (un solo stream de bajada por cliente), lo que es muy favorable para teléfonos baratos.
- Scripts: `ScriptComponent` cargados por el cliente (`src/modules/script/processor.ts`), sin un sandbox fuerte en la versión web.

---

## 8. JanusWeb (three.js / Elation)

- **Formato**: markup **FireBoxRoom** (HTML-like) embebido en páginas web, con rooms enlazadas por **portales** (`scripts/room.js:2723`). Cada URL es una sala.
- **Scripts**: `eval` y `new Function(room.onload)` **en el contexto principal, sin sandbox** (`scripts/room.js:1145, 2993`).
- **Red**: presence server por WebSocket con suscripción por URL de sala (`scripts/multiplayermanager.js`). Un mundo = una sala; no hay streaming dentro de la sala.
- **Historia**: la empresa JanusVR se disolvió a finales de 2019 por costes legales y de IP; el código se liberó y lo mantienen voluntarios ([Ryan Schultz](https://ryanschultz.com/2019/12/09/janusvr-shuts-down-its-corporation-but-the-platform-will-continue/)). Lección: "la web como metaverso" (cada página una sala) funciona técnicamente, pero no retiene usuarios sin un núcleo social o de juego.

---

## 9. Cubzh → Blip (C + bgfx + Luau; nativo y WASM)

- El README ya lo presenta como **"Blip: a Roblox-like platform tailored for generative AI… games created on mobile"** (`README.md`).
- **Voxel**: `CHUNK_SIZE 16` (16³ = 4096 bloques), coordenadas int16, **paleta de 255 colores** por shape (`core/config.h:233-330`), octree (`core/octree.c`) e iluminación por flood fill (`core/flood_fill_lighting.c`). El formato `.3zh` va en chunks: PREVIEW, PALETTE y SHAPE/OBJECT, comprimido con zip (`cubzh-file-format-3zh.txt`).
- **Scripting**: **Luau** con globales en sandbox (`lua_sandbox_globals`, en `common/VXLuaSandbox/lua_require.cpp:438`, `scripting.cpp`). El mismo script corre en cliente y en el **game server dedicado por instancia** (`common/VXGameServer`), con `maxPlayers` configurable por juego (`common/VXFramework/VXGame.hpp:150-164`) y un hub para matchmaking (`servers/hub`). La física es Jolt.
- Lección: voxel con paleta indexada + Luau + servidor por instancia es una receta probada para móvil barato. El mundo es pequeño por instancia y el "metaverso" es un catálogo de instancias.

---

## 10. Voxelize (Rust autoritativo + three.js + mesher WASM)

- **Interest management por chunk**: `ChunkInterests` mapea chunk → clientes y pesos (`server/world/interests.rs`). Valores por defecto del servidor (`server/world/config.rs:280-325`): chunk de 16, 8 subchunks, altura 256, **64 chunks por tick**, **16 respuestas por tick**, 2 guardados por tick, tick de 16 ms e hibernación de 500 ms.
- **Cliente** (`packages/core/src/core/world/world-options.ts:485-520`): `defaultRenderRadius: 6` chunks, **12 peticiones de chunk por update**, 4 procesados, **8 mallas por update**, 5 ms máximo para luces por frame, más **frustum, oclusión y niebla para culling de chunks** (`isCullingChunksByFrustum/Occlusion/Fog`) y mallado con workers WASM. Protobuf sobre WebSocket.
- Lección: todo cuesta un **presupuesto por frame explícito y configurable** (N mallas, N peticiones, X ms).

---

## 11. noa-engine (Babylon.js) — referencia directa para nuestro stack

- `chunkSize: 24`, `chunkAddDistance [2,2]` y `chunkRemoveDistance [3,3]`, es decir, histéresis add/remove (`src/lib/world.js:15-31`). Colas acotadas (`maxChunksPendingCreation/Meshing = 50`) y **presupuesto en ms por tick (5) y por render (3)** (`world.js:85-105`).
- **Octree de selección de Babylon** gestionado a mano (`src/lib/sceneOctreeManager.js`), `freezeWorldMatrix()` en terreno estático, `doNotSyncBoundingInfo` e `isPickable=false` (`terrainMesher.js:96, 712-713`). Mallado greedy con fusión de caras por material (`terrainMesher.js:37-132`).
- **Thin instances** para los "block objects" (mallas custom por voxel), con un solo buffer de matrices por chunk (`src/lib/objectMesher.js:4, 233-311`).
- **Origin rebasing** cada 25 unidades (`originRebaseDistance: 25`, `src/index.js:56`) para evitar el jitter de float32 en mundos grandes.

---

## 12. minecraft-web-client (zardoy; three.js WebGL2)

- `renderDistance: 3` chunks por defecto (`src/defaultOptions.ts:7`). **4 mesher workers** generan geometry buffers. **No hay occlusion culling** (`README.MD:124-129`). La UI va en DOM (accesible) y el soporte táctil es de primera clase.
- Habla el protocolo real de Minecraft a través de proxy WebSocket→TCP. En iOS los mundos zip viven en RAM con un **límite de ~300 MB** (`README.MD:74`), que es un dato útil sobre los techos de memoria en Safari móvil.

---

## 13. T5C (Babylon.js + Colyseus) — referencia directa para red y multitudes

- **Interest management con `@filterChildren` de Colyseus**: cada cliente solo recibe entidades con |dx| y |dz| < `PLAYER_VIEW_DISTANCE = 30` (`src/server/rooms/state/GameRoomState.ts:19-23`). `maxClients = 20` por sala, `updateRate = 100` ms (10 Hz de parches) y guardado en BD cada 10 s (`src/shared/Config.ts`).
- **Multitudes animadas baratas**: **Baked Vertex Animation (VAT) de Babylon** con instancias (`src/client/Controllers/VatController.ts:5-9`), `createInstance` para equipos, nameplates y sombras blob (`EntityMesh.ts`, `EntityNamePlate.ts`, `Item.ts`). `Mesh.MergeMeshes` para unir submallas (`Entities/Common/MeshHelper.ts`) y `freezeWorldMatrix` en objetos estáticos (`Item.ts:223-227`).

---

## 14. Roblox (fuente: repo `Roblox/creator-docs`)

- **Streaming de instancias** (`content/en-us/workspace/streaming/index.md`): `StreamingMinRadius` vale **64 studs** por defecto y `StreamingTargetRadius` **1024 studs** (`reference/engine/classes/Workspace.yaml:1148, 1180`). Por defecto `StreamOutBehavior = LowMemory`, que solo descarga más allá del radio mínimo cuando falta memoria. `StreamingIntegrityMode = PauseOutsideLoadedArea` (recomendado) pausa al jugador si entra en una zona sin cargar. `ModelStreamingMode` tiene Atomic, Persistent, PersistentPerPlayer y Nonatomic. Existe `RequestStreamAroundAsync` para teletransportes y **frustum streaming** opcional (mira, alta velocidad) (`streaming/frustum.md`).
- **SLIM**: transcodificación en la nube de modelos y avatares a **mallas compuestas con varios LOD** que reducen draw calls, triángulos y memoria. Los modelos descargados por streaming siguen visibles como stand-ins. El ejemplo muestra ~2.6 M de triángulos reducidos a ~170 k (`streaming/slim.md`).
- **Instanciado**: identidad de asset = mismo `MeshContent` + misma textura o SurfaceAppearance → un draw call. Los decals, partículas y transparencias no se agrupan bien (`performance-optimization/improve.md:312-410`).
- **Presupuestos**: **≤ 20 000 triángulos por malla** (`art/modeling/specifications.md:29`). Texturas hasta 4096², con carga progresiva por mip según el dispositivo (`art/modeling/texture-specifications.md:18`). Frame de 16.67 ms y trabajo por frame troceado (p. ej. 5 ms por frame) (`design.md:52-56`). Memoria de servidor < 50 % (`identify.md:114`). `UnreliableRemoteEvent` descarta cargas de **más de 1000 bytes** (`reference/.../UnreliableRemoteEvent.yaml:55`).
- **Demografía real**: **Android ≈ 65 %** de los jugadores, y de ellos **~60 % tiene 2-4 GB de RAM**. Más del 50 % juega en dispositivos con 10 000-20 000 en Passmark (`performance-optimization/test-on-hardware.md:27-31`). Recomienda dispositivos base como Infinix Smart 9, Moto G05 u Oppo A18.
- **Sandbox**: Luau más **Script Capabilities** (contenedores `Sandboxed` con capacidades como `AccessOutsideWrite`, `CreateInstances`, `Network`, `RunClientScript`…) para UGC dentro de UGC (`scripting/capabilities.md`).

---

## Tabla comparativa transversal

| Proyecto | Instanciado / LOD | Streaming | Formato de mundo | Presupuestos de contenido | Sandbox de scripts | Red |
|---|---|---|---|---|---|---|
| Hubs | KTX2/Basis, MSFT_lod; sin instanciado automático; 3 tiers de material (móvil=low), auto pixel ratio | No (sala entera) | glTF + `MOZ_hubs_components` | Spoke: 50k/75k tris, ≤3 luces, ≤256 MB VRAM, ≤25 mats, <16 MB GLB, sin tex >2048 | Sin scripts UGC | Phoenix (Reticulum) + NAF; ownership LWW por cliente; SFU mediasoup |
| Third Room | Instanciado automático en import (`EXT_mesh_gpu_instancing`), resize 2048/1024, KTX2; tiers por gpuTier | No (portales entre mundos) | glTF + `MX_*` | Implícitos en el pipeline | WASM (QuickJS/WASI), 64 MB fijos, API WebSG | P2P WebRTC con host electo sobre Matrix |
| Hyperfy v2 | InstancedMesh automático + LooseOctree; nodo LOD con 1000 checks por frame | No (mundo único) | `.hyp` (JSON + blobs), App = GLB + script | Subida ≤12 MB | SES Compartments (cliente y servidor) | WS + msgpackr, servidor Node autoritativo, LiveKit |
| MML / 3d-web-exp. | InstancedMesh2 para avatares lejanos | `<m-frame>` con load/unload-range | HTML/DOM (`m-*`) + XSD | — | JSDOM+vm en servidor; iframe sandbox en navegador | Networked DOM (diffs) + DeltaNet (deflate) |
| Decentraland | Asset bundles por plataforma, LOD de escena pregenerados | Parcelas 16 m, buckets por distancia, radio 5-20 parcelas, presupuesto de memoria por clase de RAM | `scene.json` + ECS CRDT (`main.crdt`) | n×10k tris, n×200 entidades, n×300 bodies, log2(n+1)×10 tex, ×20 mats, ×20 m altura, 15 MB/parcela (≤300 MB) | V8 aislado por escena; tick 40→0 Hz por distancia | LiveKit (islas Archipelago) + Pulse UDP; 10→1 Hz adaptativo |
| Webaverse | Multi-draw + culling por instancia, octree LOD, impostores | Chunks procgen (DC en WASM) | metaversefile (módulos JS) | — | Ninguno | CRDT zjs |
| Vircadia-web | Babylon; LOD `_LODn` 0/15/30/60/120 m + simplificación en cliente; SceneOptimizer | Octree del entity server [inf.] | Entidades JSON + glTF | Texturas ≤512 en móvil (opt.) | Débil | Domain + mixers (audio mezclado en servidor) |
| JanusWeb | — | No (sala = URL) | FireBoxRoom (HTML-like) | — | Ninguno (eval) | Presence server WS |
| Cubzh/Blip | Voxel, chunk 16³, octree, paleta de 255 | Por instancia de juego | `.3zh` (chunks) | Paleta de 255, coordenadas int16 | Luau en sandbox | Game server dedicado por instancia + hub |
| Voxelize | Culling de chunks por frustum, oclusión y niebla | Chunks 16, interest map, 64 chunks/tick | Voxels + protobuf | Por tick y frame (12 req, 8 meshes) | (server-side en Rust) | WS protobuf, servidor Rust autoritativo |
| noa | Thin instances, greedy meshing, octree de Babylon, freeze | Chunks 24, add 2 / remove 3 | Voxel registry | Presupuesto de 5 ms/tick y 3 ms/render | n/a | n/a (motor local) |
| mc-web-client | 4 mesher workers; sin oclusión | renderDistance 3 | Protocolo MC | ~300 MB RAM en iOS | n/a | Proxy WS→TCP |
| T5C | VAT + instancias Babylon, MergeMeshes, freeze | Por zona (sala Colyseus) | Datos de juego JSON/BD | 20 clientes por sala | n/a | Colyseus, filtro AOI de 30 m, 10 Hz |
| Roblox | Instanciado por identidad de asset, SLIM (LOD + merge en la nube), oclusión | Streaming 64/1024 studs, LowMemory, Pause, frustum | DataModel (instancias) | 20k tris/malla, 4K tex, 1000 B por evento unreliable | Luau + Script Capabilities | Servidor autoritativo por instancia |

---

## Qué adoptamos para nuestro MVP (10 recomendaciones priorizadas)

**1. (a) El validador del World Doc impone presupuestos por chunk y por mundo, con dos umbrales (aviso/rechazo).** Usamos el modelo de Decentraland, que escala por superficie, y los umbrales de Spoke/Hubs como techo absoluto. Chunk = **16 m × 16 m** (igual que una parcela DCL) y n = chunks usados:
- Triángulos: **n × 10 000** (DCL) con techo absoluto de **75 000 visibles** en el tier bajo (Hubs "Medium"). La malla individual tiene un máximo de **20 000** (Roblox).
- Entidades: **n × 200**; cuerpos de física: **n × 300**; 65 535 entidades como máximo (DCL).
- Materiales únicos: **min(log2(n+1) × 20, 25)**; texturas: **min(⌊log2(n+1) × 10⌋, 32)**.
- Texturas: ≤ **2048²** para base color/emisivo y ≤ **1024²** para normales, ORM y AO (pipeline de Third Room). **Prohibido > 2048** (Spoke). VRAM estimada (con mips, sin comprimir) ≤ **256 MB** por mundo.
- Luces dinámicas: **≤ 3** (Spoke); el resto, horneadas o lightmap.
- Peso: **15 MB por chunk, tope 300 MB por mundo**, archivo individual ≤ 50 MB (DCL). Subida de asset suelto ≤ 12 MB (Hyperfy) y GLB de escena < 16 MB para el "pase verde" (Spoke).
- Altura: **log2(n+1) × 20 m** (DCL). La geometría fuera del chunk asignado se recorta y los colliders que cruzan el borde se desactivan.
- Como DCL, mostramos el avance contra el presupuesto en el editor (naranja al 80 %). Rechazamos al publicar solo lo que rompe el techo absoluto.

**2. (b) Cuatro tiers de calidad automáticos, decididos por detect-gpu + RAM + FPS medido.** Tier 0 corresponde a Android de 2-4 GB, el ~60 % del Android de Roblox:
- **T0 (Android 2-4 GB / gpuTier 0-1)**: `hardwareScalingLevel` = 2 (renderScale **0.5**, Vircadia), **sin sombras dinámicas** (Third Room Low), materiales **unlit/Lambert** en lugar de PBR (Hubs low), texturas limitadas a **512** (Vircadia), sin MSAA ni postproceso, radio de carga de **2 chunks**, 30 FPS objetivo, audio con panning "equal power" (bug de Android, Hubs).
- **T1 (gpuTier 2)**: renderScale 0.75, sombra blob o una cascada de **512**, PBR sin IBL caro, texturas de 1024, radio de 3 chunks.
- **T2 (gpuTier 3)**: renderScale 1.0, sombra 1024, MSAA 4, texturas de 2048, radio de 5 chunks.
- **T3 (escritorio)**: sombra en cascada 2048, postproceso.
- Siempre ajuste dinámico: si la mediana de FPS de 5 s baja de 30, bajamos la escala, y si pasa de 48 la subimos. Esperamos 30 s tras cargar y como máximo 3 bajadas (Hubs `auto-pixel-ratio`). Además, `SceneOptimizer` de Babylon en T0/T1 (Vircadia). Las preferencias que crashean no se persisten hasta pasado un tiempo (Hyperfy).

**3. (c) El World Doc se trocea en chunks de 16 m con streaming por anillos e histéresis.** Cada chunk es un documento propio (manifest + lista de entidades + referencias a assets por hash), cargable de forma independiente, como `<m-frame>` de MML o las escenas por parcela de DCL. El cliente carga a radio R y descarga a R+1 (noa: add 2 / remove 3; DCL `UnloadTolerance = 1`). Peticiones en lotes (DCL: 6 escenas por petición; Voxelize: 12 peticiones de chunk por update). Como Roblox, mantenemos un núcleo "persistente" (spawn, UI, scripts globales) y aplicamos **PauseOutsideLoadedArea**: si el jugador entra en un chunk sin cargar, se le congela en lugar de dejarlo caer.

**4. Más allá del radio de carga, impostores o LOD por chunk generados en el servidor al publicar.** Igual que los LOD de escena de DCL y SLIM de Roblox: una malla fusionada y simplificada por chunk con un atlas de 256-512 px. Así el horizonte nunca queda vacío y cuesta 1 draw call por chunk lejano. El presupuesto de memoria de los LOD va aparte (DCL: un LOD LQ equivale a MaxScene/30).

**5. Optimización al publicar, no en el cliente.** En el pipeline de ingesta del World Doc, con gltf-transform: dedupe → **auto-instancing (`EXT_mesh_gpu_instancing`)** → resize (2048/1024) → **KTX2 (ETC1S para color, UASTC para normales)** → meshopt/Draco → cálculo de métricas para el validador (#1). Es la lección de Third Room y de los asset bundles de DCL. En Babylon: `KHR_texture_basisu`, `EXT_meshopt_compression` y `EXT_mesh_gpu_instancing` → thin instances.

**6. Presupuestos por frame explícitos en todos los sistemas incrementales.** Como máximo **8 mallas o chunks instanciados por frame**, **≤ 3-5 ms por frame para streaming y mallado** (noa 5/3 ms, Voxelize 8 meshes y 5 ms de luces), comprobación de LOD amortizada con un cursor (≤ 1000 nodos por frame, Hyperfy). Usamos `freezeWorldMatrix`, `doNotSyncBoundingInfo`, `isPickable=false` y `freezeActiveMeshes` en lo estático (noa, T5C), y octree de selección de Babylon por chunk. Origin rebasing cada ~25-100 m si el mundo supera ~2 km (noa).

**7. El sandbox de scripts UGC va en un Web Worker con un intérprete aislado (QuickJS-WASM o SES) y API de capacidades, con tick fijado por el host según la distancia.** Igual que el V8 por escena de DCL, el WASM de 64 MB de Third Room y las capacidades de Roblox. Nada de `eval` en el hilo principal (los errores de Janus y Webaverse). Cuotas: memoria fija (32-64 MB por mundo), tiempo de CPU por tick (interrupt handler) y **tick JS de 30 Hz en el chunk actual, 15/10/5 Hz en anillos lejanos y 1 Hz si está fuera de cámara** (fpsBuckets de DCL). El script solo modifica entidades de su mundo o chunk (el recorte por parcela de DCL y el `Sandboxed` de Roblox). Para MVP, SES Compartments (Hyperfy) es lo más barato de integrar, y QuickJS-WASM en worker es el objetivo.

**8. Red: servidor autoritativo ligero por instancia de mundo con interest management por chunk y tasa adaptativa.** Usamos un modelo de salas tipo Colyseus (T5C) con filtro AOI por chunk (`ChunkInterests` de Voxelize, `@filterChildren` de T5C con unos 30 m). Movimiento a **10 Hz en marcha que decae a 1 Hz quieto** (DCL), cuantizado y en binario (msgpack o deltas comprimidos tipo DeltaNet). Mensajes unreliable ≤ 1000 bytes (Roblox). Shards: 20-50 jugadores por instancia (T5C 20, Cubzh `maxPlayers` por juego) y más instancias cuando se llenan. Evitamos P2P con host electo (Third Room) en móviles con NAT y batería.

**9. Voz con un SFU gestionado (LiveKit) solo para pares cercanos, opcional y desactivada por defecto en T0.** Hubs, Hyperfy y DCL convergen en SFU (mediasoup o LiveKit). DCL asigna "islas" por proximidad (Archipelago). Limitamos a los N oradores más cercanos (p. ej. 8) y mono, y explicamos en la UI el coste de datos. El audio mezclado en servidor (Overte/Vircadia) es una mejora futura para gama baja.

**10. Sostenibilidad: desde el día 1, coste de infraestructura mínimo y mundos pequeños que se llenan.** Hubs murió por el coste de operar sin ingresos, Third Room al perder financiación, Webaverse y DCL por la ambición técnica y la especulación con tierra (mundo vacío). Janus y el prototipo "cada página es una sala" no retuvieron usuarios. Para el MVP: hosting estático y CDN para chunks y assets (direccionados por hash, cacheables e inmutables), un solo tipo de servidor de salas stateless que escale a cero, nada de escasez artificial de tierra, y medición real en un dispositivo base (Roblox recomienda Moto G05, Infinix Smart 9 y Oppo A18) en CI manual antes de cada release.

---

### Fuentes web adicionales
- [Mozilla: futuro de Hubs](https://hubs.mozilla.com/labs/sunset) · [RoadToVR](https://roadtovr.com/mozilla-hubs-shutdown-web-xr/) · [Ryan Schultz: Hubs CE](https://ryanschultz.com/category/mozilla-hubs/)
- [Matrix holiday update 2023](https://matrix.org/blog/2023/12/25/the-matrix-holiday-update-2023/) · [The New Stack: Third Room](https://thenewstack.io/third-room-teases-user-generated-content-for-the-metaverse/)
- [The Defiant: Hyperfy v2](https://thedefiant.io/hyperfy-launch-revives-metaverse-narrative-with-ai-agent-integration)
- [Improbable: Otherside 2nd Trip](https://improbable.io/blog/improbable-technology-powers-a-historic-achievement-for-metaverse) · [Decrypt: MSquared/MML](https://decrypt.co/145332/improbable-opens-up-tech-behind-bored-ape-metaverse)
- [Wikipedia: Decentraland](https://en.wikipedia.org/wiki/Decentraland) · [Hyperallergic](https://hyperallergic.com/769614/metaverse-decentraland-is-empty/) · [DCL scene limitations](https://docs.decentraland.org/creator/scenes-sdk7/optimizing/scene-limitations/) (bloqueado aquí; valores verificados en `unity-explorer`)
- [Ryan Schultz: JanusVR disuelve la empresa](https://ryanschultz.com/2019/12/09/janusvr-shuts-down-its-corporation-but-the-platform-will-continue/)
- [Delphi: Webaverse](https://members.delphidigital.io/media/webaverse-pioneering-an-immersive-open-source-metaverse-enabling-community-built-worlds)
- Roblox: repo `github.com/Roblox/creator-docs`, rutas `content/en-us/...` citadas arriba (espejo de create.roblox.com/docs).
