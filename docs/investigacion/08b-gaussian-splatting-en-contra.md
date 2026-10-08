# 08b. Gaussian Splatting para la vegetación del Delta: el caso EN CONTRA

> **Revisión del juez** (2026-10-08; veredicto en [08](08-veredicto-gaussian-splatting.md)).
> - **Niebla:** en Babylon es incorrecto que haya que implementarla a mano. El shader de splats de Babylon 7.54.3 (el del juego) incluye `fogVertex`/`fogFragment` y aplica la niebla de la escena. Lo que falta en 7 es luz, sombras (llegaron en 9.0) y una forma limpia de inyectar viento. Corregido en la sección 7.
> - **iPhone 13 Pro Max 38→78 FPS:** la fuente habla de escenas de 1 a 4 M sin decir a qué conteo corresponde. "Apenas 1M" sobreinterpreta. Corregido en la tabla 2.
> - **Números de hombre de paja:** el lado A propone 3-6k splats por árbol, no "~200k" (sección 4) ni "10-20 MB por especie" (sección 5). El experimento de la sección 13, con 50k-400k splats por árbol × 150 árboles (7,5-60 M), no prueba la propuesta de A. El veredicto define un experimento con los conteos de A.
> - **Instancing:** en Babylon 9 la malla compuesta mantiene una transformada por parte. En Babylon 7 sí vale "fusionar = un solo buffer".
> - **Confirmado por el juez:** el presupuesto de ~500k de Spark en móvil, las cifras de LeafFit (47k primitivas / 11,9 MB → 0,75 MB / 2k vértices), Wind on Trees, el overdraw de 10-50x de GDGS (el 4,85 ms aparece truncado en la fuente y es de escritorio), y la licencia no comercial del código de Inria. Además, Babylon 7 usa un worker por malla, ordena con un sort por comparación y solo reordena cuando la vista gira más de ~8°. Eso refuerza el punto del sort con cámara de bote.

Investigación adversarial, lado B. Fecha: 2026-10-08. Objetivo: juego BabylonJS 7, WebGL2, celulares como target principal, PWA en GitHub Pages.

## Metodología y honestidad

- Postura: argumento el lado "en contra / limitar" lo más fuerte posible, pero sin inventar datos. Donde la evidencia favorece al 3DGS, lo digo (sección 8).
- **Marca [verificado]**: la afirmación apareció en el resultado de búsqueda web de esta sesión asociado a esa URL (snippet o resumen). **No pude abrir las páginas completas** (WebFetch falló por DNS en el sandbox), así que "verificado" significa "visto en resultados de búsqueda", no "leí el paper entero". Para decisiones de plata, releer la fuente.
- **Marca [no verificado]**: dato de conocimiento general, inferencia mía, o fuente secundaria/foro/marketing sin confirmar.
- Se consultaron más de 25 sitios distintos (listados al final).

---

## 1. Tesis resumida

1. El 3DGS es una representación **horneada, estática, translúcida y ordenada por profundidad**. El Delta necesita lo contrario: **miles de instancias variadas, con viento, sol dinámico, niebla, sombras, colisión y mucho overdraw barato**, en GPU móviles tile-based con ~4-6 GB de RAM compartida con el navegador.
2. Los números reales en celulares son del orden de **cientos de miles a pocos millones de splats por frame**, y eso para UNA escena de captura, no para un bosque de sauces de cientos de árboles.
3. Lo que el 3DGS hace bien (aspecto difuso, irregular) se puede lograr con **cards alpha-to-coverage + impostores octaédricos + LOD con dithering**, que es lo que usa la industria hace 20 años y escala a móvil.
4. Recomendación: **no usar 3DGS para la vegetación del juego**. Limitarlo, como mucho, a (a) assets "hero" aislados y estáticos de la comunidad, convertidos offline a malla/impostor, o (b) un modo foto/vitrina.

---

## 2. Rendimiento en celulares de renderers web de splats

