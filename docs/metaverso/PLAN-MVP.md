# Plan de MVP: mundo abierto, web y creado con IA

> Estado: propuesta v0.1 · Fecha: 2026-10-07
> Contexto: conversación sobre UGC (Roblox, UEFN, Minecraft) vs. desarrollo propio, y la idea de
> "el navegador es la consola, la IA es el Studio". Catálogo de proyectos MIT y Apache-2.0 relevados en
> [`CATALOGO-OPEN-SOURCE.md`](./CATALOGO-OPEN-SOURCE.md).

## 1. Qué queremos probar

Una sola hipótesis, medible:

> **Una familia o grupo chico puede crear y jugar juntos un mundo propio desde el navegador,
> conversando con una IA, sin instalar nada y sin saber programar, y quiere volver al día siguiente.**

El MVP **no** intenta ser "un Roblox abierto". Intenta probar el núcleo: *conversación → cambio en el
mundo → se juega al instante → persiste → se comparte con amigos*.

### Qué NO es el MVP

- No es un metaverso público con desconocidos (eso trae moderación, que es el muro real).
- No tiene economía, NFTs, tokens ni marketplace (lección de GOB, ver §9).
- No genera mundos frame a frame con modelos neuronales (tipo Genie): usamos engine + DSL.
- No compite con Unreal en gráficos.

## 2. Punto de partida: este repo

`delta` ya es un juego BabylonJS + Vite + TypeScript, PWA, deployado en GitHub Pages, jugable en
celular (controles táctiles, giroscopio). Y lo más importante: **el mundo ya está parcialmente
declarado como datos**:

- `src/utils/constants.ts` → `RIVER_MAP` (ríos como polilíneas con ancho) y `DOCK_LOCATIONS`
  (muelles con posición y rotación).
- `src/world/Environment.ts` genera árboles, casas, muelles y terreno a partir de esos datos.

Ese es el germen del **World DSL**. El MVP consiste en sacar esos datos de `constants.ts`, darles un
esquema formal, hacer que el runtime los interprete y que una IA los edite.

**Primer mundo: "El Delta".** Islas, ríos, muelles, lanchas, casas sobre pilotes. Tiene identidad
local, ya hay assets y la mecánica de la lancha colectiva funciona.

## 3. Arquitectura

```
 ┌────────────── Navegador (PWA, celular/notebook) ──────────────┐
 │  Chat / voz  ──►  Agente (cliente fino)                        │
 │                        │ propone "patch" al mundo              │
 │                        ▼                                       │
 │  World Doc (JSON, CRDT Yjs) ──► Runtime determinista ──► Render│
 │     ▲   esquema validado         ECS + reglas + física   Babylon│
 │     │                                                          │
 └─────┼──────────────────────────────────────────────────────────┘
       │ sync (WebSocket)                     ▲ assets glTF/KTX2
 ┌─────┴──────────── Servidor ────────────────┴───────────────────┐
 │  Room server (Colyseus o y-websocket)  │  API agente (LLM)      │
 │  Persistencia (Postgres + S3/R2)       │  Validador de patches  │
 │  Auth (familia / invitación)           │  Moderación de texto   │
 └────────────────────────────────────────────────────────────────┘
```

### Decisiones clave

