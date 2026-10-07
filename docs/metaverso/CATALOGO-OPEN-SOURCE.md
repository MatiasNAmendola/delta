# Catálogo de proyectos open source (MIT y Apache-2.0) para un metaverso web abierto

> Relevamiento: 2026-10-07 · Acompaña a [`PLAN-MVP.md`](./PLAN-MVP.md)

## Resumen

- **151 repositorios únicos con licencia MIT verificada**, en cuatro capas (A–D): motores y mundos, plataformas y
  multijugador, avatares/ECS/IA, e infraestructura.
- **179 repositorios con licencia Apache-2.0 verificada** (sección E), que cubren las mismas capas. Apache-2.0 es
  igual de permisiva que MIT y además otorga licencia de patentes; a cambio exige conservar `NOTICE`, el texto de
  la licencia y marcar los archivos modificados (ver el final de la sección E). Hay unas 30 repeticiones entre capas (p. ej. Yjs o
  three-mesh-bvh aparecen en dos).
- Se incluyeron a propósito proyectos chicos o abandonados: sirven como referencia de código aunque no se
  adopten. La columna "Último commit" indica cuáles siguen vivos.
- Al final de cada capa hay una lista de proyectos **notables que no son MIT**: algunos son permisivos
  (Apache-2.0, BSD, ISC, zlib) y se pueden usar igual; otros (GPL, AGPL, CPAL, BSL, propietarios) quedan
  descartados para el núcleo.

### Cómo se verificó

1. Candidatos por búsqueda web y conocimiento previo, incluyendo proyectos de pocas estrellas.
2. Licencia leída desde el archivo `LICENSE` del repo (vía `raw.githubusercontent.com`). Cuando la primera
   línea era solo el copyright, se leyó el texto completo para confirmar la redacción MIT. En unos pocos
   repos sin `LICENSE` en la raíz se tomó el campo `license` de `package.json`; esos casos están señalados.
3. Fecha del último commit de la rama por defecto, con un `git fetch` superficial.
4. Se volvieron a verificar de forma independiente muestras de cada lista: 10 MIT (luau, sbox-public, TRELLIS, mml,
   t5c, DivineVoxelEngine, obscenity, quickjs-emscripten, miniplex, mistreevous) y 8 Apache-2.0 (sentinel,
   tigerbeetle, BabylonJS/Editor, openfga, agents-js, blockly, js-sdk-toolchain, javy). Coinciden todas.

> ⚠️ Una licencia MIT en el código **no cubre** pesos de modelos, assets ni servicios externos (p. ej.
> TRELLIS, Ready Player Me). Eso se revisa aparte antes de usarlo.

## Mapa: capacidad de metaverso → opción recomendada (MIT o Apache-2.0)

| Capacidad | Recomendación MVP | Alternativas MIT / Apache-2.0 | Nota |
|---|---|---|---|
| Render 3D web | Babylon.js (ya en el repo, **Apache-2.0**) | three.js, playcanvas/engine, galacean, Orillusion | Si se quiere todo MIT: PlayCanvas (motor + editor abiertos) |
| Mundo voxel/bloques | DivineVoxelEngine (sobre Babylon) | noa, voxelize, minecraft-web-client | voxelize ya trae multijugador |
| Generación procedural | simplex-noise + wavefunctioncollapse | THREE.Terrain | Base del generador que maneja la IA |
| Editor de mundos | Editor propio sobre el World DSL | playcanvas/editor, supersplat, frame.js; **BabylonJS/Editor** (Apache) | La conversación con la IA es el editor principal |
| Formato de mundo declarativo | World DSL propio (JSON) | **MML** (mml-io) como referencia fuerte | MML: HTML para mundos 3D multijugador |
| ECS / lógica | miniplex o becsy | arancini, ecsy | koota es ISC (equivalente) |
| Física | Rapier (**Apache-2.0**, determinista) vía wrapper MIT | cannon-es, three-mesh-bvh | cannon-es no es determinista |
| Control del personaje | ecctrl | Sketchbook | |
| Navegación / IA de juego | recast-navigation-js + yuka | three-pathfinding | |
| NPCs con LLM | Árboles de comportamiento **mistreevous** (JSON) + memoria estilo **ai-town** | agent-town, smallville | El LLM escribe árboles y diálogos como datos |
| Quests / diálogos | inkjs | QuestJS, simple-dialogue | |
| Avatares | three-vrm + CharacterStudio | TalkingHead (lip-sync), visage | visage depende del servicio Ready Player Me |
| Herramientas para el agente (MCP) | threejs-devtools-mcp / playcanvas editor-mcp-server como modelo | blender-mcp, mcp-threejs, scene-language | El de Babylon (mcp-for-babylon) es Apache-2.0 |
| Servidor autoritativo | Colyseus + @colyseus/schema | boardgame.io, rune, lightyear | **t5c** es un RPG Babylon + Colyseus de ejemplo |
| Sync colaborativo del mundo | Yjs + Hocuspocus (o y-sweet) | Automerge, Loro, Jazz, PartyKit | Dos capas: CRDT para el mundo, netcode para movimiento |
| Voz y P2P | PeerJS o Trystero (salas chicas) | simple-peer, threejs-webrtc; **LiveKit** + agents-js (Apache) | Salas grandes y NPCs con voz: LiveKit |
| Backend y cuentas | PocketBase + better-auth | lucia (ahora solo guía) | |
| Sandbox de scripts generados | quickjs-emscripten | sebastianwessel/quickjs, SandboxJS, Luau (MIT); Javy, Wasmtime, endo/SES (Apache) | Límites de memoria y tiempo |
| Moderación | obscenity + 2Toad/Profanity (español) + nsfwjs | leo-profanity, badwords; detoxify, **Roblox/sentinel**, gpt-oss-safeguard (Apache) | Capas: filtro en cliente + clasificador en servidor |
| Pipeline de assets | glTF-Transform + meshoptimizer + ktx-parse | gltfjsx, loaders.gl | Ya hay `@gltf-transform/cli` en el repo |
| Texto/imagen → 3D | TripoSR / TRELLIS (self-host) | shap-e | Necesita GPU; revisar licencias de pesos |
| UI dentro del mundo | pmndrs/uikit + troika-three-text | three-mesh-ui | |
| WebXR | pmndrs/xr, aframe | immersive-web-sdk, IWER | Fuera del alcance del MVP |
| PWA / i18n | vite-plugin-pwa + workbox, i18next | lingui, rosetta | El repo ya es PWA |
| Economía / inventario | Fuera del MVP | formance ledger (MIT, Go); **TigerBeetle** (Apache) como libro mayor | No hay librería madura en TS |
| Permisos e identidad | PocketBase + better-auth | OpenFGA, Ory Kratos (Apache) | Permisos finos por mundo/sala post-MVP |
| Scripting visual para chicos | Post-MVP | **Blockly** (Apache) | Bloques que generan el World DSL |

## Lecciones de plataformas que murieron

Hubs (Mozilla, cerrado en 2024), Third Room (sin actividad desde 2023), Webaverse, Exokit, Ambient y los
sucesivos rebrands de XREngine muestran el mismo patrón: la tecnología funcionaba y lo que faltó fue
**hosting barato, distribución y un formato abierto** que sobreviviera al proyecto. De ahí tres reglas del
plan: no usar runtimes exóticos, no meter blockchain y mantener el formato del mundo abierto y portable.


---

## A. Motores 3D web, render, voxel, editores y mundo procedural

Verificación: LICENSE leído vía raw.githubusercontent.com (y `package.json` "license" cuando la primera línea era solo copyright); última fecha de commit vía fetch git superficial (2026-10-07).

### Repos MIT verificados (41)