| Dato | Fuente |
|---|---|
| Spark (three.js) se promociona como rápido "even on low-powered mobile devices", pero es afirmación del README, sin benchmark. | https://github.com/sparkjsdev/spark , https://raw.githubusercontent.com/sparkjsdev/spark/main/README.md [verificado como claim de marketing; sin FPS publicado] |
| Spark 2.0: presupuesto de splats activos por frame **500K a 2.5M según dispositivo**; pool GPU fijo de 16M splats; LoD tree precomputado (.RAD). Los "100M+ splats en móvil" son posible vía paging, no render simultáneo. | https://sparkjs.dev/docs/new-features-2.0/ , https://sparkjs.dev/docs/lod-getting-started/ , https://www.worldlabs.ai/blog/spark-2.0 [verificado] |
| PlayCanvas: una PC de escritorio típica maneja ~**4M gaussianas** a FPS altos; por eso inventaron LOD streaming (beta en el engine). | https://blog.playcanvas.com/new-in-supersplat-walk-mode-streamed-lod-and-easy-upload , https://developer.playcanvas.com/user-manual/gaussian-splatting/building/engine-features/lod-streaming [verificado] |
| PlayCanvas con WebGPU: un iPhone 13 Pro Max pasa de 38 FPS (WebGL2) a 78 FPS (WebGPU) con 1M a 4M splats. Es decir, en WebGL2 (nuestro target) **~38 FPS en un iPhone de gama alta** con una escena de entre 1M y 4M splats *[juez: la fuente no dice a qué conteo corresponde; "apenas 1M" era una sobreinterpretación]*. | https://radiancefields.com/supersplat-ships-compute-based-webgpu-rendering-and-automatic-streamed-lod , https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins [verificado; la redacción del resumen es ambigua sobre qué cifra corresponde a qué conteo; releer] |
| Babylon.js: usuarios reportan que a **2.5M splats** el FPS es bajo incluso sin el worker de sort (cuello en thin instances/actualización de matrices); una PR comunitaria llevó truck.splat de 15 a 60 FPS (en desktop; no confirmé que se haya mergeado). | https://forum.babylonjs.com/t/gaussian-splatting-in-babylon-js/45027/28 [verificado vía snippet; estado de la PR no verificado] |
| Babylon Native no soporta el web worker que necesita el sort. Irrelevante para PWA, pero muestra la dependencia. | https://forum.babylonjs.com/t/gaussian-splatting-in-babylon-native/58611 [verificado] |
| Viewer three.js viejo (GaussianSplats3D-style): sort en CPU, artefactos al mover/rotar rápido, "sub-optimal performance on mobile". Nuestro bote se mueve rápido. | https://discourse.threejs.org/t/3d-gaussian-splatting-in-three-js/57858 [verificado] |
| Demo WebGPU del W3C: en móvil usan binning sort más barato con "slight popping" y admiten que "será difícil lograr el rendimiento deseado en móvil sin reducir la cantidad de splats". | https://www.w3.org/2026/splat/ [verificado] |
| WebSplatter (arXiv 2602): probado en iPhone 15 Pro Max, Redmi K70 Pro (SD 8 Gen 3) y Oppo Find X2 (SD 865); sort radix wait-free porque WebGPU no tiene atomics globales; speedups 1.2x a 4.5x sobre viewers web; las tablas de FPS móviles no pude leerlas. Nota: es **WebGPU**, no WebGL2. | https://arxiv.org/pdf/2602.03207 [verificado en parte] |
| Mobile-GS (ICLR 2026): 116 FPS en SD 8 Gen 3, escena Bicycle 1600x1063, **pero** con un método de investigación sin sort (OIT) + cuantización neuronal; no es un renderer web ni lo que trae Babylon. | https://arxiv.org/abs/2603.11531 , https://iclr.cc/virtual/2026/poster/10006810 [verificado] |

Lectura honesta: los mejores resultados móviles usan **WebGPU o investigación a medida**. Nuestro stack es WebGL2 + Babylon 7 (GaussianSplattingMesh con sort en worker + thin instances). No hay un solo benchmark público de un bosque splat denso en WebGL2 móvil a 60 FPS. [no verificado: la ausencia; no encontré ninguno].

---

## 3. Ordenamiento por profundidad (sort)