| Decisión | Elección MVP | Por qué | Alternativa futura |
|---|---|---|---|
| Renderer | **Babylon.js** (ya está; Apache-2.0, permisiva) | No reescribir lo que funciona | three.js / PlayCanvas (MIT) detrás de una interfaz `Renderer` |
| Formato del mundo | **World DSL propio en JSON** + JSON Schema | Abierto, versionable, editable por IA y por humanos | Export a glTF + extensiones |
| Lógica | **ECS** (miniplex o becsy, MIT) | Componer comportamientos declarativos | Sistemas en WASM |
| Estado compartido del mundo | **Yjs + Hocuspocus** (CRDT, MIT) | Edición colaborativa del mundo + offline gratis | Loro / Automerge |
| Gameplay en vivo | **Colyseus** + `@colyseus/schema` (MIT) | Movimiento y física con servidor autoritativo; `orion3dgames/t5c` ya muestra Babylon + Colyseus | Shards por región |
| IA | LLM con **tool calling** sobre el DSL (proveedor intercambiable) | La IA nunca toca el runtime directo | Modelos locales para NPCs |
| Scripts "escape hatch" | **quickjs-emscripten** (MIT) en sandbox, con límites de CPU/memoria | Mecánicas que el DSL no cubre, sin romper seguridad | Luau (el lenguaje de Roblox, MIT) |
| NPCs | Árboles de comportamiento **mistreevous** (JSON) + navmesh **recast-navigation-js** | La IA escribe árboles y diálogos como datos, no código | Memoria y conversación al estilo **ai-town** |
| Física | **Havok** (incluido en Babylon) o **Rapier** (Apache-2.0, determinista) | Rapier si el servidor tiene que simular igual que el cliente | cannon-es (MIT, no determinista) |
| Assets | glTF/GLB + **gltf-transform** + meshopt/KTX2 | Ya usado en el repo (`@gltf-transform/cli`) | Generación text-to-3D curada |
| Distribución | PWA por link + GitHub Pages/Cloudflare | Cero instalación | Portales web (Poki, CrazyGames), Discord Activities |

> El catálogo (`CATALOGO-OPEN-SOURCE.md`) lista las alternativas MIT y Apache-2.0 verificadas para cada capa.

## 4. El World DSL (v0)

Principio: **la IA compone, el runtime ejecuta**. Referencia a estudiar antes de cerrar el esquema:
**MML** (`mml-io/mml`, MIT), un lenguaje declarativo tipo HTML para mundos 3D multijugador. La IA produce *patches* (JSON Patch / operaciones
Yjs) sobre un documento validado por esquema. Nunca escribe código del motor.

```jsonc
{
  "version": "0.1",
  "world": { "id": "delta-familia-01", "name": "El Delta de Juani", "seed": 4217 },
  "terrain": {
    "type": "islands",
    "rivers": [ { "name": "Río Luján", "width": 22, "points": [[-400,0],[-300,10],[-200,5]] } ]
  },
  "prefabs": {
    "casa_pilotes": { "model": "assets/casa_pilotes.glb", "components": { "collider": "box" } },
    "caballo":      { "model": "assets/caballo.glb", "components": { "animal": { "wander": 8 } } }
  },
  "entities": [
    { "id": "muelle_tigre", "prefab": "muelle", "pos": [-300, 0, 10], "rot": 0,
      "components": { "dock": { "passengers": 4 } } },
    { "id": "caballo_1", "prefab": "caballo", "pos": [12, 1, 40],
      "components": { "tamable": { "item": "manzana", "trust": 60 }, "mountable": {} } }
  ],
  "rules": [
    { "when": "player.delivers(passenger)", "then": ["score.add(100)"] }
  ],
  "quests": [
    { "id": "rescate", "title": "Rescatar 3 carpinchos", "goal": { "collect": "carpincho", "count": 3 } }
  ]
}
```

### Vocabulario inicial de componentes (cerrado y testeado)

`transform`, `model`, `collider`, `rigidbody`, `vehicle.boat`, `dock`, `pickup`, `inventory`,
`animal` (wander/follow/flee), `tamable`, `mountable`, `npc` (diálogo), `trigger`, `spawner`,
`timer`, `score`, `quest`, `light`, `sound`, `portal`.

Cada componente tiene: esquema JSON, sistema ECS que lo ejecuta, tests y una **descripción en lenguaje
natural** que se le pasa a la IA como documentación de herramientas.

### Herramientas del agente (tool calling)