| Repo | Licencia (verificada) | Último commit | Qué nos da | Capacidad metaverso | Encaje MVP |
|---|---|---|---|---|---|
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | MIT | 2026-10-07 | Motor 3D de referencia, WebGL + WebGPURenderer y TSL | rendering | alta: ecosistema enorme, WebGPU listo |
| [playcanvas/engine](https://github.com/playcanvas/engine) | MIT | 2026-10-07 | Motor de juego completo (ECS, física, audio, WebGPU) | rendering / runtime de juego | alta: motor de juego completo, MIT |
| [playcanvas/editor](https://github.com/playcanvas/editor) | MIT | 2026-10-07 | Frontend del editor visual de PlayCanvas, ahora open source | editor | alta: base de un editor para creadores |
| [playcanvas/react](https://github.com/playcanvas/react) | MIT | 2026-09-28 | Bindings React declarativos para PlayCanvas | rendering / DX | media: útil si usamos React |
| [playcanvas/supersplat](https://github.com/playcanvas/supersplat) | MIT | 2026-10-05 | Editor web de Gaussian Splats | editor / captura 3D | baja: nicho, no es el núcleo |
| [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber) | MIT | 2026-10-02 | Renderer React para three.js | rendering / UI declarativa | alta: escenas declarativas, fáciles de generar con IA |
| [pmndrs/drei](https://github.com/pmndrs/drei) | MIT | 2026-09-30 | Helpers listos para R3F (controles, cielos, texto, gizmos) | rendering / editor | alta: acelera prototipado muchísimo |
| [pmndrs/three-stdlib](https://github.com/pmndrs/three-stdlib) | MIT | 2026-06-26 | Loaders/controles de examples de three empaquetados | rendering / assets | media: dependencia útil, no crítica |
| [pmndrs/react-three-rapier](https://github.com/pmndrs/react-three-rapier) | MIT (wrapper; Rapier es Apache-2.0) | 2025-11-03 | Física Rapier en R3F | física | alta: física declarativa de buen rendimiento |
| [pmndrs/ecctrl](https://github.com/pmndrs/ecctrl) | MIT | 2026-09-06 | Controlador de personaje en 3ª persona (R3F + Rapier) | avatar / control | alta: movimiento de jugador ya hecho |
| [pmndrs/uikit](https://github.com/pmndrs/uikit) | MIT | 2026-10-02 | UI en 3D/WebXR con layout flex para three/R3F | UI en el mundo | media: HUD y paneles dentro del mundo |
| [pmndrs/xr](https://github.com/pmndrs/xr) | MIT | 2026-10-03 | WebXR (VR/AR) para R3F | XR | baja: XR después del MVP |
| [pmndrs/cannon-es](https://github.com/pmndrs/cannon-es) | MIT | 2024-01-06 | Física JS pura y ligera | física | media: sencilla pero ya poco mantenida |
| [threlte/threlte](https://github.com/threlte/threlte) | MIT | 2026-09-24 | Framework three.js para Svelte (con física y extras) | rendering | media: solo si elegimos Svelte |
| [galacean/engine](https://github.com/galacean/engine) | MIT | 2026-10-07 | Motor web TS (ex-Oasis, Ant Group), con editor | rendering / runtime | media: buen motor, comunidad sobre todo china |
| [Orillusion/orillusion](https://github.com/Orillusion/orillusion) | MIT | 2026-08-02 | Motor 3D nativo de WebGPU | rendering WebGPU | baja: solo WebGPU, cobertura limitada |
| [visgl/luma.gl](https://github.com/visgl/luma.gl) | MIT | 2026-10-05 | Abstracción GPU de bajo nivel WebGL2/WebGPU | rendering de bajo nivel | baja: demasiado bajo nivel |
| [aframevr/aframe](https://github.com/aframevr/aframe) | MIT | 2026-07-13 | Escenas por HTML/ECS sobre three, orientado a XR | rendering / XR / authoring | media: authoring simple, ideal para UGC |
| [facebook/immersive-web-sdk](https://github.com/facebook/immersive-web-sdk) | MIT | 2026-10-01 | SDK de Meta: ECS + three para WebXR | XR / runtime | baja: centrado en XR |
| [fenomas/noa](https://github.com/fenomas/noa) | MIT | 2023-05-19 | Motor voxel sobre Babylon.js (chunks, física, mundos) | mundo voxel | alta: Babylon + voxel, encaja con nuestro stack |
| [Divine-Star-Software/DivineVoxelEngine](https://github.com/Divine-Star-Software/DivineVoxelEngine) | MIT | 2026-09-20 | Motor voxel TS multihilo sobre Babylon.js | mundo voxel | alta: Babylon, activo, bien multihilo |
| [shaoruu/voxelize](https://github.com/shaoruu/voxelize) | MIT | 2026-10-07 | Motor voxel multijugador (servidor Rust + cliente three) | mundo voxel / multijugador | alta: multijugador voxel ya resuelto |
| [zardoy/minecraft-web-client](https://github.com/zardoy/minecraft-web-client) | MIT | 2026-10-02 | Cliente Minecraft completo en el navegador | mundo voxel / cliente de juego | media: referencia, demasiado ligado a MC |
| [PrismarineJS/prismarine-web-client](https://github.com/PrismarineJS/prismarine-web-client) | MIT | 2026-10-06 | Cliente web de Minecraft (Prismarine) | mundo voxel | baja: protocolo MC, mucha carga |
| [vyse12138/minecraft-threejs](https://github.com/vyse12138/minecraft-threejs) | MIT | 2023-04-16 | Clon de Minecraft pequeño en three.js + TS | mundo voxel / procedural | media: buen material de estudio, inactivo |
| [Patbox/voxelsrv](https://github.com/Patbox/voxelsrv) | MIT | 2021-09-29 | Juego voxel TS sobre noa con servidor | mundo voxel / multijugador | baja: abandonado, solo como referencia |
| [IceCreamYou/THREE.Terrain](https://github.com/IceCreamYou/THREE.Terrain) | MIT | 2026-10-01 | Generación procedural de terreno para three | procedural | media: terreno de heightmap rápido |
| [jwagner/simplex-noise.js](https://github.com/jwagner/simplex-noise.js) | MIT | 2024-07-26 | Ruido simplex 2D/3D/4D rápido en TS | procedural | alta: base de cualquier generador de mundo |
| [kchapelier/wavefunctioncollapse](https://github.com/kchapelier/wavefunctioncollapse) | MIT | 2021-03-27 | Port JS del algoritmo WFC | procedural | media: niveles por tiles/bloques |
| [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | MIT | 2026-09-30 | BVH para raycast y colisiones rápidas | rendering / colisión | alta: picking en editor, colisiones |
| [gkjohnson/three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) | MIT | 2026-10-05 | Path tracer en GPU para three | rendering (offline) | baja: miniaturas/renders de marketing |
| [mkkellogg/GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D) | MIT | 2025-10-19 | Visor de Gaussian Splats para three | rendering / captura | baja: nicho, sin mantenimiento reciente |
| [felixmariotto/three-mesh-ui](https://github.com/felixmariotto/three-mesh-ui) | MIT | 2023-03-24 | UI de texto/paneles en 3D para three | UI en el mundo | baja: inactivo, mejor uikit |
| [swift502/Sketchbook](https://github.com/swift502/Sketchbook) | MIT | 2024-10-10 | Sandbox three + cannon con personaje y vehículos | avatar / física / sandbox | media: referencia de controladores y vehículos |
| [simondevyoutube/Quick_3D_MMORPG](https://github.com/simondevyoutube/Quick_3D_MMORPG) | MIT | 2021-02-09 | MMORPG mínimo three + servidor Node | multijugador / juego | baja: didáctico, código antiguo |
| [Mugen87/yuka](https://github.com/Mugen87/yuka) | MIT | 2023-01-16 | IA de juego (steering, FSM, navmesh) | IA / NPCs | media: NPCs simples, independiente del motor |
| [donmccurdy/three-pathfinding](https://github.com/donmccurdy/three-pathfinding) | MIT | 2026-10-05 | Pathfinding sobre navmesh para three | IA / navegación | media: NPCs que se mueven |
| [isaac-mason/recast-navigation-js](https://github.com/isaac-mason/recast-navigation-js) | MIT | 2026-02-04 | Recast/Detour en WASM (navmesh + crowds) | IA / navegación | media: navmesh robusto en runtime |
| [hmans/miniplex](https://github.com/hmans/miniplex) | MIT | 2026-04-05 | ECS ligero en TS con bindings React | arquitectura / ECS | media: ECS simple para scripting UGC |
| [zabastx/mixeur](https://github.com/zabastx/mixeur) | MIT | 2026-09-15 | Editor 3D estilo Blender en web (Vue + three) | editor | baja: proyecto pequeño, inmaduro |
| [mrdoob/frame.js](https://github.com/mrdoob/frame.js) | MIT | 2025-09-18 | Editor de secuencias/timeline JS | editor / animación | baja: experimental, uso limitado |

### Repos notables que NO son MIT (impacto en decisiones)

- [BabylonJS/Babylon.js](https://github.com/BabylonJS/Babylon.js): **Apache-2.0** (2026-10-07). Es nuestro motor actual. Apache es permisiva y compatible, pero no es MIT (exige NOTICE y trae una cláusula de patentes).
- [dimforge/rapier.js](https://github.com/dimforge/rapier.js): **Apache-2.0** (2026-07-12). Motor de física WASM detrás de react-three-rapier y de los plugins de física modernos.
- [Hubs-Foundation/hubs](https://github.com/Hubs-Foundation/hubs): **MPL-2.0** (2026-08-23). Salas sociales 3D en web; copyleft débil a nivel de archivo.
- [NateTheGreatt/bitECS](https://github.com/NateTheGreatt/bitECS): **MPL-2.0** (2025-12-06). ECS de alto rendimiento.
- [theatre-js/theatre](https://github.com/theatre-js/theatre): **Apache-2.0** (core; el estudio tiene otras condiciones), 2024-04-11. Editor de animación y timeline.
- [nimadez/voxel-builder](https://github.com/nimadez/voxel-builder): **GPL-3.0** (2026-09-30). Editor voxel en Babylon; copyleft, no se puede incorporar a nuestro código.
- [jasonkneen/tiny-world-builder](https://github.com/jasonkneen/tiny-world-builder): **AGPL-3.0** (2026-10-07). Constructor de mundos voxel en three; copyleft fuerte que también cubre el uso en red.
- [brunosimon/infinite-world](https://github.com/brunosimon/infinite-world): **ISC** según package.json, sin archivo LICENSE (2023-02-05). Terreno infinito procedural.
- [trytriplex/triplex](https://github.com/trytriplex/triplex): sin LICENSE en la raíz, licencia no verificada. Editor visual para R3F; revisar antes de usarlo.

### Conclusiones clave para el MVP

- **Motor**: Babylon (Apache-2.0) se puede mantener legalmente. Si queremos un stack 100% MIT, la alternativa más directa es **PlayCanvas engine + playcanvas/editor**: motor y editor visual, los dos MIT y muy activos. La otra es **three.js + R3F + drei**: el mayor ecosistema, y JSX/escenas declarativas son fáciles de generar con IA.
- **Mundo voxel**: si nos quedamos en Babylon, **DivineVoxelEngine** (activo, multihilo) o **noa** (maduro pero sin commits desde 2023) se integran directamente. Si migramos a three, **voxelize** ya trae chunks multijugador con servidor y conviene evaluarlo primero.
- **Generación procedural**: combinar **simplex-noise.js** (heightmaps/biomas) y **wavefunctioncollapse** (estructuras) como base de un generador de mundos que la IA pueda parametrizar. **THREE.Terrain** solo si vamos con three.
- **Jugabilidad base**: física con Rapier (Apache, vía react-three-rapier o el plugin de Babylon), controlador de personaje con **ecctrl** o los patrones de **Sketchbook**, raycast y picking del editor con **three-mesh-bvh**, y NPCs con **recast-navigation-js** + **yuka**.
- **Evitar en el código**: GPL/AGPL (voxel-builder, tiny-world-builder) y MPL salvo como dependencia aislada (Hubs, bitECS). Usarlos solo como inspiración. Para el ECS de scripting UGC, **miniplex** (MIT) sustituye a bitECS.

---

## B. Plataformas de metaverso, social VR y multijugador

Verificación: `verify_repo.sh` (LICENSE en raw.githubusercontent + fecha de último commit vía `git fetch --depth 1`), 2026-10-07. Cuando la primera línea del LICENSE era solo "Copyright…", se leyó el texto y se confirmó que es la cláusula MIT ("Permission is hereby granted, free of charge…"). Log en bruto: `research/B_verify.txt`.

### Repos MIT verificados (44)

| Repo | Licencia (verificada) | Último commit | Qué nos da | Capacidad metaverso | Fit MVP |
|---|---|---|---|---|---|
| [colyseus/colyseus](https://github.com/colyseus/colyseus) | MIT | 2026-10-05 | Framework Node/TS de rooms con servidor autoritativo, matchmaking y sync de estado delta binario | servidor autoritativo / rooms / sync de estado / predicción (0.18) | alta: estándar de facto en TS, ya tiene ejemplos BabylonJS |
| [colyseus/schema](https://github.com/colyseus/schema) | MIT | 2026-10-03 | Serializador incremental binario con tipos; se puede usar fuera de Colyseus | sync de estado / delta encoding | alta: base del modelo de estado replicado |
| [colyseus/babylonjs-hide-and-seek](https://github.com/colyseus/babylonjs-hide-and-seek) | MIT | 2022-10-21 | Juego completo BabylonJS + Colyseus (lobby, rooms, sync de jugadores) | multiplayer / ejemplo BabylonJS | alta: plantilla directa para nuestro stack (código algo viejo) |
| [colyseus/colyseus-examples](https://github.com/colyseus/colyseus-examples) | MIT | 2026-02-07 | Patrones de rooms: auth, reconexión, lobby, relay | multiplayer / patrones de servidor | media: material de referencia |
| [orion3dgames/t5c](https://github.com/orion3dgames/t5c) | MIT | 2025-09-25 | RPG multijugador 3D BabylonJS + Colyseus: predicción, reconciliación, navmesh, persistencia SQLite, chat, inventario | mini-MMO / servidor autoritativo / persistencia | alta: lo más cercano a nuestro stack en un juego "de verdad" |
| [networked-aframe/networked-aframe](https://github.com/networked-aframe/networked-aframe) | MIT | 2026-06-24 | Sync de entidades multiusuario en A-Frame (WebRTC/WebSocket, voz) | mundo social / WebXR / voz | media: buenas ideas de "owner"/autoridad; está atado a A-Frame |
| [jbaicoianu/janusweb](https://github.com/jbaicoianu/janusweb) | MIT | 2026-09-11 | Cliente web de JanusXR: mundos enlazados por portales y definidos en markup HTML-like | mundo social / portales / WebXR / UGC por markup | media: referencia de "web de mundos" con hiperenlaces |
| [jbaicoianu/elation-engine](https://github.com/jbaicoianu/elation-engine) | MIT | 2026-09-04 | Motor three.js sobre el que corre JanusWeb (componentes, físicas, red) | motor de mundo / networking | baja: arquitectura vieja, útil solo para leer |
| [jbaicoianu/janus-server](https://github.com/jbaicoianu/janus-server) | MIT | 2016-04-16 | Servidor de presencia de Janus (Node) | presencia / relay | baja: abandonado; histórico |
| [webaverse/app](https://github.com/webaverse/app) | MIT | 2022-12-20 | Cliente de metaverso three.js (avatares, inventario, multijugador, IA de NPC) | mundo social / avatares / multiplayer | baja: muerto (pivotó a Upstreet); se puede minar el código |
| [exokitxr/exokit](https://github.com/exokitxr/exokit) | MIT | 2023-09-07 | "Navegador" XR nativo para correr apps WebXR | WebXR runtime | baja: proyecto muerto; aviso de lo que pasa al apostar por un runtime propio |
| [mml-io/mml](https://github.com/mml-io/mml) | MIT | 2026-03-11 | Metaverse Markup Language: escenas 3D multiusuario descritas en HTML/DOM y ejecutadas en servidor | UGC / sync de estado (DOM en servidor) / interoperable | alta: modelo de UGC con scripting seguro en servidor, encaja con IA que genera markup |
| [mml-io/3d-web-experience](https://github.com/mml-io/3d-web-experience) | MIT | 2026-06-05 | Mundo social web listo (avatares, chat, voz, MML) en three.js | mundo social / multiplayer / avatares | alta: referencia completa de cliente+servidor de mundo social |
| [mml-io/mml-starter-project](https://github.com/mml-io/mml-starter-project) | MIT | 2025-06-25 | Plantilla para crear documentos MML | UGC / tooling | media: arranque rápido para probar MML |
| [fenomas/noa](https://github.com/fenomas/noa) | MIT | 2023-05-19 | Motor voxel sobre **BabylonJS** (chunks, físicas, ECS) | sandbox voxel / UGC de bloques | alta: mismo renderer que tenemos; base para un modo tipo Minecraft |
| [voxelize/voxelize](https://github.com/voxelize/voxelize) | MIT | 2026-10-07 | Motor voxel multijugador (servidor Rust + cliente TS/three.js) | multiplayer / servidor autoritativo / chunks / sandbox | media: muy activo; servidor Rust añade stack extra |
| [zardoy/minecraft-web-client](https://github.com/zardoy/minecraft-web-client) | MIT | 2026-10-02 | Cliente Minecraft en navegador (PWA) que conecta a servidores reales | sandbox / multiplayer / PWA | media: referencia de PWA de juego de bloques en producción |
| [kevinshen56714/SkyOffice](https://github.com/kevinshen56714/SkyOffice) | MIT | 2025-12-19 | Oficina virtual 2D tipo Gather (Phaser + Colyseus + WebRTC) | mundo social / proximidad / video | media: patrones de chat/vídeo por proximidad |
| [jeeanribeiro/tag-game](https://github.com/jeeanribeiro/tag-game) | MIT | 2026-07-20 | Juego pequeño con servidor autoritativo 60 Hz, predicción + reconciliación, interpolación de snapshots | netcode / servidor autoritativo | alta: ejemplo compacto y legible de netcode correcto |
| [panaverse/metaverse-web](https://github.com/panaverse/metaverse-web) | MIT | 2022-09-20 | Material/código educativo para construir metaverso web | educativo | baja: inactivo, solo aprendizaje |
| [AmbientRun/Ambient](https://github.com/AmbientRun/Ambient) | MIT / Apache-2.0 (dual) | 2025-01-07 | Runtime multijugador (Rust + WASM) con ECS sincronizado y mods WASM | servidor autoritativo / sync ECS / UGC en WASM | baja: abandonado; gran referencia de diseño (aviso: muerto) |
| [Facepunch/sbox-public](https://github.com/Facepunch/sbox-public) | MIT | 2026-10-07 | Motor de s&box (sucesor de Garry's Mod) liberado: plataforma UGC con red integrada | plataforma UGC / multiplayer | baja: C#/Source 2 nativo, pero modelo de UGC muy valioso de leer |
| [BasisVR/Basis](https://github.com/BasisVR/Basis) | MIT | 2026-10-07 | Framework social VR open source (tipo VRChat) en Unity | social VR / avatares / red | baja: Unity; referencia de producto social VR |
| [partykit/partykit](https://github.com/partykit/partykit) | MIT | 2025-09-11 | Rooms con estado sobre Cloudflare Durable Objects | rooms / sync / edge | media: buen host serverless para rooms ligeras y Yjs |
| [yjs/yjs](https://github.com/yjs/yjs) | MIT | 2026-10-07 | CRDT de alto rendimiento para documentos compartidos | sync CRDT / edición colaborativa | alta: ideal para el editor de mundos colaborativo (no para física en tiempo real) |
| [yjs/y-websocket](https://github.com/yjs/y-websocket) | MIT | 2026-08-06 | Proveedor WebSocket para Yjs | sync CRDT | alta: transporte simple para el editor |
| [yjs/y-webrtc](https://github.com/yjs/y-webrtc) | MIT | 2024-04-28 | Proveedor P2P WebRTC para Yjs | sync CRDT P2P | media: prototipos sin servidor |
| [ueberdosis/hocuspocus](https://github.com/ueberdosis/hocuspocus) | MIT | 2026-10-07 | Servidor de backend Yjs con persistencia, auth y hooks | sync CRDT / persistencia | alta: backend listo para guardar escenas UGC |
| [automerge/automerge](https://github.com/automerge/automerge) | MIT | 2026-10-06 | CRDT JSON (Rust/WASM) con historial | sync CRDT / versionado | media: alternativa a Yjs con historial tipo git |
| [loro-dev/loro](https://github.com/loro-dev/loro) | MIT | 2026-09-30 | CRDT (Rust/WASM) con árboles movibles y time-travel | sync CRDT / árbol de escena | media: el CRDT de árbol encaja bien con la jerarquía de escena |
| [garden-co/jazz](https://github.com/garden-co/jazz) | MIT | 2026-10-06 | Framework local-first (CRDT + sync + permisos + cuentas) | sync / permisos / local-first | media: permisos por grupo útiles para la propiedad de UGC |
| [boardgameio/boardgame.io](https://github.com/boardgameio/boardgame.io) | MIT | 2026-08-10 | Motor de juegos por turnos con estado autoritativo, lobby y movimientos | servidor autoritativo (turnos) | media: modelo de "moves" deterministas, bueno para minijuegos UGC |
| [rune/rune](https://github.com/rune/rune) | MIT | 2026-08-27 | SDK de juegos multijugador web con netcode predict-rollback | netcode determinista / rollback | media: buen diseño de lógica compartida cliente/servidor |
| [latticexyz/mud](https://github.com/latticexyz/mud) | MIT | 2025-09-30 | Framework ECS para mundos autónomos on-chain | sync de estado ECS / mundos persistentes | baja: dependencia blockchain; ideas de ECS-como-base-de-datos |
| [dmotz/trystero](https://github.com/dmotz/trystero) | MIT | 2026-10-04 | Rooms P2P WebRTC sin servidor (señalización vía BitTorrent/Nostr/MQTT/Firebase…) | P2P multiplayer / voz | media: multijugador gratis para mundos pequeños o en modo offline |
| [peers/peerjs](https://github.com/peers/peerjs) | MIT | 2025-07-18 | Wrapper simple de WebRTC + servidor de señalización | P2P / voz / datos | media: voz y datos P2P |
| [feross/simple-peer](https://github.com/feross/simple-peer) | MIT | 2022-02-17 | Wrapper mínimo de WebRTC | P2P | baja: estable pero sin mantenimiento |
| [socketio/socket.io](https://github.com/socketio/socket.io) | MIT | 2026-09-29 | WebSocket con rooms, reconexión, adaptadores Redis | transporte / rooms | media: sólido para chat/lobby; muy pesado para estado de juego |
| [SocketCluster/socketcluster](https://github.com/SocketCluster/socketcluster) | MIT | 2026-08-21 | Pub/sub WebSocket escalable horizontalmente | transporte / pub-sub / escalado | baja: nicho; útil para escalar un chat global |
| [cBournhonesque/lightyear](https://github.com/cBournhonesque/lightyear) | MIT / Apache-2.0 (dual) | 2026-10-02 | Netcode para Bevy: predicción, interpolación, interest management, WebTransport | netcode / interest management / WebTransport | baja: Rust/Bevy; la mejor referencia de interest management y WebTransport |
| [geckosio/phaser-on-nodejs](https://github.com/geckosio/phaser-on-nodejs) | MIT | 2025-06-24 | Correr Phaser headless en Node para un servidor autoritativo | servidor autoritativo headless | baja: patrón aplicable a BabylonJS NullEngine |
| [pmndrs/viverse](https://github.com/pmndrs/viverse) | MIT | 2026-10-02 | Toolkit three.js/R3F para mundos (controlador de personaje, avatares, integración con VIVERSE) | mundo 3D / avatares / WebXR | media: buen controlador de personaje y flujo de publicación |
| [aframevr/aframe](https://github.com/aframevr/aframe) | MIT | 2026-07-13 | Framework WebXR declarativo con ECS | WebXR | baja: no es nuestro renderer; referencia de ECS declarativo |
| [Roblox/luau](https://github.com/Roblox/luau) | MIT | 2026-10-07 | El lenguaje de scripting tipado y en sandbox de Roblox (se puede compilar a WASM) | scripting UGC en sandbox | media: opción seria para scripting UGC seguro tipo Roblox |

### Proyectos encontrados que NO son MIT (referencias y avisos)

- [hubs-foundation/hubs](https://github.com/hubs-foundation/hubs) / [mozilla/hubs](https://github.com/mozilla/hubs) — **MPL-2.0**. Mozilla cerró el servicio en 2024 y lo pasó a la Hubs Foundation: aviso de que un mundo social pesado de hostear muere cuando lo deja su patrocinador.
- [hubs-foundation/reticulum](https://github.com/hubs-foundation/reticulum) — MPL-2.0. Servidor Elixir/Phoenix de Hubs, una ops pesada.
- [mozilla/spoke](https://github.com/mozilla/spoke) — MPL-2.0 (las partes que vienen del editor de three.js son MIT). Editor de escenas de Hubs, ya abandonado.
- [networked-aframe/naf-janus-adapter](https://github.com/networked-aframe/naf-janus-adapter) — MPL-2.0. Adaptador SFU para NAF.
- [matrix-org/thirdroom](https://github.com/matrix-org/thirdroom) — Apache-2.0. Sin commits desde 2023-07 porque se acabó la financiación. Buenas ideas: Matrix como red social y WASM scripting.
- [hyperfy-xyz/hyperfy](https://github.com/hyperfy-xyz/hyperfy) — **GPL-3.0**. Mundos 3D web autohosteables con apps; copyleft, así que no podemos integrarlo en un producto cerrado.
- [overte-org/overte](https://github.com/overte-org/overte) — Apache-2.0. Fork de High Fidelity, nativo en C++.
- [vircadia/vircadia-web](https://github.com/vircadia/vircadia-web) — Apache-2.0. Cliente web del linaje High Fidelity.
- [ir-engine/ir-engine](https://github.com/ir-engine/ir-engine) y [EtherealEngine/etherealengine](https://github.com/EtherealEngine/etherealengine) — **CPAL-1.0** (exige atribución, cláusula de red). El rebranding XREngine → Ethereal → iR muestra inestabilidad.
- [luanti-org/luanti](https://github.com/luanti-org/luanti) (ex-Minetest) — LGPL-2.1+. Modelo de mods en Lua y servidor autoritativo que vale la pena estudiar.
- [cubzh/cubzh](https://github.com/cubzh/cubzh) — **Apache-2.0** (no MIT). "Roblox open source" con scripting en Lua; último commit 2026-03.
- [timetocode/nengi](https://github.com/timetocode/nengi) — Apache-2.0 (no MIT). Netcode TS con interest management; sin actividad desde 2022.
- [lance-gg/lance](https://github.com/lance-gg/lance) — Apache-2.0. Netcode JS con predicción; sin actividad desde 2024-05.
- [geckosio/geckos.io](https://github.com/geckosio/geckos.io) y [geckosio/snapshot-interpolation](https://github.com/geckosio/snapshot-interpolation) — **BSD-3-Clause** (permisiva y compatible, pero no MIT). UDP en el navegador vía WebRTC DataChannel + interpolación de snapshots.
- [croquet/microverse](https://github.com/croquet/microverse) y [croquet/worldcore](https://github.com/croquet/worldcore) — Apache-2.0. Sync por réplica determinista (máquinas virtuales replicadas); depende de los reflectores de Croquet/Multisynq.
- [heroiclabs/nakama](https://github.com/heroiclabs/nakama) — Apache-2.0. Backend de juego completo en Go (cuentas, amigos, matchmaking, leaderboards).
- [rivet-gg/rivet](https://github.com/rivet-gg/rivet) — Apache-2.0. Orquestación de servidores de juego y actores.
- [clockworklabs/SpacetimeDB](https://github.com/clockworklabs/SpacetimeDB) — **BSL-1.1**. Base de datos y servidor para MMO; la licencia no es open source durante años.
- [hytopiagg/sdk](https://github.com/hytopiagg/sdk) — "HYTOPIA Limited Use License" (propietaria). "Roblox web" comercial y su SDK TS.
- [decentraland/sdk](https://github.com/decentraland/sdk) — Apache-2.0. SDK de escenas UGC con parcelas; un caso de cómo la dependencia cripto limitó la adopción.
- [liveblocks/liveblocks](https://github.com/liveblocks/liveblocks) — Apache-2.0 (+ partes con otras licencias). Presencia y almacenamiento colaborativo.
- [kalm/kalm.js](https://github.com/kalm/kalm.js) — Apache-2.0. [xiaonanln/goworld](https://github.com/xiaonanln/goworld) — Apache-2.0, servidor de juego distribuido con AOI en Go, inactivo desde 2022.
- [rameshvarun/netplayjs](https://github.com/rameshvarun/netplayjs) — ISC (equivalente a MIT en la práctica). Rollback P2P para juegos de navegador.
- [coderofsalvation/xrfragment](https://github.com/coderofsalvation/xrfragment) — MPL-2.0. Navegación entre mundos por URL/fragmentos en glTF.
- [M4GN9M/Rboxlo](https://github.com/M4GN9M/Rboxlo) — licencia propia ORC. Revival de Roblox: riesgo legal por la IP de Roblox, mejor evitarlo.
- WorkAdventure ([workadventure/workadventure](https://github.com/workadventure/workadventure)) — no pude verificar el archivo de licencia. Se sabe que es AGPL más condiciones comerciales; hay que tratarlo como no-MIT.

### Conclusiones clave

- **Adoptar Colyseus (+ @colyseus/schema) como servidor autoritativo de rooms.** Es MIT, está activo, es TypeScript y ya hay ejemplos con BabylonJS (hide-and-seek, t5c). Para netcode usar t5c y tag-game como patrón de predicción y reconciliación. La interpolación de snapshots se puede inspirar en geckos (BSD-3, también compatible). Para escalar interest management, mirar las ideas de lightyear y nengi.
- **Separar dos planos de sync.** Tiempo real (posiciones y física) va por Colyseus y estado binario delta. El editor y el UGC persistente (escenas, objetos, scripts) van por CRDT: Yjs + Hocuspocus, o Loro si queremos árbol de escena movible e historial. Así la colaboración tipo "Google Docs" en el editor de mundos no contamina el netcode.
- **El UGC necesita un formato declarativo y un scripting en sandbox.** MML (markup DOM ejecutado en servidor, MIT) y Luau (MIT, compilable a WASM) son las dos piezas más interesantes. Un formato tipo MML o markup es ideal para que la IA genere mundos. noa (voxel sobre BabylonJS) nos da un modo sandbox de bloques casi gratis.
- **Lecciones de proyectos muertos.** Hubs (cierre de Mozilla), Third Room (sin fondos), Webaverse (pivote), Exokit y Ambient (abandonados) y el linaje XREngine → Ethereal → iR (rebrandings y licencia CPAL) dejan tres reglas: (1) la infraestructura tiene que ser barata de autohostear (un proceso Node más un CDN, no Elixir + Janus + K8s); (2) no depender de runtimes propios ni de blockchain; (3) que la comunidad pueda sobrevivir sin nosotros, con licencia MIT y formatos abiertos (glTF, markup).
- **Vigilar la licencia de cada dependencia.** Varios proyectos "open Roblox" populares no son MIT: Cubzh es Apache, Hyperfy GPL-3, iR Engine CPAL, SpacetimeDB BSL y Hytopia propietario. Apache y BSD son compatibles con nosotros; GPL, CPAL y BSL no lo son para un núcleo permisivo. Si queremos P2P o modo offline, Trystero (MIT) sirve como multijugador sin servidor para mundos pequeños.

---

## C. Avatares, ECS, física, navegación y NPCs con IA

Verificado el 2026-10-07 con `verify_repo.sh` (LICENSE en raw.githubusercontent + fecha del último commit en HEAD vía git fetch). Si una fila dice "(pkg)", no había archivo LICENSE en la raíz y la licencia se confirmó con el campo `license` de package.json. Si dice "(texto)", la primera línea del LICENSE era solo el copyright y la licencia se confirmó como MIT por el texto "Permission is hereby granted...".

### Repos MIT verificados (36)

| Repo | License (verified) | Last commit | Qué nos da | Capacidad metaverso | Fit MVP |
|---|---|---|---|---|---|
| [pixiv/three-vrm](https://github.com/pixiv/three-vrm) | MIT | 2026-09-09 | Carga VRM 0.x/1.0 en three.js: humanoide, expresiones, spring bones, lookAt | avatar / animación | alta: el estándar abierto de avatar web |
| [M3-org/CharacterStudio](https://github.com/M3-org/CharacterStudio) | MIT | 2026-05-08 | Creador de avatares VRM por partes (traits) en el navegador, exporta VRM | avatar (creador) | alta: base de editor de avatar sin depender de un SaaS |
| [readyplayerme/visage](https://github.com/readyplayerme/visage) | MIT | 2025-07-30 | Componentes R3F para mostrar avatares GLB con animaciones y poses | avatar / visor | media: útil como referencia, va ligado al ecosistema RPM |
| [met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead) | MIT | 2026-09-25 | Avatar 3D con lip-sync en tiempo real y gestos, se integra con TTS/LLM | avatar / NPC IA (habla) | alta: NPC parlante en el navegador |
| [arpahls/avatar](https://github.com/arpahls/avatar) | MIT | 2026-09-06 | Compañero VRM animado con IA (de escritorio) | avatar / NPC IA | baja: está pensado para escritorio; solo como inspiración |
| [hmans/miniplex](https://github.com/hmans/miniplex) | MIT (texto) | 2026-04-05 | ECS de entidades como objetos con queries tipadas, bindings para React | ECS | alta: simple, el estado es serializable (encaja con un DSL) |
| [lastolivegames/becsy](https://github.com/lastolivegames/becsy) | MIT | 2026-10-01 | ECS multihilo con orden de sistemas declarativo y componentes con esquema | ECS | alta: los esquemas y el orden explícito ayudan al determinismo |
| [ecsyjs/ecsy](https://github.com/ecsyjs/ecsy) | MIT | 2025-04-13 | ECS clásico de Mozilla con componentes con esquema de tipos | ECS | media: casi sin mantenimiento, sirve de referencia de diseño |
| [isaac-mason/arancini](https://github.com/isaac-mason/arancini) | MIT | 2025-07-01 | ECS ligero orientado a objetos, con integración para R3F | ECS | media: alternativa pequeña a miniplex |
| [pmndrs/cannon-es](https://github.com/pmndrs/cannon-es) | MIT (texto) | 2024-01-06 | Motor de física 3D en JS puro, sin WASM | física | media: fácil de usar, pero lento y sin desarrollo activo |
| [pmndrs/use-cannon](https://github.com/pmndrs/use-cannon) | MIT (pkg) | 2024-02-25 | Hooks R3F para cannon-es en un worker | física | baja: proyecto estancado |
| [pmndrs/react-three-rapier](https://github.com/pmndrs/react-three-rapier) | MIT | 2025-11-03 | Wrapper R3F declarativo de Rapier (el núcleo de Rapier es Apache-2.0) | física | alta: física declarativa que encaja con el DSL |
| [liabru/matter-js](https://github.com/liabru/matter-js) | MIT | 2026-09-30 | Física 2D rígida | física (2D) | baja: solo para minijuegos 2D o UI |
| [pmndrs/ecctrl](https://github.com/pmndrs/ecctrl) | MIT | 2026-09-06 | Controlador de personaje flotante (Rapier) con cámara y animaciones | física / avatar (controlador) | alta: control de jugador listo para usar |
| [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | MIT | 2026-09-30 | BVH para raycast y colisión de personaje rápida en three.js | física ligera / colisión | alta: colisiones sin un motor de física completo |
| [isaac-mason/recast-navigation-js](https://github.com/isaac-mason/recast-navigation-js) | MIT | 2026-02-04 | Recast/Detour en WASM: generación de navmesh, pathfinding y crowds | navegación | alta: navmesh en runtime para NPCs |
| [donmccurdy/three-pathfinding](https://github.com/donmccurdy/three-pathfinding) | MIT | 2026-10-05 | Pathfinding A* sobre navmesh para three.js | navegación | media: más simple que Recast, pero no genera la navmesh |
| [Mugen87/yuka](https://github.com/Mugen87/yuka) | MIT | 2023-01-16 | IA de juego: steering, FSM, goals, percepción, grafos y navmesh | IA de juego / navegación | media: muy completo, pero sin commits desde 2023 |
| [nikkorn/mistreevous](https://github.com/nikkorn/mistreevous) | MIT | 2026-08-07 | Behaviour trees en TS definidos con JSON o un DSL (MDSL) | IA de juego (BT declarativo) | alta: un LLM puede generar o editar el BT como datos |
| [behavior3/behavior3js](https://github.com/behavior3/behavior3js) | MIT | 2018-10-21 | Behaviour trees serializados en JSON, con editor visual | IA de juego | baja: abandonado; el formato sirve de referencia |
| [Calamari/BehaviorTree.js](https://github.com/Calamari/BehaviorTree.js) | MIT (pkg) | 2023-01-10 | Behaviour trees JS sin dependencias | IA de juego | media: pequeño y simple |
| [a16z-infra/ai-town](https://github.com/a16z-infra/ai-town) | MIT | 2026-08-25 | Pueblo de agentes generativos (memoria, conversación) en TS sobre Convex | NPC IA / agentes generativos | alta: arquitectura de referencia para NPCs con LLM y un motor de simulación por ticks |
| [zoan37/agent-town](https://github.com/zoan37/agent-town) | MIT | 2023-04-17 | Demo web de Generative Agents con el LLM que aporta el usuario (window.ai) | NPC IA | baja: demo antigua, idea BYO-LLM interesante |
| [nicfok/smallville](https://github.com/nicfok/smallville) | MIT | 2024-12-16 | Framework de agentes generativos (servidor Java) con cliente JS | NPC IA | baja: el backend es Java |
| [baryhuang/mcp-threejs](https://github.com/baryhuang/mcp-threejs) | MIT | 2025-03-17 | MCP que busca y descarga modelos de Sketchfab para escenas three.js | generación de mundos por IA (assets) | media: patrón de "LLM pide assets" |
| [DmitriyGolub/threejs-devtools-mcp](https://github.com/DmitriyGolub/threejs-devtools-mcp) | MIT | 2026-03-23 | MCP con 39 tools para inspeccionar y mutar una escena three.js en vivo vía WebSocket | edición de mundos por IA (MCP) | alta: referencia directa para las tools de agente sobre el mundo |
| [deya-0x/ThreeJSMCP](https://github.com/deya-0x/ThreeJSMCP) | MIT (pkg) | 2026-01-11 | MCP de documentación de three.js (buscar clases y conceptos) | tooling IA | baja: solo da contexto de docs |
| [playcanvas/editor-mcp-server](https://github.com/playcanvas/editor-mcp-server) | MIT (texto) | 2026-09-09 | MCP oficial de PlayCanvas: el agente modifica entidades y assets del editor y verifica el resultado | edición de mundos por IA (MCP) | alta: diseño probado de tools de editor para LLM |
| [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) | MIT | 2026-10-06 | MCP que controla Blender (escena, assets, Poly Haven, Hyper3D) | generación de assets por IA | media: pipeline de contenido offline, no runtime |
| [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) | MIT | 2026-09-27 | Skills para agentes que construyen juegos three.js | tooling IA / generación de juegos | media: prompts y skills reutilizables |
| [zzyunzhi/scene-language](https://github.com/zzyunzhi/scene-language) | MIT (LICENSE.md) | 2025-07-12 | "Scene Language": un LLM genera programas de escena estructurados (investigación, en Python) | generación de mundos por IA (DSL) | media: inspiración directa para el World DSL |
| [ThePix/QuestJS](https://github.com/ThePix/QuestJS) | MIT | 2024-12-06 | Framework de aventuras de texto con quests, inventario y NPCs | quests / inventario | baja: orientado a parser de texto; el modelo de datos sirve de referencia |
| [bpkennedy/simple-dialogue](https://github.com/bpkennedy/simple-dialogue) | MIT | 2023-01-05 | Diálogos ramificados sin dependencias | diálogo NPC | media: pequeño, basado en datos |
| [inkle/inkjs](https://github.com/inkle/inkjs) | MIT (LICENSE.md) | 2022-09-01* | Runtime JS de Ink (narrativa ramificada) | diálogo / narrativa | media: formato narrativo maduro que un LLM puede escribir |
| [isaac-mason/sketches](https://github.com/isaac-mason/sketches) | MIT | 2026-05-06 | Cientos de demos R3F (ECS, física, navmesh, personajes) | ejemplos multi-área | media: ejemplos prácticos de integración |
| [donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | MIT (LICENSE.md) | 2026-10-06 | Leer, editar y optimizar glTF en JS (avatares y animaciones) | pipeline de assets / avatar | alta: normaliza los GLB/VRM que suben los usuarios |

\* inkjs: es la fecha del HEAD por defecto según el fetch; puede que haya actividad en otras ramas.

### Notables NO-MIT (verificados)

| Repo | Licencia | Last commit | Nota |
|---|---|---|---|
| [dimforge/rapier.js](https://github.com/dimforge/rapier.js) / [dimforge/rapier](https://github.com/dimforge/rapier) | Apache-2.0 | 2026-07-12 / 2026-10-06 | Física WASM, **determinista multiplataforma** (feature enhanced-determinism). Permisiva, la recomendada. |
| [NateTheGreatt/bitECS](https://github.com/NateTheGreatt/bitECS) | MPL-2.0 | 2025-12-06 | ECS SoA muy rápido. Copyleft débil, por archivo: usable como dependencia. |
| [pmndrs/koota](https://github.com/pmndrs/koota) | ISC | 2026-08-25 | ECS moderno de pmndrs. ISC es equivalente a MIT en la práctica. |
| [kripken/ammo.js](https://github.com/kripken/ammo.js) | zlib | 2026-09-22 | Bullet en WASM. Permisiva. |
| [enable3d/enable3d](https://github.com/enable3d/enable3d) | LGPL-3.0 | 2026-08-31 | three.js + ammo. Copyleft: evitar en el núcleo. |
| [joonspk-research/generative_agents](https://github.com/joonspk-research/generative_agents) | Apache-2.0 | 2023-08-11 | Código original del paper de Generative Agents (Python). |
| [MetaDyn/WorldGen](https://github.com/MetaDyn/WorldGen) | Apache-2.0 | 2025-11-10 | Texto a escena 3D (Python/ML). |
| [pandaGaume/mcp-for-babylon](https://github.com/pandaGaume/mcp-for-babylon) | Apache-2.0 | 2026-04-05 | MCP para escenas Babylon.js en vivo. |
| [BabylonJS/Babylon.js](https://github.com/BabylonJS/Babylon.js) | Apache-2.0 | 2026-10-07 | Motor completo, incluye navegación y física Havok. |
| [KhronosGroup/glTF-Blender-IO](https://github.com/KhronosGroup/glTF-Blender-IO) | Apache-2.0 | 2026-10-01 | Exportador glTF de Blender. |

### Conclusiones clave

- **Stack MIT de avatar listo**: three-vrm (runtime) + CharacterStudio (creador) + glTF-Transform (validar y optimizar lo que se sube) + ecctrl (controlador) + TalkingHead (lip-sync para NPCs). Cubren el avatar de punta a punta sin depender de un SaaS.
- **ECS para un World DSL**: miniplex y becsy (MIT) tienen entidades/componentes serializables con esquema, lo que encaja con "el LLM edita datos, no código". Koota (ISC) y bitECS (MPL-2.0) son alternativas viables. Conviene que la fuente de verdad sea el DSL y que el ECS sea su proyección en runtime.
- **Física determinista**: Rapier (Apache-2.0, a través de react-three-rapier, MIT) es la única opción madura con determinismo cross-platform. cannon-es y ammo no garantizan determinismo, así que conviene descartarlos para un runtime determinista.
- **NPC IA declarativo**: combinar los behaviour trees en JSON/MDSL de mistreevous con la navmesh de recast-navigation-js y una capa de memoria y conversación inspirada en ai-town. El LLM genera BTs y diálogos (Ink o simple-dialogue) como datos validados, nunca código ejecutable.
- **Tools de agente vía MCP**: threejs-devtools-mcp y playcanvas/editor-mcp-server (ambos MIT) son plantillas directas para nuestras tools (inspeccionar y mutar entidades y verificar). scene-language aporta la idea de un DSL de escena generado por LLM. blender-mcp y mcp-threejs cubren la obtención de assets.

---

## D. Infraestructura de plataforma

Verificación: LICENSE leído vía raw.githubusercontent.com (+ texto completo cuando la 1ª línea era solo copyright) y fecha del último commit vía `git fetch --depth 1` (fecha de consulta: 2026-10-07). "MIT (texto)" = el archivo no dice "MIT" en el encabezado pero el cuerpo es la licencia MIT literal.

### Repos MIT verificados (60)

| Repo | License (verified) | Last commit | Qué nos da | Capacidad metaverso | Fit MVP |
|---|---|---|---|---|---|
| [peers/peerjs](https://github.com/peers/peerjs) | MIT | 2025-07-18 | API WebRTC P2P simple + servidor de señalización | voz / video P2P | alta: voz por proximidad en salas pequeñas sin SFU |
| [feross/simple-peer](https://github.com/feross/simple-peer) | MIT | 2022-02-17 | Wrapper WebRTC minimalista (datos + media) | voz / datachannel | media: estable pero sin mantenimiento desde 2022 |
| [dmotz/trystero](https://github.com/dmotz/trystero) | MIT (texto) | 2026-10-04 | WebRTC sin servidor (señalización vía Nostr/MQTT/BitTorrent/Firebase) | voz / sync P2P | alta: prototipos multijugador sin backend |
| [AidanNelson/threejs-webrtc](https://github.com/AidanNelson/threejs-webrtc) | MIT | 2026-04-06 | Ejemplo three.js + WebRTC con audio posicional | voz espacial | alta: referencia directa para PositionalAudio por peer (pequeño) |
| [jure/wooglies](https://github.com/jure/wooglies) | MIT (texto) | 2021-02-28 | Experimento: interpolación de snapshots, WebRTC fiable, audio posicional, WebXR | voz espacial / netcode | baja: abandonado, útil solo como código de referencia (obscuro) |
| [goldfire/howler.js](https://github.com/goldfire/howler.js) | MIT (texto) | 2025-11-23 | Audio web con espacialización 3D (plugin spatial) | audio espacial / SFX | media: SFX/música; para voz basta Web Audio de three |
| [yjs/yjs](https://github.com/yjs/yjs) | MIT | 2026-10-07 | CRDT de referencia para estado compartido | sync estado / edición colaborativa | alta: estado del mundo durante la edición colaborativa |
| [yjs/y-websocket](https://github.com/yjs/y-websocket) | MIT | 2026-08-06 | Proveedor/servidor WebSocket para Yjs | sync estado | alta: backend de sync más simple |
| [yjs/y-webrtc](https://github.com/yjs/y-webrtc) | MIT | 2024-04-28 | Proveedor P2P para Yjs | sync estado P2P | media: útil para demos sin servidor |
| [yjs/y-indexeddb](https://github.com/yjs/y-indexeddb) | MIT | 2025-02-12 | Persistencia offline de docs Yjs en el navegador | offline / persistencia | alta: guardado local de los mundos en el editor |
| [yjs/y-protocols](https://github.com/yjs/y-protocols) | MIT | 2026-05-05 | Protocolos sync + awareness (cursores, presencia) | presencia | alta: presencia de jugadores/editores |
| [ueberdosis/hocuspocus](https://github.com/ueberdosis/hocuspocus) | MIT | 2026-10-07 | Servidor Yjs con auth, hooks y persistencia (SQLite/Redis) | sync estado / backend | alta: servidor Yjs listo para producción con hooks de auth |
| [jamsocket/y-sweet](https://github.com/jamsocket/y-sweet) | MIT | 2025-12-04 | Servidor Yjs en Rust con persistencia en S3 | sync estado / persistencia | media: buena escala, pero menos TS |
| [automerge/automerge](https://github.com/automerge/automerge) | MIT (texto) | 2026-10-06 | CRDT JSON (Rust/WASM) con historial | sync estado / versionado | media: alternativa a Yjs, con historial más rico |
| [automerge/automerge-repo](https://github.com/automerge/automerge-repo) | MIT (texto) | 2026-10-08 | Red + almacenamiento para documentos Automerge | sync / persistencia | media: si se elige Automerge |
| [loro-dev/loro](https://github.com/loro-dev/loro) | MIT | 2026-09-30 | CRDT rápido (Rust/WASM) con árboles movibles y time travel | sync estado / árbol de escena | media: el árbol movible encaja con la jerarquía de escena; más joven |
| [microsoft/FluidFramework](https://github.com/microsoft/FluidFramework) | MIT | 2026-10-06 | DDS colaborativos (SharedTree) | sync estado | baja: pesado y orientado a Azure |
| [share/sharedb](https://github.com/share/sharedb) | MIT | 2026-10-06 | Backend OT JSON en tiempo real sobre Mongo/Postgres | sync estado / persistencia | baja: OT en vez de CRDT, pero maduro |
| [tinyplex/tinybase](https://github.com/tinyplex/tinybase) | MIT | 2026-09-24 | Store reactivo con sync CRDT y persistencia (IndexedDB, SQLite, PartyKit) | estado / persistencia / inventario local | alta: muy pequeño, TS, ideal para el estado de la UI y el inventario |
| [partykit/partykit](https://github.com/partykit/partykit) | MIT | 2025-09-11 | Salas serverless en Cloudflare Durable Objects | rooms / sync / backend | alta: una sala por mundo, con Yjs integrado |
| [colyseus/colyseus](https://github.com/colyseus/colyseus) | MIT | 2026-10-05 | Servidor de juego autoritativo con rooms y sync de estado | netcode autoritativo / matchmaking | alta: gameplay en vivo autoritativo (anti-trampas) |
| [boardgameio/boardgame.io](https://github.com/boardgameio/boardgame.io) | MIT | 2026-08-10 | Motor de estado de juego por turnos con lobby | lógica de minijuegos | baja: solo para minijuegos por turnos |
| [networked-aframe/networked-aframe](https://github.com/networked-aframe/networked-aframe) | MIT | 2026-06-24 | Multiusuario para A-Frame (posiciones, voz vía adaptadores) | sync entidades / voz | media: ideas útiles, aunque está atado a A-Frame |
| [pocketbase/pocketbase](https://github.com/pocketbase/pocketbase) | MIT | 2026-09-12 | Backend en un binario: SQLite, auth, archivos, realtime | persistencia / identidad / assets | alta: guardar mundos, usuarios y uploads en el MVP sin infraestructura |
| [better-auth/better-auth](https://github.com/better-auth/better-auth) | MIT | 2026-10-03 | Framework de auth en TS (OAuth, passkeys, organizaciones, plugins) | identidad / cuentas familiares | alta: TS nativo; las organizaciones sirven de base para grupos familiares y control parental |
| [lucia-auth/lucia](https://github.com/lucia-auth/lucia) | MIT (texto) | 2026-08-08 | Ahora recurso educativo de sesiones/auth (la librería quedó deprecada) | identidad | baja: solo referencia |
| [formancehq/ledger](https://github.com/formancehq/ledger) | MIT | 2026-10-05 | Libro contable programable (doble entrada, Numscript) | economía / moneda virtual | media: contabilidad seria de la moneda; en Go, quizá sobra para el MVP |
| [robertcorponoi/shopkeepr](https://github.com/robertcorponoi/shopkeepr) | MIT | 2020-04-17 | Tiendas/inventarios con varias monedas para juegos JS | inventario / tienda | baja: pequeño y abandonado; solo inspiración (obscuro) |
| [justjake/quickjs-emscripten](https://github.com/justjake/quickjs-emscripten) | MIT | 2026-07-23 | QuickJS en WASM: ejecutar JS no confiable con límites de memoria/CPU | sandbox de scripts (IA) | alta: pieza clave para scripts generados por IA en navegador y servidor |
| [sebastianwessel/quickjs](https://github.com/sebastianwessel/quickjs) | MIT | 2026-06-07 | Runtime TS/JS sandbox sobre QuickJS con fetch/fs virtuales y timeouts | sandbox de scripts | alta: capa ergonómica sobre quickjs-emscripten (pequeño) |
| [nyariv/SandboxJS](https://github.com/nyariv/SandboxJS) | MIT | 2026-08-22 | Intérprete JS seguro en JS puro (sin eval) | sandbox de scripts | media: ligero; aislamiento más débil que WASM (pequeño) |
| [salesforce/near-membrane](https://github.com/salesforce/near-membrane) | MIT (package.json; sin LICENSE en raíz) | 2026-09-18 | Membranas/realms para aislar código en el navegador | sandbox / aislamiento de API | baja: complejo; mejor QuickJS |
| [jo3-l/obscenity](https://github.com/jo3-l/obscenity) | MIT | 2026-08-23 | Filtro de groserías robusto ante leetspeak/variantes, en TS | moderación de chat | alta: la mejor base TS para el chat infantil (solo inglés por defecto) |
| [web-mech/badwords](https://github.com/web-mech/badwords) | MIT | 2026-07-19 | Filtro clásico de malas palabras por lista | moderación | media: simple, fácil de evadir |
| [2Toad/Profanity](https://github.com/2Toad/Profanity) | MIT | 2026-03-23 | Filtro de groserías multi-idioma en TS | moderación | alta: tiene listas en varios idiomas (es incluido) |
| [jojoee/leo-profanity](https://github.com/jojoee/leo-profanity) | MIT | 2026-01-17 | Filtro de groserías con diccionarios extensibles | moderación | media: ligero y fácil de ampliar |
| [devXprite/profanity-cleaner](https://github.com/devXprite/profanity-cleaner) | MIT | 2023-02-05 | Censurado de texto pequeño y configurable | moderación | baja: abandonado (obscuro) |
| [GLINCKER/glin-profanity](https://github.com/GLINCKER/glin-profanity) | MIT (LICENSE; npm dice ISC) | 2026-09-22 | Filtro multi-idioma con detección de evasiones y ML opcional | moderación | media: prometedor; aclarar la discrepancia MIT/ISC |
| [infinitered/nsfwjs](https://github.com/infinitered/nsfwjs) | MIT | 2026-08-04 | Clasificador NSFW de imágenes en el navegador (TF.js) | moderación de imágenes/texturas UGC | alta: pre-filtro en el cliente de las texturas subidas |
| [GantMan/nsfw_model](https://github.com/GantMan/nsfw_model) | MIT | 2023-03-28 | Modelo/entrenamiento detrás de NSFWJS | moderación (servidor) | baja: solo si hay que reentrenar |
| [donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | MIT | 2026-10-06 | SDK/CLI para leer, optimizar y validar glTF (draco, meshopt, KTX2, dedup) | pipeline de assets | alta: núcleo del pipeline de assets UGC/IA |
| [zeux/meshoptimizer](https://github.com/zeux/meshoptimizer) | MIT | 2026-10-06 | Simplificación/LOD/compresión de mallas (y gltfpack) | assets / rendimiento | alta: LODs y compresión para la web |
| [donmccurdy/ktx-parse](https://github.com/donmccurdy/ktx-parse) | MIT | 2026-10-01 | Lectura/escritura de contenedores KTX2 en TS | assets / texturas | media: pieza auxiliar (pequeño) |
| [visgl/loaders.gl](https://github.com/visgl/loaders.gl) | MIT | 2026-10-07 | Loaders de muchos formatos 3D/imagen (glTF, PLY, OBJ, Draco, KTX2) | ingestión de assets | media: importar formatos no glTF |
| [pmndrs/gltfjsx](https://github.com/pmndrs/gltfjsx) | MIT | 2024-11-04 | Convierte glTF a componentes JSX + transform | assets / dev tooling | baja: solo si se usa R3F |
| [microsoft/TRELLIS](https://github.com/microsoft/TRELLIS) | MIT | 2025-11-05 | Imagen/texto → 3D (glTF) de alta calidad | generación de assets IA | media: autoalojable en GPU; revisar las licencias de dependencias y pesos |
| [VAST-AI-Research/TripoSR](https://github.com/VAST-AI-Research/TripoSR) | MIT | 2026-06-04 | Imagen → malla 3D en menos de 1 s | generación de assets IA | media: rápido y barato; la calidad es modesta |
| [openai/shap-e](https://github.com/openai/shap-e) | MIT | 2023-11-08 | Texto/imagen → 3D implícito | generación de assets IA | baja: calidad superada, sin mantenimiento |
| [protectwise/troika](https://github.com/protectwise/troika) | MIT | 2026-07-24 | troika-three-text: texto SDF en 3D con soporte RTL/CJK | UI 3D / i18n | alta: texto multilingüe en el mundo (letreros, nombres) |
| [felixmariotto/three-mesh-ui](https://github.com/felixmariotto/three-mesh-ui) | MIT | 2023-03-24 | Paneles UI dentro de three.js (VR) | UI 3D | baja: estancado desde 2023 |
| [pmndrs/uikit](https://github.com/pmndrs/uikit) | MIT (texto) | 2026-10-02 | UI 3D con flexbox (yoga) para three/R3F, kits estilo shadcn | UI 3D | alta: la UI 3D moderna y mantenida |
| [pmndrs/xr](https://github.com/pmndrs/xr) | MIT (texto) | 2026-10-03 | Helpers WebXR (manos, controles, teletransporte, capas) para three/R3F | WebXR | alta: si se apunta a Quest/visionOS |
| [meta-quest/immersive-web-emulation-runtime](https://github.com/meta-quest/immersive-web-emulation-runtime) | MIT | 2026-09-24 | Emulador WebXR (IWER) para probar sin casco | WebXR / testing | media: CI y desarrollo de XR |
| [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | MIT | 2026-09-30 | BVH para raycast/colisiones rápidas | interacción / físicas ligeras | alta: picking y colisiones en mundos UGC grandes |
| [pixiv/three-vrm](https://github.com/pixiv/three-vrm) | MIT | 2026-09-09 | Avatares VRM en three.js | avatares / identidad visual | media: avatares estándar e intercambiables |
| [GoogleChrome/workbox](https://github.com/GoogleChrome/workbox) | MIT (texto) | 2026-09-02 | Service workers y caché offline | PWA / offline | alta: cachear assets de mundos |
| [vite-pwa/vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | MIT | 2026-10-04 | PWA sin configuración para Vite (usa Workbox) | PWA | alta: instalación y offline casi gratis con Vite |
| [i18next/i18next](https://github.com/i18next/i18next) | MIT | 2026-10-04 | i18n estándar en JS | i18n UI | alta: traducciones de UI (combinar con troika en 3D) |
| [lingui/js-lingui](https://github.com/lingui/js-lingui) | MIT | 2026-10-07 | i18n con extracción de mensajes y ICU | i18n UI | media: alternativa a i18next |
| [lukeed/rosetta](https://github.com/lukeed/rosetta) | MIT | 2024-01-20 | i18n mínimo (~300B) | i18n UI | media: para runtimes de scripts / sandbox (pequeño) |

Total: **60 repos MIT verificados** (todos con LICENSE comprobado, salvo near-membrane, verificado vía package.json).

### Notables NO-MIT (verificados)

| Repo | License (verified) | Last commit | Nota |
|---|---|---|---|
| [livekit/livekit](https://github.com/livekit/livekit) | Apache-2.0 | 2026-10-07 | SFU de voz/video escalable; la opción seria para salas grandes |
| [versatica/mediasoup](https://github.com/versatica/mediasoup) | ISC | 2026-10-07 | SFU de bajo nivel en Node/C++; ISC es permisiva |
| [laverdet/isolated-vm](https://github.com/laverdet/isolated-vm) | ISC (texto) | 2026-09-25 | Isolates V8 en Node para ejecutar scripts no confiables en el servidor |
| [ricky0123/vad](https://github.com/ricky0123/vad) | ISC | 2026-09-12 | Detección de voz en el navegador (push-to-talk automático, ahorro de ancho de banda) |
| [geckosio/geckos.io](https://github.com/geckosio/geckos.io) | BSD-3-Clause | 2026-03-27 | Datachannels UDP-like cliente/servidor para netcode |
| [extism/extism](https://github.com/extism/extism) | BSD-3-Clause | 2026-09-02 | Framework de plugins WASM (sandbox multilenguaje) |
| [Agoric/endo](https://github.com/Agoric/endo) | Apache-2.0 | 2026-10-02 | SES/Compartments: JS endurecido para código no confiable |
| [wasmerio/wasmer-js](https://github.com/wasmerio/wasmer-js) | "Modified MIT" | 2026-10-06 | NO es MIT estándar; revisar antes de usar |
| [BinomialLLC/basis_universal](https://github.com/BinomialLLC/basis_universal) | Apache-2.0 | 2026-09-01 | Compresión de texturas Basis/KTX2 |
| [KhronosGroup/KTX-Software](https://github.com/KhronosGroup/KTX-Software) | Apache-2.0 | 2026-10-07 | toktx/ktx CLI para KTX2 |
| [KhronosGroup/glTF-Validator](https://github.com/KhronosGroup/glTF-Validator) | Apache-2.0 | 2026-10-06 | Validador oficial de glTF (para el gate de uploads) |
| [CesiumGS/gltf-pipeline](https://github.com/CesiumGS/gltf-pipeline) | Apache-2.0 | 2026-06-23 | Optimización glTF (Draco) |
| [tensorflow/tfjs-models](https://github.com/tensorflow/tfjs-models) | Apache-2.0 | 2026-03-28 | Incluye el modelo "toxicity" para texto en el navegador |
| [unitaryai/detoxify](https://github.com/unitaryai/detoxify) | Apache-2.0 | 2026-03-26 | Clasificador de toxicidad en Python (servidor) |
| [matrix-org/thirdroom](https://github.com/matrix-org/thirdroom) | Apache-2.0 | 2023-07-11 | Metaverso web sobre Matrix (abandonado); referencia de arquitectura |
| [daily-demos/examples](https://github.com/daily-demos/examples) | BSD-2-Clause | 2022-11-29 | Demos de espacialización de Daily (archivado) |
| [AidanNelson/YORB2020](https://github.com/AidanNelson/YORB2020) | Sin licencia clara ("contact me") | 2021-01-15 | NO usar código |
| [LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) | CC-BY-4.0 | 2020-07-13 | Listas multi-idioma; requiere atribución |

### Conclusiones clave

- **Stack MIT casi completo disponible**: Yjs + Hocuspocus/PartyKit (estado del mundo), Colyseus (gameplay autoritativo), PeerJS/Trystero (voz P2P), PocketBase + better-auth (backend e identidad), glTF-Transform + meshoptimizer (assets) y pmndrs/uikit + troika (UI 3D). Todo es MIT y TS-friendly.
- **Sandbox de scripts IA = quickjs-emscripten**: es MIT, corre igual en navegador y servidor, y permite límites de memoria/tiempo e interrupción. Alternativas: `sebastianwessel/quickjs` como capa ergonómica e isolated-vm (ISC) en el servidor. Se descartan las sandboxes basadas en `eval`/iframe para código generado por IA.
- **Moderación para niños por capas**: obscenity (EN, robusto ante evasiones) + 2Toad/Profanity (multi-idioma, incluido español) en cliente y servidor, más NSFWJS para texturas. Ninguna lista basta sola: hace falta una allowlist o chat predefinido para menores y un clasificador de servidor (detoxify/tfjs toxicity son Apache) como segunda capa.
- **Voz**: P2P (PeerJS + PositionalAudio de three, ver AidanNelson/threejs-webrtc) sirve para unas 6-8 personas. Para más hace falta SFU, y las buenas (LiveKit, Apache-2.0; mediasoup, ISC) no son MIT pero sí son permisivas. VAD de ricky0123 es ISC.
- **Huecos MIT**: no hay librería MIT madura de economía/inventario en TS (shopkeepr está abandonado; Formance ledger está en Go). Conviene construir un ledger propio sobre Postgres/PocketBase. Text-to-3D MIT existe (TRELLIS, TripoSR), pero requiere GPU propia y auditar las licencias de pesos y dependencias. Los validadores y herramientas KTX oficiales de Khronos son Apache.

---

## E. Proyectos Apache-2.0

Verificación (2026-10-07): licencia leída del fichero LICENSE en `raw.githubusercontent.com/<repo>/HEAD` y fecha del último commit en HEAD vía `git fetch --depth 1` (script `tools/verify_repo.sh`; salidas brutas en `research/F_verify.txt` y `F_verify2.txt`). "Dual" = MIT o Apache-2.0 a elección; elegimos el que más convenga.

### Repos Apache-2.0 verificados (179)

| Repo | Licencia (verificada) | Último commit | Qué nos da | Capacidad metaverso | Encaje MVP |
|---|---|---|---|---|---|
| **Renderizado y motores** ||||||
| [BabylonJS/Babylon.js](https://github.com/BabylonJS/Babylon.js) | Apache-2.0 | 2026-10-07 | Motor WebGL2/WebGPU que ya usa nuestra PWA | Render | alta: es nuestra base actual |
| [BabylonJS/Editor](https://github.com/BabylonJS/Editor) | Apache-2.0 | 2026-09-29 | Editor de escenas de escritorio para Babylon (inspector, proyectos, scripts) | Editor | alta: referencia/fork para nuestro editor de mundos |
| [BabylonJS/Exporters](https://github.com/BabylonJS/Exporters) | Apache-2.0 | 2026-04-23 | Exportadores 3ds Max/Maya → glTF/.babylon | Pipeline assets | baja: herramienta de creador de escritorio |
| [BabylonJS/Documentation](https://github.com/BabylonJS/Documentation) | Apache-2.0 | 2026-10-05 | Docs y ejemplos de Babylon, reutilizables como contexto RAG para la IA | Docs/IA | media: alimenta al asistente IA |
| [pandaGaume/mcp-for-babylon](https://github.com/pandaGaume/mcp-for-babylon) | Apache-2.0 | 2026-04-05 | Servidor MCP para que un LLM manipule una escena Babylon | IA / text-to-world | alta: puente directo LLM→escena |
| [google/filament](https://github.com/google/filament) | Apache-2.0 | 2026-10-07 | Renderizador PBR móvil/WASM de Google | Render | baja: ya tenemos Babylon; útil como referencia PBR |
| [google/model-viewer](https://github.com/google/model-viewer) | Apache-2.0 | 2026-10-06 | Web component `<model-viewer>` para previsualizar glTF/AR | Assets / XR | media: preview de assets en tienda/catálogo |
| [CesiumGS/cesium](https://github.com/CesiumGS/cesium) | Apache-2.0 | 2026-10-06 | Globo 3D y streaming 3D Tiles en web | Render / mundos grandes | baja: solo si hay mundos geoespaciales |
| [CesiumGS/cesium-native](https://github.com/CesiumGS/cesium-native) | Apache-2.0 | 2026-10-07 | Librería C++ de 3D Tiles para motores | Render / streaming | baja: lado nativo |
| [NASA-AMMOS/3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) | Apache-2.0 | 2026-10-07 | Streaming LOD de 3D Tiles en JS | Streaming de mundos | media: patrón de LOD/streaming para mundos enormes |
| [shader-slang/slang](https://github.com/shader-slang/slang) | Apache-2.0 WITH LLVM-exception | 2026-10-07 | Lenguaje de shaders que compila a WGSL/SPIR-V/HLSL | Render / shaders | media: shaders portables WebGPU |
| [google/swiftshader](https://github.com/google/swiftshader) | Apache-2.0 | 2026-09-16 | Vulkan/GL por CPU | Render / CI | baja: tests de render headless |
| [KhronosGroup/Vulkan-Samples](https://github.com/KhronosGroup/Vulkan-Samples) | Apache-2.0 | 2026-09-21 | Ejemplos oficiales Vulkan | Render | baja: solo referencia |
| [RenderKit/embree](https://github.com/RenderKit/embree) | Apache-2.0 | 2026-10-06 | Ray tracing CPU de Intel | Bake de iluminación | baja: pipeline offline de lightmaps |
| [RenderKit/oidn](https://github.com/RenderKit/oidn) | Apache-2.0 | 2026-08-14 | Denoiser de imágenes (Open Image Denoise) | Bake de iluminación | baja: bake offline |
| [o3de/o3de](https://github.com/o3de/o3de) | Dual Apache-2.0 / MIT | 2026-10-02 | Open 3D Engine (Linux Foundation), motor AAA con editor | Motor/editor | baja: no es web; referencia de arquitectura |
| [bevyengine/bevy](https://github.com/bevyengine/bevy) | Dual MIT / Apache-2.0 | 2026-10-07 | Motor ECS en Rust con build WASM/WebGPU | Motor / ECS | baja: otra pila; referencia de ECS |
| [gfx-rs/wgpu](https://github.com/gfx-rs/wgpu) | Dual MIT / Apache-2.0 | 2026-10-07 | Implementación WebGPU en Rust (Firefox) | Render / WebGPU | baja: base de motores Rust/WASM |
| [EmbarkStudios/kajiya](https://github.com/EmbarkStudios/kajiya) | Dual MIT / Apache-2.0 | 2025-07-07 | Renderer experimental de GI en tiempo real | Render | baja: investigación |
| [TheCherno/Hazel](https://github.com/TheCherno/Hazel) | Apache-2.0 | 2023-10-27 | Motor/editor educativo C++ (pequeño) | Motor/editor | baja: didáctico, inactivo |
| [libgdx/libgdx](https://github.com/libgdx/libgdx) | Apache-2.0 | 2026-10-06 | Framework de juegos Java con salida web | Motor | baja: otra pila |
| [AmbientRun/Ambient](https://github.com/AmbientRun/Ambient) | Dual MIT / Apache-2.0 | 2025-01-07 | Runtime multijugador con WASM y ECS (inactivo) | Plataforma UGC | media: diseño de referencia (WASM + ECS + red) |
| **Voxel / mundos** ||||||
| [cubzh/cubzh](https://github.com/cubzh/cubzh) | Apache-2.0 | 2026-03-01 | Plataforma UGC voxel con scripting Lua y mundos | Voxel / UGC | alta: el análogo más cercano al producto |
| [MovingBlocks/Terasology](https://github.com/MovingBlocks/Terasology) | Apache-2.0 | 2026-09-29 | Juego voxel moddable (Java) | Voxel | baja: referencia de generación de terreno y mods |
| [MovingBlocks/gestalt](https://github.com/MovingBlocks/gestalt) | Apache-2.0 | 2026-09-26 | Framework de módulos/ECS con sandbox de mods (poco conocido) | Scripting / mods | baja: patrones de sandbox de módulos |
| [MovingBlocks/DestinationSol](https://github.com/MovingBlocks/DestinationSol) | Apache-2.0 | 2026-08-23 | Juego espacial moddable sobre gestalt | Ejemplo UGC | baja: ejemplo pequeño |
| [Minestom/Minestom](https://github.com/Minestom/Minestom) | Apache-2.0 | 2026-10-05 | Servidor Minecraft desde cero, sin vanilla | Servidor voxel | baja: diseño de servidor de chunks |
| [cuberite/cuberite](https://github.com/cuberite/cuberite) | Apache-2.0 | 2025-12-16 | Servidor voxel en C++ con plugins Lua | Servidor voxel | baja: referencia |
| [feather-rs/feather](https://github.com/feather-rs/feather) | Apache-2.0 | 2024-02-19 | Servidor voxel en Rust con ECS (inactivo) | Servidor voxel | baja: referencia |
| [MetaDyn/WorldGen](https://github.com/MetaDyn/WorldGen) | Apache-2.0 | 2025-11-10 | Generación de mundos 3D a partir de texto/imagen | Text-to-world | media: prototipo de prompt→mundo |
| **Plataformas sociales / mundos virtuales** ||||||
| [matrix-org/thirdroom](https://github.com/matrix-org/thirdroom) | Apache-2.0 | 2023-07-11 | Mundos 3D sobre Matrix con WebSG/WASM (archivado) | Social VR | media: diseño de scripting WASM y federación |
| [overte-org/overte](https://github.com/overte-org/overte) | Apache-2.0 | 2026-10-04 | Fork vivo de High Fidelity: dominios, avatares, audio espacial | Social VR | media: arquitectura de servidor de dominios |
| [vircadia/vircadia](https://github.com/vircadia/vircadia) | Apache-2.0 | 2025-07-02 | Cliente/servidor nativo de mundos virtuales (ex-HiFi) | Social VR | baja: nativo |
| [vircadia/vircadia-web](https://github.com/vircadia/vircadia-web) | Apache-2.0 | 2025-12-15 | Cliente web Babylon.js para dominios Vircadia | Social VR web | alta: mismo motor que nosotros |
| [croquet/worldcore](https://github.com/croquet/worldcore) | Apache-2.0 | 2025-06-06 | Framework de mundos multijugador con modelo replicado determinista | Netcode / mundos | media: alternativa de sincronía replicada |
| [croquet/microverse](https://github.com/croquet/microverse) | Apache-2.0 | 2025-10-30 | Mundos 3D colaborativos con "behaviors" editables en vivo | Social / editor | media: edición en vivo multiusuario |
| [decentraland/sdk](https://github.com/decentraland/sdk) | Apache-2.0 | 2025-07-28 | SDK de escenas TS de Decentraland | Scripting UGC | media: modelo de API de escenas |
| [decentraland/js-sdk-toolchain](https://github.com/decentraland/js-sdk-toolchain) | Apache-2.0 | 2026-09-30 | SDK7 actual: ECS, CLI, inspector de escenas | Scripting / editor | alta: API de escenas por ECS en TS lista para estudiar |
| [decentraland/unity-explorer](https://github.com/decentraland/unity-explorer) | Apache-2.0 | 2026-10-07 | Cliente explorador actual de Decentraland | Cliente mundo | baja: Unity |
| [decentraland/catalyst](https://github.com/decentraland/catalyst) | Apache-2.0 | 2026-09-17 | Servidores de contenido/escenas federados | Contenido / hosting | media: almacenamiento por hash de contenido |
| [decentraland/builder](https://github.com/decentraland/builder) | Apache-2.0 | 2026-10-06 | Builder web de escenas y wearables | Editor | media: UX de editor web |
| **Multijugador / netcode / servidores** ||||||
| [heroiclabs/nakama](https://github.com/heroiclabs/nakama) | Apache-2.0 | 2026-09-22 | Backend de juego: cuentas, matchmaking, chat, ligas, partidas autoritativas | Servidor / social | alta: backend completo autoalojable |
| [heroiclabs/nakama-js](https://github.com/heroiclabs/nakama-js) | Apache-2.0 | 2026-06-02 | Cliente JS/TS de Nakama | Cliente red | alta: va con Nakama |
| [heroiclabs/nakama-common](https://github.com/heroiclabs/nakama-common) | Apache-2.0 | 2026-09-18 | Tipos del runtime (TS/Go) para lógica de servidor | Scripting servidor | media: lógica server en TS |
| [heroiclabs/nakama-godot](https://github.com/heroiclabs/nakama-godot) | Apache-2.0 | 2026-09-22 | Cliente Godot de Nakama | Cliente red | baja: otro motor |
| [rivet-gg/rivet](https://github.com/rivet-gg/rivet) | Apache-2.0 | 2026-10-06 | Actores con estado y orquestación de servidores de juego | Servidor / hosting | alta: salas por mundo como actores |
| [timetocode/nengi](https://github.com/timetocode/nengi) | Apache-2.0 | 2022-03-21 | Netcode JS con interpolación y predicción en cliente | Netcode | media: pequeño y en TS, aunque inactivo |
| [lance-gg/lance](https://github.com/lance-gg/lance) | Apache-2.0 | 2024-05-11 | Motor multijugador JS con extrapolación y sincronía de física | Netcode | media: referencia de sincronía de física |
| [xiaonanln/goworld](https://github.com/xiaonanln/goworld) | Apache-2.0 | 2022-08-14 | Servidor de juego distribuido en Go con espacios/AOI | Servidor MMO | baja: inactivo; diseño AOI |
| [name5566/leaf](https://github.com/name5566/leaf) | Apache-2.0 | 2022-10-21 | Framework pequeño de servidor de juegos en Go | Servidor | baja: inactivo |
| [asynkron/protoactor-go](https://github.com/asynkron/protoactor-go) | Apache-2.0 | 2026-01-18 | Actores distribuidos en Go | Servidor | baja: alternativa a actores |
| [googleforgames/agones](https://github.com/googleforgames/agones) | Apache-2.0 | 2026-10-05 | Servidores dedicados de juego en Kubernetes | Hosting | media: cuando escalemos instancias |
| [googleforgames/open-match](https://github.com/googleforgames/open-match) | Apache-2.0 | 2024-07-10 | Framework de matchmaking | Matchmaking | baja: inactivo, Nakama ya lo cubre |
| [googleforgames/quilkin](https://github.com/googleforgames/quilkin) | Apache-2.0 | 2026-10-05 | Proxy UDP para tráfico de juego | Red / anti-DDoS | baja: fase de escalado |
| [googleforgames/open-saves](https://github.com/googleforgames/open-saves) | Apache-2.0 | 2025-06-26 | Almacenamiento de partidas/estado | Persistencia | baja: dependiente de GCP |
| [uNetworking/uWebSockets.js](https://github.com/uNetworking/uWebSockets.js) | Apache-2.0 | 2026-10-03 | Servidor WebSocket muy rápido para Node | Transporte | alta: capa WS del servidor de salas |
| [uNetworking/uWebSockets](https://github.com/uNetworking/uWebSockets) | Apache-2.0 | 2026-10-05 | Núcleo C++ de uWS | Transporte | baja: lo usamos vía .js |
| [centrifugal/centrifugo](https://github.com/centrifugal/centrifugo) | Apache-2.0 | 2026-10-06 | Servidor pub/sub en tiempo real (WS/SSE/WebTransport) | Tiempo real | media: chat/presencia escalable |
| [nats-io/nats-server](https://github.com/nats-io/nats-server) | Apache-2.0 | 2026-10-07 | Bus de mensajes ligero | Backbone servidor | media: comunicar salas/servicios |
| [supabase/realtime](https://github.com/supabase/realtime) | Apache-2.0 | 2026-10-07 | Broadcast, presencia y cambios de Postgres | Tiempo real | media: presencia/lobby rápida |
| [apache/pulsar](https://github.com/apache/pulsar) | Apache-2.0 | 2026-10-07 | Streaming de eventos distribuido | Analítica / eventos | baja: escala grande |
| [google/flatbuffers](https://github.com/google/flatbuffers) | Apache-2.0 | 2026-09-14 | Serialización binaria sin copia (TS incluido) | Protocolo red | media: snapshots compactos |
| **CRDT / sincronización de estado** ||||||
| [liveblocks/liveblocks](https://github.com/liveblocks/liveblocks) | Apache-2.0 (salvo `liveblocks-server` y CLI: AGPL) | 2026-10-05 | Presencia, almacenamiento CRDT y comentarios | CRDT / colaboración | media: usar solo los paquetes cliente Apache |
| [rocicorp/mono](https://github.com/rocicorp/mono) | Apache-2.0 | 2026-10-07 | Zero/Replicache: sincronía cliente-servidor optimista | Sync de estado | media: inventarios/datos de mundo |
| [electric-sql/electric](https://github.com/electric-sql/electric) | Apache-2.0 | 2026-10-06 | Sync de Postgres en tiempo real hacia clientes | Sync de estado | media: datos persistentes del mundo |
| [instantdb/instant](https://github.com/instantdb/instant) | Apache-2.0 | 2026-09-28 | Base de datos en tiempo real con presencia | Sync / BaaS | media: prototipado rápido |
| **Voz / WebRTC / audio espacial** ||||||
| [livekit/livekit](https://github.com/livekit/livekit) | Apache-2.0 | 2026-10-07 | SFU WebRTC (voz, vídeo, datos) | Voz | alta: chat de voz por proximidad |
| [livekit/client-sdk-js](https://github.com/livekit/client-sdk-js) | Apache-2.0 | 2026-10-07 | SDK de navegador de LiveKit | Voz | alta: va con LiveKit |
| [livekit/components-js](https://github.com/livekit/components-js) | Apache-2.0 | 2026-09-25 | Componentes React/JS de UI de llamadas | Voz UI | media: UI de voz |
| [livekit/node-sdks](https://github.com/livekit/node-sdks) | Apache-2.0 | 2026-09-21 | SDK de servidor (tokens, salas) | Voz backend | alta: emitir tokens de sala |
| [livekit/egress](https://github.com/livekit/egress) | Apache-2.0 | 2026-10-07 | Grabación/streaming de salas | Voz / moderación | media: grabar para revisar denuncias |
| [livekit/agents](https://github.com/livekit/agents) | Apache-2.0 | 2026-10-07 | Agentes de voz en tiempo real (STT-LLM-TTS) en Python | NPC de voz | alta: NPC que hablan |
| [livekit/agents-js](https://github.com/livekit/agents-js) | Apache-2.0 | 2026-10-07 | Lo mismo en TypeScript/Node | NPC de voz | alta: misma pila TS |
| [jitsi/jitsi-videobridge](https://github.com/jitsi/jitsi-videobridge) | Apache-2.0 | 2026-10-05 | SFU WebRTC de Jitsi | Voz | baja: alternativa a LiveKit |
| [jitsi/lib-jitsi-meet](https://github.com/jitsi/lib-jitsi-meet) | Apache-2.0 | 2026-10-06 | Cliente JS de bajo nivel para Jitsi | Voz | baja: alternativa |
| [jitsi/jitsi-meet](https://github.com/jitsi/jitsi-meet) | Apache-2.0 | 2026-10-07 | App completa de videoconferencia | Voz / eventos | baja: eventos en vivo |
| [OpenVidu/openvidu](https://github.com/OpenVidu/openvidu) | Apache-2.0 | 2026-10-07 | Plataforma WebRTC (ahora sobre LiveKit) | Voz | baja: capa extra |
| [Kurento/kurento](https://github.com/Kurento/kurento) | Apache-2.0 | 2026-04-19 | Servidor multimedia WebRTC con filtros | Voz / medios | baja: legado |
| [resonance-audio/resonance-audio-web-sdk](https://github.com/resonance-audio/resonance-audio-web-sdk) | Apache-2.0 | 2018-04-26 | Audio espacial ambisónico en Web Audio | Audio espacial | media: espacializar voces (antiguo pero estable) |
| [resonance-audio/resonance-audio](https://github.com/resonance-audio/resonance-audio) | Apache-2.0 | 2022-09-08 | Núcleo C++ de Resonance Audio | Audio espacial | baja: nativo |
| [GoogleChrome/omnitone](https://github.com/GoogleChrome/omnitone) | Apache-2.0 | 2026-09-18 | Decodificador ambisónico y binaural para web | Audio espacial | media: audio ambiente 360 |
| [google/songbird](https://github.com/google/songbird) | Apache-2.0 | 2018-04-26 | Audio espacial web basado en Omnitone (pequeño, archivado) | Audio espacial | baja: reemplazado por Resonance |
| **Física** ||||||
| [dimforge/rapier](https://github.com/dimforge/rapier) | Apache-2.0 | 2026-10-06 | Motor de física 2D/3D determinista en Rust | Física | alta: física determinista para red |
| [dimforge/rapier.js](https://github.com/dimforge/rapier.js) | Apache-2.0 | 2026-07-12 | Bindings WASM/JS de Rapier | Física | alta: física en navegador y servidor |
| [dimforge/parry](https://github.com/dimforge/parry) | Apache-2.0 | 2026-10-06 | Detección de colisiones y consultas geométricas | Física | media: raycasts/colisiones del servidor |
| [dimforge/nalgebra](https://github.com/dimforge/nalgebra) | Apache-2.0 | 2026-09-30 | Álgebra lineal en Rust | Matemáticas | baja: dependencia |
| [google-deepmind/mujoco](https://github.com/google-deepmind/mujoco) | Apache-2.0 | 2026-10-07 | Física de cuerpos articulados (tiene build WASM) | Física / personajes | baja: ragdolls/robots avanzados |
| [google/brax](https://github.com/google/brax) | Apache-2.0 | 2026-10-07 | Física diferenciable en JAX | Entrenar locomoción | baja: investigación |
| [Genesis-Embodied-AI/Genesis](https://github.com/Genesis-Embodied-AI/Genesis) | Apache-2.0 | 2026-10-06 | Simulador físico generativo para IA encarnada | Física / IA | baja: investigación |
| **Avatares / animación / captura** ||||||
| [theatre-js/theatre](https://github.com/theatre-js/theatre) | Apache-2.0 (`@theatre/core`; `@theatre/studio` es AGPL) | 2024-04-11 | Secuenciador de animación y cinemáticas para web | Animación | media: solo el core en runtime |
| [google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe) | Apache-2.0 | 2026-10-07 | Seguimiento de cara, manos y pose en navegador | Avatares | alta: avatar animado por la webcam |
| [tensorflow/tfjs-models](https://github.com/tensorflow/tfjs-models) | Apache-2.0 | 2026-03-28 | Modelos JS: pose, face-landmarks, toxicity | Avatares / moderación | alta: clasificador de toxicidad en cliente |
| [tensorflow/tfjs](https://github.com/tensorflow/tfjs) | Apache-2.0 | 2026-04-06 | ML en navegador (WebGL/WebGPU/WASM) | Runtime IA | media: base de tfjs-models |
| [open-mmlab/mmpose](https://github.com/open-mmlab/mmpose) | Apache-2.0 | 2025-08-04 | Estimación de pose 2D/3D | Mocap | baja: lado servidor |
| [open-mmlab/mmhuman3d](https://github.com/open-mmlab/mmhuman3d) | Apache-2.0 | 2024-09-19 | Recuperación de cuerpo humano paramétrico | Mocap / avatares | baja: investigación |
| [openxrlab/xrmocap](https://github.com/openxrlab/xrmocap) | Apache-2.0 | 2025-07-01 | Mocap multivista (poco conocido) | Mocap | baja: estudio de captura |
| [openxrlab/xrprimer](https://github.com/openxrlab/xrprimer) | Apache-2.0 | 2025-07-01 | Base de cámaras y geometría para XR (poco conocido) | XR / visión | baja |
| [openxrlab/xrfeitoria](https://github.com/openxrlab/xrfeitoria) | Apache-2.0 | 2025-09-14 | Render sintético en Blender/Unreal (poco conocido) | Datos sintéticos | baja |
| [Unity-Technologies/ml-agents](https://github.com/Unity-Technologies/ml-agents) | Apache-2.0 | 2026-10-07 | Entrenamiento de comportamientos de agentes por RL | NPC | baja: atado a Unity; ideas de RL |
| **NPC / agentes LLM / text-to-world** ||||||
| [joonspk-research/generative_agents](https://github.com/joonspk-research/generative_agents) | Apache-2.0 | 2023-08-11 | Agentes generativos con memoria, reflexión y planificación (Smallville) | NPC | media: arquitectura de memoria de NPC |
| [OpenBMB/AgentVerse](https://github.com/OpenBMB/AgentVerse) | Apache-2.0 | 2024-09-09 | Simulación multi-agente LLM | NPC | baja: inactivo |
| [letta-ai/letta](https://github.com/letta-ai/letta) | Apache-2.0 | 2026-09-10 | Agentes con memoria persistente (ex-MemGPT) | NPC | media: NPC que recuerdan a cada jugador |
| [mem0ai/mem0](https://github.com/mem0ai/mem0) | Apache-2.0 | 2026-10-07 | Capa de memoria para agentes | NPC | media: memoria ligera |
| [huggingface/smolagents](https://github.com/huggingface/smolagents) | Apache-2.0 | 2026-10-06 | Agentes con herramientas que escriben código | IA creación | media: agente constructor de mundos |
| [google/adk-js](https://github.com/google/adk-js) | Apache-2.0 | 2026-10-07 | Agent Development Kit en TypeScript | IA / agentes | media: orquestar NPC/asistente en TS |
| [google/adk-python](https://github.com/google/adk-python) | Apache-2.0 | 2026-10-07 | ADK en Python | IA / agentes | baja |
| [a2aproject/A2A](https://github.com/a2aproject/A2A) | Apache-2.0 | 2026-10-07 | Protocolo agente a agente | IA / interop | baja: futuro (NPC interoperables) |
| [camel-ai/camel](https://github.com/camel-ai/camel) | Apache-2.0 | 2026-10-05 | Sociedades multi-agente con roles | NPC | baja |
| [huggingface/transformers.js](https://github.com/huggingface/transformers.js) | Apache-2.0 | 2026-10-06 | Modelos de Hugging Face en navegador (ONNX/WebGPU) | IA en cliente | alta: STT, embeddings y clasificadores sin servidor |
| [mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) | Apache-2.0 | 2026-10-03 | LLM en navegador con WebGPU | NPC en cliente | media: NPC offline/baratos |
| [mlc-ai/mlc-llm](https://github.com/mlc-ai/mlc-llm) | Apache-2.0 | 2026-10-07 | Compilador/runtime universal de LLM | IA | baja |
| [vllm-project/vllm](https://github.com/vllm-project/vllm) | Apache-2.0 | 2026-10-07 | Servidor de inferencia LLM de alto rendimiento | IA backend | media: NPC autoalojados a escala |
| [openai/gpt-oss](https://github.com/openai/gpt-oss) | Apache-2.0 | 2026-07-24 | Modelos de pesos abiertos de OpenAI (código de referencia) | IA | media: LLM autoalojable con licencia limpia |
| [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | Apache-2.0 | 2026-10-06 | STT/TTS/VAD offline, incluido WASM | Voz NPC | alta: voz de NPC y subtítulos en navegador |
| [huggingface/speech-to-speech](https://github.com/huggingface/speech-to-speech) | Apache-2.0 | 2026-10-07 | Pipeline modular VAD→STT→LLM→TTS | Voz NPC | media: alternativa a LiveKit Agents |
| [allenai/Holodeck](https://github.com/allenai/Holodeck) | Apache-2.0 | 2024-08-26 | Generación de entornos 3D interiores desde texto con LLM | Text-to-world | media: patrón prompt→layout→assets |
| [allenai/ai2thor](https://github.com/allenai/ai2thor) | Apache-2.0 | 2025-05-29 | Entornos 3D interactivos para agentes | IA encarnada | baja: Unity |
| [threestudio-project/threestudio](https://github.com/threestudio-project/threestudio) | Apache-2.0 | 2024-12-16 | Framework de generación text-to-3D | Text-to-3D | baja: GPU pesada, inactivo |
| [stepfun-ai/Step1X-3D](https://github.com/stepfun-ai/Step1X-3D) | Apache-2.0 | 2025-09-09 | Generación 3D de geometría y textura (código Apache; revisar licencia de pesos) | Text/imagen-to-3D | media: assets generados por IA |
| [3DTopia/3DTopia-XL](https://github.com/3DTopia/3DTopia-XL) | Apache-2.0 | 2025-07-14 | Generación de assets 3D PBR | Text-to-3D | baja: investigación |
| [nv-tlabs/GEN3C](https://github.com/nv-tlabs/GEN3C) | Apache-2.0 (código; pesos NVIDIA aparte) | 2026-06-15 | Vídeo/mundo con consistencia 3D | World model | baja: investigación |
| [nerfstudio-project/gsplat](https://github.com/nerfstudio-project/gsplat) | Apache-2.0 | 2026-09-19 | Entrenamiento/rasterizado de Gaussian Splatting en CUDA | Captura→mundo | media: escanear lugares reales como splats |
| **Scripting sandbox / WASM** ||||||
| [Agoric/endo](https://github.com/Agoric/endo) | Apache-2.0 | 2026-10-02 | SES/Compartments: JS endurecido para código no confiable | Sandbox scripts | alta: aislar scripts UGC en JS |
| [Agoric/agoric-sdk](https://github.com/Agoric/agoric-sdk) | Apache-2.0 | 2026-10-07 | Contratos inteligentes en JS endurecido (ERTP, ofertas) | Economía / sandbox | baja: modelo de activos digitales |
| [bytecodealliance/wasmtime](https://github.com/bytecodealliance/wasmtime) | Apache-2.0 WITH LLVM-exception | 2026-10-07 | Runtime WASM con límite de fuel/epoch | Sandbox servidor | alta: ejecutar scripts UGC en el servidor |
| [bytecodealliance/javy](https://github.com/bytecodealliance/javy) | Apache-2.0 WITH LLVM-exception | 2026-10-06 | Compila JS a WASM (QuickJS) | Sandbox scripts | alta: scripts JS de creadores → WASM |
| [bytecodealliance/jco](https://github.com/bytecodealliance/jco) | Apache-2.0 WITH LLVM-exception | 2026-10-07 | Herramientas JS para el Component Model de WASM | Sandbox / plugins | media: plugins tipados |
| [bytecodealliance/ComponentizeJS](https://github.com/bytecodealliance/ComponentizeJS) | Apache-2.0 WITH LLVM-exception | 2026-09-21 | JS → componente WASM | Sandbox scripts | media |
| [bytecodealliance/wit-bindgen](https://github.com/bytecodealliance/wit-bindgen) | Dual Apache-2.0 (LLVM-exc.) / MIT | 2026-10-07 | Bindings WIT para la API de scripting | Sandbox / API | media: definir la API de scripts en WIT |
| [bytecodealliance/wasm-micro-runtime](https://github.com/bytecodealliance/wasm-micro-runtime) | Apache-2.0 WITH LLVM-exception | 2026-09-30 | Runtime WASM diminuto (WAMR) | Sandbox | baja: embebido |
| [WasmEdge/WasmEdge](https://github.com/WasmEdge/WasmEdge) | Apache-2.0 | 2026-10-06 | Runtime WASM (CNCF) con plugins de IA | Sandbox | baja: alternativa a wasmtime |
| [wasmCloud/wasmCloud](https://github.com/wasmCloud/wasmCloud) | Apache-2.0 | 2026-10-06 | Plataforma distribuida de componentes WASM | Hosting scripts | baja |
| [spinframework/spin](https://github.com/spinframework/spin) | Apache-2.0 WITH LLVM-exception | 2026-10-06 | Framework serverless WASM | Hosting scripts | baja |
| [AssemblyScript/assemblyscript](https://github.com/AssemblyScript/assemblyscript) | Apache-2.0 | 2026-07-21 | Lenguaje tipo TS que compila a WASM | Scripting | media: scripts con sintaxis TS para creadores avanzados |
| [WebAssembly/wabt](https://github.com/WebAssembly/wabt) | Apache-2.0 | 2026-10-05 | Herramientas binarias WASM (validar/inspeccionar) | Tooling | baja: validar módulos subidos |
| [cloudflare/workerd](https://github.com/cloudflare/workerd) | Apache-2.0 | 2026-10-07 | Runtime de Workers con aislamiento V8 | Sandbox servidor | media: isolates para lógica de mundo |
| [google/gvisor](https://github.com/google/gvisor) | Apache-2.0 | 2026-10-06 | Kernel en espacio de usuario para contenedores | Aislamiento infra | baja: defensa en profundidad |
| [firecracker-microvm/firecracker](https://github.com/firecracker-microvm/firecracker) | Apache-2.0 | 2026-10-07 | microVMs (base de Lambda) | Aislamiento infra | baja |
| [google/blockly](https://github.com/google/blockly) | Apache-2.0 | 2026-10-05 | Programación visual por bloques | Scripting para niños | alta: scripting sin código en el editor |
| [google/blockly-samples](https://github.com/google/blockly-samples) | Apache-2.0 | 2026-10-05 | Plugins y ejemplos de Blockly | Scripting | media |
| **Moderación / seguridad** ||||||
| [unitaryai/detoxify](https://github.com/unitaryai/detoxify) | Apache-2.0 | 2026-03-26 | Clasificadores de toxicidad multilingües | Moderación chat | alta: filtro de chat en servidor |
| [Roblox/sentinel](https://github.com/Roblox/sentinel) | Apache-2.0 | 2026-08-06 | Detección temprana de patrones de riesgo en conversaciones (Roblox) | Seguridad infantil | alta: diseñado para UGC con menores |
| [roostorg/osprey](https://github.com/roostorg/osprey) | Apache-2.0 | 2026-10-06 | Motor de reglas de seguridad en tiempo real (de Discord, ROOST) | Moderación | media: reglas anti-abuso |
| [roostorg/coop](https://github.com/roostorg/coop) | Apache-2.0 | 2026-10-07 | Herramienta de revisión de moderación (ROOST) | Moderación | media: cola de denuncias |
| [openai/gpt-oss-safeguard](https://github.com/openai/gpt-oss-safeguard) | Apache-2.0 | 2026-01-14 | Modelo de razonamiento de seguridad que aplica una política propia | Moderación | media: aplicar nuestras propias normas |
| [ibm-granite/granite-guardian](https://github.com/ibm-granite/granite-guardian) | Apache-2.0 | 2026-08-26 | Detector de riesgos para entradas/salidas de LLM | Seguridad IA | media: proteger NPC y asistente |
| [NVIDIA/NeMo-Guardrails](https://github.com/NVIDIA/NeMo-Guardrails) | Apache-2.0 | 2026-10-07 | Guardarraíles programables para LLM | Seguridad IA | media: limitar lo que dicen los NPC |
| [guardrails-ai/guardrails](https://github.com/guardrails-ai/guardrails) | Apache-2.0 | 2026-08-26 | Validadores de salida de LLM | Seguridad IA | media |
| [protectai/rebuff](https://github.com/protectai/rebuff) | Apache-2.0 | 2024-01-25 | Detector de inyección de prompts | Seguridad IA | baja: inactivo |
| [bumble-tech/private-detector](https://github.com/bumble-tech/private-detector) | Apache-2.0 | 2023-11-05 | Clasificador de imágenes obscenas (Bumble, poco conocido) | Moderación imagen | media: filtrar texturas/imágenes subidas |
| [conversationai/perspectiveapi](https://github.com/conversationai/perspectiveapi) | Apache-2.0 | 2021-03-23 | Docs y ejemplos de Perspective API (Jigsaw) | Moderación | baja: solo la API |
| **Pipeline de assets (glTF/KTX/USD)** ||||||
| [KhronosGroup/KTX-Software](https://github.com/KhronosGroup/KTX-Software) | Apache-2.0 | 2026-10-07 | Herramientas KTX2 y transcodificador (WASM) | Texturas | alta: texturas comprimidas para GPU |
| [BinomialLLC/basis_universal](https://github.com/BinomialLLC/basis_universal) | Apache-2.0 | 2026-09-01 | Supercompresión de texturas Basis/UASTC | Texturas | alta: Babylon ya lo soporta |
| [KhronosGroup/glTF-Validator](https://github.com/KhronosGroup/glTF-Validator) | Apache-2.0 | 2026-10-06 | Validador oficial de glTF (con build JS) | Validación de subidas | alta: validar todo asset UGC |
| [KhronosGroup/glTF-Sample-Viewer](https://github.com/KhronosGroup/glTF-Sample-Viewer) | Apache-2.0 | 2026-10-06 | Visor de referencia glTF | Assets QA | media: referencia de render |
| [KhronosGroup/glTF-Sample-Renderer](https://github.com/KhronosGroup/glTF-Sample-Renderer) | Apache-2.0 | 2026-10-06 | Renderer de referencia como librería | Assets QA | media: tests de conformidad |
| [KhronosGroup/glTF-IBL-Sampler](https://github.com/KhronosGroup/glTF-IBL-Sampler) | Apache-2.0 | 2026-10-06 | Genera mapas IBL prefiltrados | Iluminación | media: entornos PBR |
| [KhronosGroup/glTF-Blender-IO](https://github.com/KhronosGroup/glTF-Blender-IO) | Apache-2.0 | 2026-10-01 | Importador/exportador glTF de Blender | Herramientas creador | media: flujo Blender→plataforma |
| [CesiumGS/gltf-pipeline](https://github.com/CesiumGS/gltf-pipeline) | Apache-2.0 | 2026-06-23 | Optimización glTF (Draco, separar/incrustar) | Pipeline | alta: procesar subidas en servidor |
| [CesiumGS/obj2gltf](https://github.com/CesiumGS/obj2gltf) | Apache-2.0 | 2025-11-19 | Conversor de OBJ a glTF | Pipeline | media: importar OBJ |
| [CesiumGS/3d-tiles-tools](https://github.com/CesiumGS/3d-tiles-tools) | Apache-2.0 | 2026-07-24 | Herramientas para empaquetar 3D Tiles | Pipeline | baja |
| [google/draco](https://github.com/google/draco) | Apache-2.0 | 2026-09-24 | Compresión de mallas (decoder WASM) | Pipeline | alta: mallas más ligeras |
| [AcademySoftwareFoundation/MaterialX](https://github.com/AcademySoftwareFoundation/MaterialX) | Apache-2.0 | 2026-10-05 | Estándar abierto de materiales | Materiales | baja: interop futura |
| [GoogleChromeLabs/squoosh](https://github.com/GoogleChromeLabs/squoosh) | Apache-2.0 | 2024-08-19 | Códecs de imagen en WASM (AVIF, WebP...) | Pipeline 2D | media: miniaturas e iconos |
| [alibaba/MNN](https://github.com/alibaba/MNN) | Apache-2.0 | 2026-09-30 | Inferencia ligera en el dispositivo | IA en móvil | baja |
| **Identidad / economía / permisos** ||||||
| [keycloak/keycloak](https://github.com/keycloak/keycloak) | Apache-2.0 | 2026-10-07 | IAM completo (OIDC, SSO, social login) | Identidad | media: pesado pero completo |
| [ory/kratos](https://github.com/ory/kratos) | Apache-2.0 | 2026-07-29 | Gestión de identidad headless | Identidad | alta: cuentas sin UI impuesta |
| [ory/hydra](https://github.com/ory/hydra) | Apache-2.0 | 2026-07-29 | Servidor OAuth2/OIDC | Identidad | media: "login con nuestra plataforma" |
| [openfga/openfga](https://github.com/openfga/openfga) | Apache-2.0 | 2026-10-07 | Autorización tipo Zanzibar (ReBAC) | Permisos UGC | alta: quién puede editar o entrar en cada mundo |
| [casbin/casbin](https://github.com/casbin/casbin) | Apache-2.0 | 2026-10-05 | Librería de control de acceso (ACL/RBAC/ABAC) | Permisos | media: más simple que OpenFGA |
| [decentralized-identity/veramo](https://github.com/decentralized-identity/veramo) | Apache-2.0 | 2026-10-06 | DIDs y credenciales verificables en TS | Identidad portable | baja: futuro |
| [openwallet-foundation/credo-ts](https://github.com/openwallet-foundation/credo-ts) | Apache-2.0 | 2026-10-07 | Framework de carteras SSI en TS | Identidad | baja |
| [tigerbeetle/tigerbeetle](https://github.com/tigerbeetle/tigerbeetle) | Apache-2.0 | 2026-10-06 | Base de datos contable de doble entrada | Economía | alta: libro mayor de la moneda virtual |
| [killbill/killbill](https://github.com/killbill/killbill) | Apache-2.0 | 2026-10-05 | Facturación y suscripciones | Economía | baja: pesado (Java) |
| [openmeterio/openmeter](https://github.com/openmeterio/openmeter) | Apache-2.0 | 2026-10-07 | Medición de uso y facturación | Economía / cuotas IA | media: medir el gasto de IA por creador |
| **XR** ||||||
| [immersive-web/webxr-polyfill](https://github.com/immersive-web/webxr-polyfill) | Apache-2.0 | 2026-07-21 | Polyfill de WebXR | XR | media: compatibilidad WebXR |
| [KhronosGroup/OpenXR-SDK-Source](https://github.com/KhronosGroup/OpenXR-SDK-Source) | Apache-2.0 | 2026-09-17 | Loader y capas de OpenXR | XR nativo | baja: solo nativo |
| [KhronosGroup/OpenXR-SDK](https://github.com/KhronosGroup/OpenXR-SDK) | Apache-2.0 | 2026-09-02 | Headers y loader de OpenXR | XR nativo | baja |
| [SceneView/sceneview-android](https://github.com/SceneView/sceneview-android) | Apache-2.0 | 2026-10-07 | AR/3D en Android sobre Filament + ARCore | XR móvil | baja: nativo |

Nota sobre el recuento: la tabla tiene **179 repos verificados como Apache-2.0** (en solitario, con LLVM-exception o en dual con MIT). Los 29 conocidos de antemano se han confirmado todos, con dos matices: **AmbientRun/Ambient** es dual MIT/Apache (el fichero principal es `LICENSE-MIT`) y **theatre-js/theatre** solo es Apache en `@theatre/core` (el studio es AGPL).

**Descartados o con salvedades (no cuentan en la tabla):** BabylonJS/BabylonNative (MIT), BabylonJS/havok (sin LICENSE en la raíz; el paquete npm es MIT), BabylonJS/Assets (CC), Igalia/wolvic (MPL-2.0), meta-quest/immersive-web-emulator, meta-quest/ProjectFlowerbed, meta-quest/webxr-first-steps y facebook/immersive-web-sdk (MIT), immersive-web/webxr-samples (licencia propia tipo MIT), Roblox/cube (RAIL solo para investigación), Roblox/voice-safety-classifier (CC), meta-llama/PurpleLlama y manycore-research/SpatialLM (Llama Community License), PixarAnimationStudios/OpenUSD (Apache-2.0 *modificada* "TOST": se puede usar, pero no es Apache puro), extism/extism (BSD-3), amark/gun (MIT/Zlib/Apache: elegible pero no se ha verificado el texto Apache), libp2p/js-libp2p, ipfs/helia y spruceid/siwe (dual MIT/Apache, no incluidos por ser marginales), google-ar/arcore-android-sdk y googlevr/cardboard (licencias mixtas por directorio), supertokens/supertokens-core (mixta), highfidelity/hifi (sin LICENSE en la raíz; ver vircadia/overte), kyutai-labs/moshi (dual pero con pesos CC-BY), facebook/ThreatExchange (BSD). **OpenSimulator** (opensimulator.org) es BSD-3, no Apache: compatible, pero va en otra sección. Sobre proyectos Mozilla: los de Mozilla Reality/Hubs son MPL-2.0 o MIT, así que **ninguno** es Apache.

### Qué cambia al aceptar Apache-2.0

- **Pasan a ser primera opción por encima de las alternativas MIT:** LiveKit (+ agents-js) para voz y NPC de voz, en lugar de mediasoup/pion; Nakama o Rivet como alternativa a Colyseus cuando haga falta un backend completo (cuentas, matchmaking, ligas); para el MVP alcanza Colyseus; Rapier.js para física determinista; Agoric/endo (SES) + Javy/Wasmtime para el sandbox de scripts UGC, en lugar de solo quickjs-emscripten; Blockly para el scripting visual; OpenFGA + Ory Kratos para permisos e identidad; TigerBeetle como libro mayor de la economía; Detoxify + Roblox/sentinel + gpt-oss-safeguard para moderación; y KTX-Software/Basis/Draco/glTF-Validator/gltf-pipeline como pipeline oficial de assets. Babylon.js ya era Apache, así que nuestra base no cambia.
- **Fichero NOTICE (sección 4d):** si un proyecto Apache incluye un `NOTICE`, hay que redistribuir su contenido con nuestro producto (por ejemplo en una página "Licencias de terceros" de la PWA y en el bundle). Hay que generarlo en CI (p. ej. con `license-checker`/`cargo about`) para todo paquete Apache que entre en el build del cliente o en las imágenes del servidor.
- **Concesión de patentes (sección 3):** cada contribuidor nos da una licencia de patentes perpetua sobre su contribución. Es una ventaja sobre MIT, que no dice nada de patentes, y es importante en codecs, compresión de texturas y WebRTC. Contrapartida: si demandamos a alguien alegando que el proyecto infringe una patente, perdemos esa licencia. La política interna debe ser no litigar patentes contra dependencias.
- **Cabeceras y avisos de cambios (secciones 4a-4c):** hay que conservar las cabeceras de copyright/licencia de los ficheros copiados, incluir el texto de la Apache-2.0 y marcar los ficheros modificados ("Modified by ... 2026"). En forks (p. ej. BabylonJS/Editor, vircadia-web, nengi) lo práctico es añadir una línea de cambios en cada fichero tocado y conservar LICENSE/NOTICE en la raíz. El nombre y las marcas del proyecto original no se pueden usar para promocionarnos (sección 6).
- **Compatibilidad y licencias "trampa":** Apache-2.0 es compatible con nuestro código MIT y con GPLv3, pero **no con GPLv2-only**. Además hay que revisar los paquetes uno a uno en los monorepos: el core de Theatre.js es Apache pero el studio es AGPL; Liveblocks es Apache salvo el servidor (AGPL); en Step1X-3D, GEN3C y gpt-oss el código es Apache, pero los pesos de los modelos pueden tener otra licencia; OpenUSD usa una Apache modificada. Las variantes "WITH LLVM-exception" (Wasmtime, Javy, Slang) son incluso más permisivas al distribuir binarios.