- Splats son translúcidos: necesitan orden back-to-front **por vista**. Babylon lo hace en un Web Worker y reenvía índices; la vegetación en el Delta con cámara en un bote rápido cambia de vista continuamente. https://app.unpkg.com/@babylonjs/core@9.18.0/files/Meshes/GaussianSplatting/gaussianSplattingSortWorker.js [verificado]
- Con sort asincrónico, el orden que se dibuja es el de hace 1-3 frames: **popping/artefactos al girar rápido** (cámara de bote). https://discourse.threejs.org/t/3d-gaussian-splatting-in-three-js/57858 [verificado]
- El orden por centro (un solo depth por gaussiana) es la causa raíz del popping; el arreglo (StopThePop) hace re-sort por tile, que es ruteo de GPU CUDA, no WebGL2. Cuesta ~4% en CUDA. https://arxiv.org/abs/2402.00525v1 , https://radiancefields.com/papers/stopthepop-sorted-gaussian-splatting-for-view-consistent-real-time-rendering [verificado]
- Alternativas sin sort (weighted sum / OIT) tienen su propio artefacto de "transparencia". https://arxiv.org/html/2508.03180v2 , https://arxiv.org/html/2410.18931v1 [verificado]
- Cada objeto splat suma su propio sort; con muchos árboles, o los fusionás en un único buffer (y perdés instancing/variación) o pagás N sorts. Spark mitiga con un pool compartido. [Inferencia mía + https://sparkjs.dev/docs/new-features-2.0/]
- Los árboles polygonales con alpha-test o A2C **no necesitan ningún sort** (z-buffer).

## 4. Overdraw y fill-rate en GPU móviles (tile-based)

- El blending alfa es la etapa más cara del 3DGS; cada splat se replica en tiles y se mezcla en orden. https://arxiv.org/pdf/2509.25626 [verificado]
- Papers web indican que con ancho de banda limitado en laptops/teléfonos, el buffer de pares tile-splat es el cuello. https://arxiv.org/pdf/2602.03207 [verificado]
- Un autor de un renderer de splats en Godot mide **10x a 50x de overdraw** en nubes de splats; una sola luz costó 4.85 ms con 271k splats a 1280x720. https://radiancefields.com/reconworldlab-adds-relighting-to-godot-gaussian-splats-in-gdgs-3.3.0 [verificado como cita del autor; GPU de escritorio]
- Mobile-GS: "alpha blending es el cuello de botella principal". https://iclr.cc/virtual/2026/poster/10006810 [verificado]
- Para foliage poligonal: alpha test puede romper la optimización de rechazo de superficies ocultas en tilers (PowerVR histórico); alpha-to-coverage evita el sort pero requiere MSAA, que en móvil tiene costo. https://discussions.unity.com/t/is-alpha-test-still-the-evil-for-mobile/684417 , https://en.wikipedia.org/wiki/Alpha_to_coverage [verificado; el foro es anecdótico, el consejo es histórico, hay que medir]
- Honestidad: no encontré ninguna medición publicada de splats en TBDR (Mali/Adreno/Apple) que cuantifique el overdraw/ancho de banda de framebuffer. [no verificado: dato ausente]. El FPS de 38 en iPhone 13 PM con 1M splats es la mejor evidencia indirecta.

Estimación propia [no verificado]: un sauce llorón con ~200k splats ocupando 300x300 px con overdraw 20x = 1.8M fragmentos con blending (lectura+escritura de color). Diez sauces en pantalla ya saturan lo que un tiler móvil hace cómodo (3-5 escrituras de color por píxel a FPS en tiempo real, cifra de foro).

## 5. Memoria y descarga

- PLY sin comprimir: ~232-236 bytes/splat (48 floats SH+color); 1M splats ≈ 230 MB. Escena exterior detallada puede pasar 250 MB. https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/ , https://scaniverse.com/news/spz-gaussian-splat-open-source-file-format [verificado]
- SPZ ≈ 10x menor (ej. 250 MB a ~25 MB); SOG 15-20x menor. https://github.com/nianticlabs/spz , https://blog.playcanvas.com/compressing-gaussian-splats/ [verificado]
- Un archivo de 3M+ splats **no cargaba en Safari de iPhone**; se arregló quitando SH y exportando PLY comprimido (<60 MB). https://forum.playcanvas.com/t/solved-large-3d-gaussian-splatting-file-doesnt-load-on-mobile/38758 [verificado]
- Guías de presupuesto en otras plataformas: Meta Spatial SDK recomienda **<150k splats**; RealityKit topea alrededor de 200k según un dev. https://developers.meta.com/vr/documentation/spatial-sdk/spatial-sdk-splats , https://developer.apple.com/forums/thread/831663 [verificado]
- Comparación: LeafFit convierte una planta de 47k primitivas (~11.9 MB) en una malla con template de ~0.75 MB y ~2k vértices, deformada en vertex shader. Es decir, **15x menos** y con topología. https://arxiv.org/pdf/2602.11577 [verificado]
- Un árbol procedural nuestro: tubos + cards instanciadas = unos KB de geometría y una textura atlas compartida de pocas decenas de KB-MB; la variación sale gratis de la semilla. [Inferencia mía, no verificado numéricamente]
- Para una PWA en GitHub Pages (sin CDN de rango/streaming serio salvo HTTP Range sobre Pages), cada MB cuenta; 20 especies x 3 variantes en splat, aun a 10-20 MB cada una, son 600-1200 MB. [Aritmética mía, no verificado]

## 6. Sin instancing, sin variación procedural, sin edición

- Una captura es un blob único. Para "muchos sauces distintos" hay que capturar muchos, o duplicar el mismo (repetición evidente), o sumar splats por instancia (sort + memoria por copia). Babylon sí usa thin instances por quad de splat, pero eso es instancing interno del renderer, no por objeto. https://forum.babylonjs.com/t/gaussian-splatting-in-babylon-js/45027/28 [verificado]
- LeafFit existe precisamente porque "splats tienen alto costo de memoria y no tienen topología; no encajan en pipelines de juego": hace falta convertirlos a malla para poder editarlos. https://arxiv.org/pdf/2602.11577 [verificado]
- Edición: SuperSplat/PlayCanvas ofrecen recorte y herramientas, pero no hay equivalente a "cambiar la edad, altura o rama del árbol". [no verificado como ausencia total]

## 7. Iluminación, sombras, niebla, viento, colisión

**Iluminación y sombras.** Las capturas llevan la luz horneada. Un splat no tiene normal, albedo ni oclusión. https://developer.playcanvas.com/user-manual/gaussian-splatting/building/relighting/ , https://andrewkchan.dev/posts/lit-splat.html [verificado]. El mejor camino de PlayCanvas es una **malla proxy** con las luces, que modula cada fragmento: o sea, hace falta una malla igual. Sombras dinámicas e iluminación indirecta de alta calidad en tiempo real "siguen sin resolverse" (PRTGS solo baja frecuencia). https://radiancefields.com/papers/prtgs-precomputed-radiance-transfer-of-gaussian-splats-for-real-time-high-quality-relighting [verificado]. Para el Delta, con ciclo día/noche, un sauce horneado a las 15 hs se vería mal a las 19 hs.

**Niebla.** SuperSplat Viewer **no soporta fog** (issue abierto). https://blog.playcanvas.com/new-in-supersplat-walk-mode-streamed-lod-and-easy-upload [verificado]. El Delta tiene niebla de río y fog global. *[juez: en Babylon no hay que implementarla a mano; el shader de splats de 7.54.3 incluye `fogVertex`/`fogFragment` y aplica la niebla de la escena. Sigue siendo cierto que el color horneado no cambia con la hora.]* [inferencia]

**Viento.** Las capturas de árboles en movimiento son un problema de investigación abierto: "Wind on Trees" (arXiv 2609.17810) muestra que asignar splats a huesos es mal planteado en esqueletos densos y no se recupera el amortiguamiento. https://arxiv.org/pdf/2609.17810 [verificado]. Houdini puede deformar splats con simulación, pero es pipeline offline. https://www.sidefx.com/products/whats-new-in-h22/gaussian-splats/ [verificado]. Una gaussiana anisótropa que se deforma por punto no mantiene cobertura de hojas; con el vertex shader de hojas de SpeedTree en cambio es trivial. https://docs.unity3d.com/speedtree-runtime-sdk/manual/wind-overview.html [verificado]

**Colisión.** Splats no tienen superficie definida; todo juego que los usa pone mallas invisibles. [no verificado con fuente; conocimiento general]. En el Delta la colisión que importa (bote vs. juncos/ramas/orillas) ya se resuelve con proxies sencillos.

## 8. LOD, streaming y madurez

- LOD streaming de PlayCanvas: el propio manual del engine lo marca **beta**; el LOD de datos debe alojarse externo. https://developer.playcanvas.com/user-manual/gaussian-splatting/building/streaming-lod-editor [verificado]
- Spark 2.0 (abril 2026) agregó LoD tree y .RAD con HTTP Range; es lo más maduro, pero requiere three.js r180+, no Babylon. https://www.worldlabs.ai/blog/spark-2.0 [verificado]. Babylon tiene hilo de "Streaming and LoD" aún en discusión. https://forum.babylonjs.com/t/gaussian-splatting-streaming-and-lod/63728 [verificado el título; estado no verificado]
- Regresión visible en Babylon 8.13.1 con PLY comprimido + SH: https://forum.babylonjs.com/tag/gaussian-splatting/477 [verificado solo el título del hilo]. El juego está en Babylon **7**; el soporte splat fue evolucionando mucho entre 7 y 9, lo que implica riesgo de actualización. [inferencia]
- Aliasing y popping a distancia: no encontré fuente específica; el LOD por decimado de gaussianas cambia el aspecto con la distancia (parpadeo). [no verificado]

## 9. Licencias de datos capturados

- Polycam: subir datasets implica que el material quede público; origen del código 3DGS (Inria/Graphdeco) tiene licencia **no comercial** en el repo original. https://radiancefields.com/polycam-adds-gaussian-splatting [verificado como nota de prensa; la licencia Inria es conocimiento mío, no verificado en esta sesión]
- Árboles/casas capturados por la comunidad: derechos de la foto, de la propiedad privada (casas de isleños) y de las plataformas de captura. Una malla procedural propia no tiene ese problema. [no verificado; consejo general, consultar abogado]
- Contenido de IA/photogrammetry de la comunidad: validación de calidad, tamaño y licencia por asset; cuesta moderar.

---

## 10. Qué hacen los juegos con vegetación (y por qué sirve para móvil)

| Técnica | Dato | Fuente |
|---|---|---|
| SpeedTree | Viento casi todo en vertex shader; "escala desde móvil hasta cine"; datos de viento horneados en un .stsdk; billboards con trato especial de sombras; fade de LOD por shader. | https://docs.unity3d.com/speedtree-runtime-sdk/manual/wind-overview.html , https://docs.unity3d.com/es/2021.1/Manual/SpeedTree.html [verificado] |
| Impostores octaédricos | Técnica de Ryan Brucks (Epic), plugin en UE5; emula 3D desde cualquier ángulo para árboles lejanos; usada en simuladores a gran escala. | https://www.strayspark.studio/blog/nanite-foliage-ue5-complete-guide [verificado, una sola fuente de blog; atribución no confirmada] |
| Nanite Foliage (UE 5.7) | Geometría cerca, voxels lejos; sigue **experimental**; viento/colisión/física incompletos; Nanite puede ser más lento que LODs clásicos en juegos low-poly. Es desktop/consola, no WebGL2. | https://dev.epicgames.com/documentation/unreal-engine/nanite-foliage , https://www.strayspark.studio/blog/ue5-nanite-foliage-procedural-placement-performance [verificado] |
| Ghost of Tsushima | Pasto generado en GPU, hoja por hoja, curvas Bézier, viento global que alimenta todos los sistemas; millones de hojas. No usa splats. | https://gdcvault.com/play/1027214/Advanced-Graphics-Summit-Procedural-Grass , https://gdcvault.com/play/1027124/Blowing-from-the-West-Simulating [verificado en resúmenes; slides tras paywall] |
| Reimplementación abierta | GodotGrass: instancing con MultiMesh, hojas estiradas en view space y curvadas por altura, todo shader. | https://github.com/2Retr0/GodotGrass [verificado] |
| Pasto PS4 instanciado | Más rápido con pasto que sin él gracias a instancing, LOD con vértices NaN y oclusión del terreno. | https://c0de517e.com/017_vegetation_part2.htm [verificado como resultado de búsqueda; contenido no leído completo] |
| Alpha-to-coverage | Foliage sin sort, "N niveles de sort gratis por píxel"; requiere MSAA. | https://en.wikipedia.org/wiki/Alpha_to_coverage [verificado] |
| Shadow imposters | Reemplazar sombras WPO por un impostor estático. | https://nanolithography.spiedigitallibrary.org/conference-proceedings-of-spie/12784/127842E/Unreal-engine-nanite-foliage-shadow-imposter/10.1117/12.2692451.full [verificado] |

---

## 11. Lo que el lado PRO tiene de razón (para no engañarnos)

- El look difuso/irregular es real y barato de conseguir por captura. Para una vitrina, mirador o escena fija (un muelle emblemático) puede lucir mejor que un modelo.
- Spark 2.0 y SuperSplat muestran que con LOD + presupuesto fijo de 0.5-2.5M splats se puede mover una escena enorme en teléfonos. Pero ese presupuesto es **para toda la pantalla**, y eso es poco para vegetación densa más agua, casas y cielo.
- Hay vías híbridas válidas: capturar en 3DGS y convertir a malla/template (LeafFit), o usar el splat solo como fuente de textura de impostor.

---

## 12. Mejor plan basado en polígonos para vegetación realista del Delta en celulares

**Presupuestos objetivo (propuestos, a validar con la medición del punto 13):** 60 FPS en gama media 2022 (SD 7xx / A14), ≤1.5M vértices/frame, ≤200 draw calls de vegetación, textura de vegetación en un atlas de ≤2048².

1. **Un generador de árboles procedural con semilla** (sauce, casuarina, álamo) con 3 LODs de malla: LOD0 (tubos de rama + cards de hojas, ~3-6k tris), LOD1 (tronco + 8-12 cards grandes de follaje con normales "esféricas"), LOD2 impostor.
2. **Impostores octaédricos** (grilla 8x8 a 12x12, atlas de albedo+normal+profundidad horneado una vez por especie al iniciar o en build). Se usan de 60-80 m en adelante; con billboards de 2 ejes para pasto alto y juncos lejanos.
3. **Cross-fade con dithering** (ordered/blue-noise discard en un patrón por píxel) entre LODs en lugar de blend alfa; sin sort, compatible con el depth buffer. Con A2C si el MSAA 4x es asumible; si no, alpha-test con dither + TAA barato/FXAA.
4. **Viento en vertex shader** estilo SpeedTree: peso por vértice en color (tronco/rama/hoja), un uniforme global de viento (dirección, intensidad, turbulencia por ruido), ondas por fase de hoja. Sin CPU por árbol. El mismo shader de viento para pasto y juncos; los impostores lejanos no se animan (o balanceo mínimo del quad).
5. **Instancing por thin instances por especie/LOD**, chunks en grilla (por ejemplo 64 m) con frustum culling por chunk, y streaming alrededor de la cámara (ya existente), con colocación determinista por hash de celda para que el río rápido no regenere trabajo.
6. **Pasto: hojas en thin instances** con LOD de densidad por distancia (estilo Ghost of Tsushima simplificado: hojas de 3-5 vértices, estiradas en view space), lejos reemplazadas por parches texturizados del terreno.
7. **Iluminación coherente**: normales de follaje suavizadas (geometría redondeada), traslucidez falsa (wrap diffuse + term de retroiluminación con el sol), AO vertex horneado, sombras: solo cascada cercana con cards simplificadas o impostor de sombra; niebla del juego aplicada igual a todo (porque todo es malla).
8. **Contenido comunitario**: aceptar mallas glTF (con límite de tris y MB) y, si traen un splat, **convertirlo offline** (LeafFit-style, o render de 8x8 vistas a un impostor octaédrico) en una herramienta de build, nunca renderizar splats crudos en el cliente.
9. **Aumento de realismo barato**: variación de color por instancia (HSV jitter), escala/rotación aleatoria, mezcla de 3-4 variantes por especie, reflejos de los árboles en el agua con el impostor.
10. **Plan B para splats**: un único `GaussianSplattingMesh` por "escena hero" estática, <150-300k splats, SH grado 0, SPZ/SOG, con fog propio, activado solo en dispositivos de gama alta y desactivable.

## 13. Experimento que cierra el debate

Objetivo: decidir con datos propios, en 3-4 teléfonos reales (gama baja SD 6xx/Mali, media SD 7xx, alta A16/SD 8 Gen 2, un iPhone viejo).

- **Escena de prueba idéntica**: tramo de río con 150 árboles visibles (mezcla 3 especies) + pasto + agua + niebla + sol dinámico, cámara a velocidad de bote (≈ 10-15 m/s) con giros.
- **Rama A (polígonos)**: el plan de la sección 12.
- **Rama B (splats)**: 3 especies capturadas o generadas (misma silueta), convertidas a SOG/SPZ con 50k, 150k y 400k splats por árbol, en `GaussianSplattingMesh` de Babylon 7 y, como control, en Spark (three.js) con LOD.
- **Métricas**: FPS medio y p1, frame time CPU y GPU (Chrome remote debugging, Safari Web Inspector, Perfetto/AGI si se puede), tiempo de sort y lag visible del orden (latencia sort en frames), memoria JS+GPU (límite de pestaña/crash), MB descargados y tiempo hasta primer frame, temperatura/throttling tras 5 minutos, y revisión visual ciega (3-5 personas) con día/atardecer/niebla.
- **Criterio de decisión previo**: splats solo se aceptan si (a) ≥45 FPS p1 en gama media con ≥150 árboles, (b) ≤40 MB totales de vegetación, (c) funcionan con niebla y sol dinámico sin artefactos obvios, (d) viento aceptable. Si falla cualquiera, queda descartado para vegetación masiva.
- Predicción mía [no verificado]: rama B falla (a), (b) y (c); rama A cumple (a) y (b), con trabajo en (c).

---

## Fuentes consultadas (≥25 sitios distintos)

1. https://forum.babylonjs.com/t/gaussian-splatting-in-babylon-js/45027/28
2. https://app.unpkg.com/@babylonjs/core@9.18.0/files/Meshes/GaussianSplatting/gaussianSplattingSortWorker.js
3. https://forum.babylonjs.com/t/gaussian-splatting-in-babylon-native/58611
4. https://forum.babylonjs.com/t/gaussian-splatting-streaming-and-lod/63728
5. https://www.w3.org/2026/splat/
6. https://github.com/sparkjsdev/spark
7. https://sparkjs.dev/docs/new-features-2.0/
8. https://www.worldlabs.ai/blog/spark-2.0
9. https://discourse.threejs.org/t/3d-gaussian-splatting-in-three-js/57858
10. https://blog.playcanvas.com/new-in-supersplat-walk-mode-streamed-lod-and-easy-upload
11. https://developer.playcanvas.com/user-manual/gaussian-splatting/building/relighting/
12. https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/
13. https://radiancefields.com/supersplat-ships-compute-based-webgpu-rendering-and-automatic-streamed-lod
14. https://forum.playcanvas.com/t/solved-large-3d-gaussian-splatting-file-doesnt-load-on-mobile/38758
15. https://arxiv.org/pdf/2602.03207 (WebSplatter)
16. https://arxiv.org/abs/2603.11531 (Mobile-GS)
17. https://arxiv.org/pdf/2509.25626 y https://arxiv.org/abs/2402.00525v1 (StopThePop)
18. https://arxiv.org/html/2508.03180v2 (Duplex-GS) y https://arxiv.org/html/2410.18931v1 (sort-free)
19. https://arxiv.org/pdf/2609.17810 (Wind on Trees)
20. https://arxiv.org/pdf/2602.11577 (LeafFit)
21. https://andrewkchan.dev/posts/lit-splat.html
22. https://radiancefields.com/papers/prtgs-precomputed-radiance-transfer-of-gaussian-splats-for-real-time-high-quality-relighting
23. https://radiancefields.com/reconworldlab-adds-relighting-to-godot-gaussian-splats-in-gdgs-3.3.0
24. https://scaniverse.com/news/spz-gaussian-splat-open-source-file-format
25. https://developers.meta.com/vr/documentation/spatial-sdk/spatial-sdk-splats
26. https://developer.apple.com/forums/thread/831663
27. https://www.sidefx.com/products/whats-new-in-h22/gaussian-splats/
28. https://radiancefields.com/polycam-adds-gaussian-splatting
29. https://docs.unity3d.com/speedtree-runtime-sdk/manual/wind-overview.html
30. https://www.strayspark.studio/blog/nanite-foliage-ue5-complete-guide
31. https://dev.epicgames.com/documentation/unreal-engine/nanite-foliage
32. https://gdcvault.com/play/1027214/Advanced-Graphics-Summit-Procedural-Grass
33. https://github.com/2Retr0/GodotGrass
34. https://discussions.unity.com/t/is-alpha-test-still-the-evil-for-mobile/684417
35. https://en.wikipedia.org/wiki/Alpha_to_coverage
36. https://c0de517e.com/017_vegetation_part2.htm

Limitación: WebFetch no funcionó en este entorno (error de DNS), todo lo marcado [verificado] proviene de resultados de búsqueda. Los números de FPS móviles de WebSplatter y las cifras exactas de PlayCanvas deben releerse en la fuente.