- `world.query(selector)`: leer el mundo (qué hay cerca, qué existe).
- `world.patch(ops[])`: proponer cambios; pasan por el **validador** (esquema, presupuesto de
  entidades/polígonos, reglas de seguridad).
- `assets.search(text)`: buscar en la biblioteca curada de assets (no generar libremente en el MVP).
- `script.propose(component, source)`: solo si el DSL no alcanza; corre en el sandbox QuickJS, con tests.
- `world.preview(patch)`: aplicar en una copia, sacar captura y devolver diff legible ("agregué 4 caballos").

Todo patch es **reversible** (historial = deshacer) y visible para los demás jugadores.

## 4.b Arte y assets: el hueco de calidad actual

Hoy casi todo el mundo se dibuja **con cajas desde el código** (`MeshBuilder.CreateBox` en `Environment.ts`):
cada árbol, casa y muelle se arma con varias cajas y un material propio. Solo la lancha es un modelo real
(`public/models/lancha-optimized.glb`, generado con Tripo3D). Esto explica buena parte de la falta de calidad
y también del costo de rendimiento (miles de mallas y materiales sueltos).

Propuesta de pipeline (todas las herramientas son gratuitas):

| Paso | Herramienta | Notas |
|---|---|---|
| Kit base de assets | Packs CC0 (Kenney, Quaternius, Poly Pizza) | Estilo low-poly consistente desde el día 1, uso comercial libre |
| Modelos propios low-poly/voxel | **Blockbench** (GPL-3.0) o **MagicaVoxel** (freeware) | Ideales para el estilo "Minecraft/Roblox"; curva de aprendizaje baja |
| Modelos y animación avanzados | **Blender** (GPL) | Estándar de la industria; exporta glTF. La GPL cubre al programa, **no** a los modelos que se crean con él |
| Modelado asistido por IA | Tripo / Meshy (servicios) o TRELLIS / TripoSR (self-host) + `blender-mcp` | Para prototipos; siempre pasar por limpieza y reducción de polígonos |
| Optimización | `gltf-transform` (ya en el repo) + meshopt + KTX2 | Presupuesto por asset (p. ej. ≤ 5k triángulos, texturas ≤ 1k) |
| Uso en el motor | Prefabs del World Doc que referencian `.glb` + **instancing** | Un árbol = un modelo instanciado cientos de veces, no 3 cajas × 600 |

Para el agente de IA, la biblioteca curada de assets es lo que hace posible `assets.search(text)`: la IA elige
entre modelos buenos en lugar de generar geometría de baja calidad.

## 5. Alcance del MVP (lo que el usuario puede hacer)

1. Entrar por link (PWA), elegir avatar simple (voxel/low-poly, sin datos personales).
2. Crear un mundo desde la plantilla "Delta" o "Isla vacía".
3. Hablarle a la IA (texto; voz opcional): "poné un muelle acá", "quiero caballos que se puedan
   domesticar", "hacé una misión de rescatar carpinchos".
4. Ver el cambio en menos de 10 s y jugarlo al instante.
5. Invitar hasta 5 personas por link privado; jugar y editar juntos en tiempo real.
6. Cerrar y volver: el mundo persiste con su historial.

**Métricas de éxito:** % de sesiones con al menos un patch aceptado; tiempo hasta el primer cambio;
retención D1/D7 de grupos; % de patches rechazados por el validador (calidad del agente);
costo de IA por hora jugada.

## 6. Fases

| Fase | Duración | Entregable | Criterio de salida |
|---|---|---|---|
| **0. Refactor a datos** ✅ hecho | 1–2 sem | `world.json` + loader; `constants.ts` reemplazado por el documento; el Delta actual se carga desde JSON | Mismo juego, cero regresiones, mundo 100% en datos |
| **1. Runtime ECS + DSL v0** | 2–3 sem | 10 componentes, JSON Schema, validador, tests | Editar el JSON a mano cambia el juego en caliente |
| **2. Agente** | 2–3 sem | Chat in-game, `query/patch/preview`, deshacer | 20 pedidos de prueba con ≥80% de patches válidos |
| **3. Multijugador privado** | 2–3 sem | Yjs + Hocuspocus para el mundo, Colyseus para movimiento, salas por invitación, persistencia | 4 dispositivos editando y jugando a la vez sin divergencia |
| **4. Pulido + piloto** | 2 sem | 5–10 familias/grupos reales | Métricas de §5 medidas |
| 5. (post-MVP) Escape hatch | — | Scripts QuickJS sandbox | Mecánica nueva sin tocar el motor |

Total estimado: **9–13 semanas** con 1–2 personas, usando agentes de código para la implementación.

## 7. Seguridad y moderación (desde el día 1)

Es el costo oculto más grande de Roblox. Para el MVP lo acotamos por diseño:

- **Mundos privados por invitación** (familia/amigos): no hay contacto con desconocidos.
- Chat de texto con filtro (`obscenity` + `2Toad/Profanity`, que cubre español; ambos MIT), frases
  predefinidas para menores y sin enlaces; voz desactivada por defecto. Los filtros de palabras no alcanzan
  solos: se suma un clasificador del lado servidor.
- Los pedidos a la IA pasan por un clasificador de contenido; el validador rechaza patches fuera de
  política (texto ofensivo en carteles, etc.).
- Sin datos personales de menores: cuentas creadas por un adulto, avatares sin foto.
- Revisar COPPA (EE. UU.) y la Ley 25.326 de Protección de Datos Personales (Argentina) antes de abrir
  el piloto.

## 8. Costos y riesgos

| Riesgo | Mitigación |
|---|---|
| Costo de inferencia por usuario | La IA solo actúa al crear/modificar; el gameplay es determinista y no llama al LLM. Cache de patches frecuentes |
| "Procedural oatmeal" (variedad sin sentido) | Plantillas curadas, quests con estructura, vocabulario de componentes diseñado a mano |
| El DSL se vuelve "nuestro propio Roblox cerrado" | DSL abierto y documentado + escape hatch de scripts sandbox |
| Rendimiento en celulares baratos | Presupuesto de entidades/polígonos en el validador; LOD; KTX2; DPR ya acotado en `GameEngine.ts` |
| Distribución | Link compartible, portales web, Discord Activities. Validar con grupos reales antes de escalar |
| Dependencia de un proveedor de IA | Capa de herramientas agnóstica; probar con 2 proveedores y un modelo local |

## 9. Lecciones del proyecto anterior (GOB, 2023–2024)

En Drive está la documentación de **Guardians of the Ball** (GDD MVP, palco virtual, whitepaper,
marketplace). Lo que conviene **no repetir** y lo que sí rescatar:

- ❌ Instalable para Windows/macOS en 4K → ✅ ahora web/PWA en cualquier dispositivo.
- ❌ Economía con NFTs/tokens desde el MVP → ✅ ahora sin economía hasta validar retención.
- ❌ Metaverso público MMO desde el inicio → ✅ ahora grupos privados chicos.
- ✅ Rescatar: amigos, presencia en mapa, palco con capacidad limitada (6 personas, solo por
  invitación): el mismo patrón de "salas chicas por invitación" de este MVP. También el sistema de
  logros y el HUD con interacciones contextuales.

## 10. Próximos pasos concretos

1. Aprobar este plan y el primer mundo ("Delta").
2. Fase 0: extraer `RIVER_MAP`, `DOCK_LOCATIONS` y la generación de `Environment.ts` a `world.json` + JSON Schema.
3. Elegir ECS (miniplex vs. becsy) con una prueba de 1 día, y leer MML y `orion3dgames/t5c` como referencias.
4. Prototipo del agente con 3 herramientas (`query`, `patch`, `preview`) sobre el mundo actual.
