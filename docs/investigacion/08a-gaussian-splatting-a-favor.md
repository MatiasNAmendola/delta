# 08a · Gaussian Splatting a favor (para vegetación y cosas irregulares)

> **Revisión del juez** (2026-10-08; veredicto en [08](08-veredicto-gaussian-splatting.md)).
> - **Babylon 7 vs 9.** El juego usa `@babylonjs/core` **7.54.3**. Revisé el código instalado: carga `.splat`, `.ply` y `.spz`, pero **solo SPZ versión 2** (gzip). No trae **SOG** ni **`GaussianSplattingCompoundMesh`**, que son de la serie 8.30/9.x. Las fuentes del texto (tipos de 9.18.0 y el editor de Babylon) describen Babylon 9. Corregí la tesis 3 y la sección 2.3.
> - **La condición del ADR 0005 no "ya se cumplió".** El ADR pedía WebGPU generalizado **y** formatos con soporte en Babylon. Lo segundo existe en Babylon 9; lo primero no.
> - **Mobile-GS:** los 4,8 MB salen de la comparación en RTX 3090 Ti, no del teléfono. Los 116 FPS en SD 8 Gen 3 son otra medición. Corregido en la tabla 2.2.
> - **Wind on Trees** concluye que el viento en splats sigue mal resuelto: asignar partes a huesos es degenerado y no recupera el amortiguamiento. No apoya la tesis.
> - **Bien apoyado:** el presupuesto de ~500k de Spark en móvil, los tamaños de SPZ/SOG y la estimación de ~100 KB por árbol de 5k splats SH0.
> - **Falta en la propuesta:** la franja de 40-250 m cae casi toda bajo la niebla EXP2 actual. `Forest.ts` corta en 170 m.

**Rol:** investigación adversarial, lado A ("a favor"). Se arma el caso más fuerte para usar 3DGS (o representaciones de splats/puntos) en la vegetación del juego y en activos aportados por la comunidad. El lado B tiene que desmentirlo. **Fecha:** 2026-10-08. Complementa el [ADR 0005](../adr/0005-gaussian-splatting.md), que descartó 3DGS para *todo el mundo* pero lo dejó abierto para piezas puntuales.

**Método y honestidad sobre la evidencia.**
- Las páginas de GitHub se leyeron enteras con WebFetch.
- Varios dominios (arxiv.org, radiancefields.com, foros de Babylon, blogs de PlayCanvas) no resolvieron desde el entorno. Esos datos vienen de resúmenes de un buscador web, que cita las fuentes pero no sustituye la lectura del PDF.
- **[verificado]** = lo leí en la página, o el resumen del buscador lo afirma explícitamente con esa URL.
- **[no verificado]** = inferencia mía, cifra de fuente secundaria o dato que el buscador no pudo confirmar.
- En ningún caso medí nada en un celular. Las cifras de FPS son de terceros.

---

## 1. Tesis (la versión fuerte)

1. La vegetación es el caso donde los polígonos rinden peor por unidad de realismo. Hoy un árbol nuestro son tubos de ramas más tarjetas con alpha-test. Las tarjetas muestran bordes duros, popping de LOD, overdraw de alpha-test (caro en GPUs de celular tipo tile-based) y una silueta repetitiva. Un splat es nativamente difuso, semitransparente y de forma irregular, y se mezcla por alpha sin costuras de tarjeta.
2. Hay evidencia independiente de que el splatting captura el follaje mejor que mallas y nubes de puntos. ArcGIS dice que los splats preservan "power lines, vegetation, reflections" mejor que mallas o nubes de puntos [verificado, https://developers.arcgis.com/unreal-engine/layers/data-layers/gaussian-splat/].
3. El ecosistema web de 2026 ya no es el de 2023. Hay formatos comprimidos (SPZ, SOG), renderers con LOD y presupuesto de splats por dispositivo (Spark 2.0), soporte oficial en Babylon (SPZ, SOG y malla compuesta; *[juez: SOG y malla compuesta solo desde Babylon 8.30/9; el juego usa 7.54.3, que solo lee SPZ v2]*), y capturas on-device gratis en el teléfono (Scaniverse). El ADR 0005 pedía justamente "formatos comprimidos maduros (como SPZ) con soporte en Babylon". Esa condición de revisión **ya se cumplió** *[juez: solo en parte; ver la revisión al inicio]*.
4. La vía comunitaria es un argumento propio. Un vecino de Tigre puede filmar su muelle o su sauce con el teléfono y subir un splat. Con polígonos eso exige un artista 3D.

---

## 2. Evidencia por tema

### 2.1 Base técnica: 3DGS original
- Kerbl et al. (SIGGRAPH 2023) definen "tiempo real" como ≥30 fps a 1080p. Cada primitiva tiene posición, covarianza, opacidad y color con armónicos esféricos. Ganó uno de los 5 premios de mejor paper [verificado, https://arxiv.org/abs/2308.04079 (vía resumen de búsqueda)].
- El ">100 fps" lo cita una fuente secundaria. **No pude confirmarlo en el PDF** [no verificado].

### 2.2 Tamaños y compresión (el problema número uno en celulares)

| Fuente | Dato | Estado |
|---|---|---|
| SPZ (Niantic) | ~10x menor que PLY. Posiciones en 24 bits, escalas en 8 bits log, rotaciones en 10 bits, color y alfa en 8 bits, ZSTD por flujo. SH configurable (5 bits / 4 bits) | [verificado, https://github.com/nianticlabs/spz] |
| Scaniverse sobre SPZ | "~90% menor, ~25 MB vs 250 MB para una escena rica" | [verificado, https://scaniverse.com/spz] |
| SOG (PlayCanvas) | 15-20x menor que PLY. Demo: 1 GB y 4M de gaussianas pasan a 42-55 MB. Son imágenes WebP más meta.json. 2-3x mejor que el PLY comprimido | [verificado, https://blog.playcanvas.com/playcanvas-open-sources-sog-format-for-gaussian-splatting/ y https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/] |
| Dron, 546 fotos, Postshot y SuperSplat | 700 MB a 29 MB "sin pérdida significativa" (un objeto, no un paisaje) | [verificado, https://just-scan-it-3d.uni-wuppertal.de/?p=967] |
| EAGLES / LightGaussian | ~19-54 MB por escena de benchmark (vs 0,5-1,3 GB del 3DGS base) | [verificado, https://arxiv.org/pdf/2312.04564 y https://arxiv.org/html/2407.09510v2 (vía búsqueda)] |
| LPGS (ICLR 2025) | 19,5-20x de reducción de disco, corre "en un móvil en tiempo real" | [verificado, https://arxiv.org/pdf/2406.19434] |
| Mobile-GS (ICLR 2026) | ~4,8 MB (vs 1,2 GB del 3DGS) *[juez: medido en la comparación con RTX 3090 Ti]*; aparte, 116 FPS a 1600x1063 en Snapdragon 8 Gen 3 (escena Bicycle). Método sin sort (OIT + corrector neuronal) | [verificado como cita de la figura 1, https://arxiv.org/abs/2603.11531]. Es hardware tope de gama y renderer propio, no web |
| `.splat` de antimatter15 | Omite SH para ahorrar. Con SH de 3.er orden son "casi 200 bytes por splat" | [verificado, https://github.com/antimatter15/splat] |

**Lectura a favor:** nuestro presupuesto no es una escena de 4 M de splats. Un árbol de 3-10 mil splats sin SH (o SH grado 0) pesaría pocas decenas a pocos cientos de KB en SPZ/SOG. Es una **estimación mía** (no hay fuente directa): ~15-20 bytes por splat sin SH según los bits de SPZ. Para referencia, hoy el mundo entero pesa 1,7 MB (ADR 0005).

### 2.3 Rendimiento en celulares y renderers web

- **Spark 2.0 (World Labs, para three.js)** [verificado, https://worldlabs.ai/blog/spark-2.0 vía búsqueda]:
  - Combina LoD, streaming progresivo y memoria virtual (tabla de páginas en un pool fijo de GPU).
  - El presupuesto de splats por cuadro es de **~500.000 a 2,5 M según dispositivo** (~500k en teléfono).
  - Formato `.RAD` con chunks de 64K.
  - Ejemplo oficial: Coit Tower, >40 M de splats interactivos.
  - La cifra "100M+ en teléfonos" aparece solo en fuentes secundarias [no verificado].
  - Corre en WebGL2, que es lo que usamos (README, https://github.com/sparkjsdev/spark [verificado]). El README dice "rápido en móviles de baja potencia" pero **no da benchmarks** [verificado].
- **Babylon.js** (nuestro motor):
  - Soporta `.splat`, `.spz` y `.sog` [verificado, https://editor.babylonjs.com/documentation/assets/using-gaussian-splatting]. *[juez: es la documentación del Babylon Editor (versión actual). En Babylon 7.54.3, el del juego, el loader acepta `.splat`, `.ply` y `.spz` versión 2; no lee `.sog`.]*
  - Agregó SPZ a comienzos de 2025 [verificado, https://radiancefields.com/babylon-js-adds-spz-support].
  - Existe `GaussianSplattingCompoundMesh`, que junta varias fuentes en **un solo draw call** con transformada propia por parte (`addPart`) [verificado, tipos de @babylonjs/core 9.18.0, https://app.unpkg.com/@babylonjs/core@9.18.0/files/Meshes/GaussianSplatting/gaussianSplattingCompoundMesh.pure.d.ts]. Eso es el equivalente a "instancias" de árboles. *[juez: esta clase no existe en Babylon 7.54.3; requiere migrar a 9.x.]*
  - Un usuario reporta 30-40 fps en iPhone 15 Pro vs 60-80 fps en Samsung S22 en una escena de splats [verificado como reporte anecdótico, https://forum.babylonjs.com/t/gaussian-splat-low-performance-on-ios-devices-vs-android/62455].
  - En contra: escenas grandes van mal y las thin instances serían un cuello de botella con 2,5 M de splats [verificado, https://forum.babylonjs.com/t/gaussian-splatting-in-babylon-js/45027]. También hay un hilo "no renderiza en iOS" [verificado que existe; su causa **no verificada**].
- **mkkellogg/GaussianSplats3D** [verificado, https://github.com/mkkellogg/GaussianSplats3D]:
  - Ordena en CPU con un worker WASM+SIMD.
  - Poda con octree antes de ordenar.
  - En móvil la ordenación por GPU está desactivada por defecto y el rendimiento móvil figura como "sub-óptimo".
  - Límites de splats: ~16 M con SH0, ~11 M con SH1.
  - Hoy el autor recomienda Spark.
- **antimatter15/splat** [verificado, https://github.com/antimatter15/splat]:
  - Dibujo a ~60 fps con ordenación CPU a ~4 fps.
  - Ordenar ~1 M de splats en CPU tarda ~150 ms.
  - Eligió WebGL 1 por compatibilidad.
- **PlayCanvas** [verificado, https://developer.playcanvas.com/user-manual/gaussian-splatting/rendering-architecture/]:
  - Ordenación global unificada, splats procedurales (`GSplatContainer`), SOG en streaming.
  - Ordenación por GPU solo en WebGPU (experimental).
  - La v2.13 rediseñó el work buffer para bajar el costo de GPU [verificado, https://radiancefields.com/playcanvas-engine-2-13-expands-unified-gsplat-performance-and-customization].
  - No hay guía oficial de conteo para móviles [verificado como ausencia].
- **WebSplatter** (arXiv 2602.03207): pipeline WebGPU con radix sort sin atómicos globales y poda por opacidad. Mejora de 1,2x a 4,5x sobre otros visores web, y se probó en iPhone 15 Pro Max [verificado vía búsqueda, https://arxiv.org/abs/2602.03207v1]. Los FPS exactos **no pude leerlos** [no verificado].
- Una demo W3C WebGPU usa una ordenación por *binning* más barata en móviles [verificado vía búsqueda, https://www.w3.org/2026/splat/]. Hay una vía para evitar el sort exacto.
- **Mobile-GS** elimina el sort con transparencia independiente del orden y reporta 116 FPS [verificado, arXiv 2603.11531]. Muestra que el cuello de botella (sort + alpha blending) es atacable por investigación.

### 2.4 Vegetación específicamente
- **Árboles reales:** 3DGS recupera estructura de árboles reales, incluyendo ramas de tercer orden. El error de DAP queda por debajo de 1,59 cm [verificado, https://www.mdpi.com/2072-4292/17/8/1473 vía búsqueda].
- **Oclusión por follaje:** un benchmark ISPRS compara 3DGS contra MVS y NeRF, con un objetivo detrás de vegetación [verificado, https://isprs-annals.copernicus.org/articles/X-G-2025/641/2025/]. Admite que el follaje denso desafía a todos los métodos.
- **GaussianPlant (dic 2025):** recupera apariencia y estructura interna de plantas desde 3DGS [verificado, https://arxiv.org/pdf/2512.14087].
- **LeafFit (Eurographics 2026) [verificado, https://arxiv.org/pdf/2602.11577]:**
  - Segmenta hojas de una captura 3DGS y ajusta una malla-plantilla por hoja.
  - Evalúa la deformación en el vertex shader para minimizar almacenamiento.
  - Reduce "significativamente" el tamaño de datos.
  - Es la ruta híbrida directa: captura con splats, juego con mallas animables por viento.
- **Splanting (SIGGRAPH Asia 2024):** captura de plantas con splats, con aislamiento de fondo [verificado vía búsqueda, https://splant.usask.ca/].
- **Viento:** "Wind on Trees" (2026) muestra que hay trabajo sobre splats dinámicos de árboles [verificado, https://arxiv.org/pdf/2609.17810]. Houdini dice que sus splats admiten simulación para que el viento anime vegetación [verificado, https://www.sidefx.com/products/whats-new-in-h22/gaussian-splats/]. Como los splats son puntos, **se pueden animar con un vertex shader** (desplazar la posición por altura y fase). Spark lo expone: "dynamic per-splat transforms", "displacement", "shader graph" [verificado, https://github.com/sparkjsdev/spark].
- **LOD/anti-aliasing:** el aliasing al alejarse es un problema que Mip-Splatting ataca con un filtro 2D (zoom-out) y uno 3D (zoom-in) [verificado, https://arxiv.org/abs/2311.16493v1]. Hierarchical 3DGS (Kerbl 2024), LODGE (NeurIPS 2025; pensado para dispositivos con poca memoria, cuyos chunks se cargan a demanda) y Octree-GS dan jerarquías LOD [verificado, https://arxiv.org/abs/2505.23158v2].

### 2.5 Generación con IA (activos sin captura)
- **TRELLIS (Microsoft, CVPR'25 Spotlight, MIT):** imagen o texto a 3D con salida en gaussianas, radiance fields o malla. Pide una GPU de ≥16 GB [verificado, https://github.com/microsoft/trellis]. Sirve offline, no en el cliente.
- **LGM:** gaussianas multivista desde texto o imagen en ~5 s [verificado, https://arxiv.org/abs/2402.05054v1].
- **GSGen:** texto a 3D con splats, y su visor WebGL corre a >40 fps en un M1 Pro [verificado, https://arxiv.org/abs/2309.16585v4].
- **World Labs Marble:** exporta mundos como SPZ/PLY, a **2 M de splats** (completo) o **500k** (liviano para tiempo real), con plan pago [verificado, https://docs.worldlabs.ai/marble/export/gaussian-splat.md]. Los 500k coinciden con el presupuesto móvil de Spark.
- **Advertencia propia:** nadie reporta un generador que haga *sauces o casuarinas* de calidad de producción. Hay que probarlo [no verificado].

### 2.6 Captura comunitaria
- **Scaniverse:** gratis, ilimitado, procesa **en el teléfono**, la mayoría de capturas tarda menos de 90 s, exporta PLY/SPZ [verificado, https://scaniverse.com/news/creating-splats-which-app-to-choose].
- **Polycam** (soporta 3DGS desde sept 2023, procesa en la nube, exportación múltiple de pago), **KIRI Engine** (cola de horas, exporta PLY) y **Luma** (nube, ~20-30 min, PLY) [verificado como resumen comparativo, mismo enlace y https://radiancefields.com/luma-ai-alternatives]. Las fuentes son partes interesadas.
- **Edición y limpieza:** SuperSplat (gratis, en el navegador, open source) recorta, edita, optimiza y publica splats [verificado, https://github.com/playcanvas/supersplat]. El componente GaussianCutout de Unity "borra virtualmente" splats en un volumen [verificado, https://github.com/aras-p/UnityGaussianSplatting].
- **Splat desde dron:** Postshot + SuperSplat + PlayCanvas Web Components lo muestran en el navegador (ver 2.2).

### 2.7 Híbrido splat + malla
- Spark integra splats y mallas en la misma escena de three.js, con orden correcto entre múltiples objetos splat [verificado, https://github.com/sparkjsdev/spark].
- Babylon: el splat es un `Mesh` (hereda de AbstractMesh) con compound mesh [verificado, tipos de Babylon y foros].
- Un foro de gamedev sugiere reemplazar mallas fotogramétricas por splats y añadir colisores aparte [verificado como opinión, https://forum.defold.com/t/gaussian-splatting-will-be-at-every-game-engine/76261]. Esto coincide con cómo ya manejamos la física: la colisión es del terreno y de volúmenes simples, no del follaje.
- **No encontré ningún juego publicado con follaje en splats** (la búsqueda específica no devolvió casos) [verificado como ausencia en mi búsqueda, no prueba de inexistencia]. Es el hueco de evidencia más grande.

---

## 3. Argumentos a favor, ordenados por fuerza

1. **Calidad por presupuesto en follaje lejano y medio.** Un cluster de splats sin orden de capas, de 2-5 mil gaussianas, representa una copa irregular mejor que 20-40 tarjetas con alpha-test. Es una hipótesis razonable, no demostrada con medición.
2. **Sin overdraw de alpha-test duro.** Hoy dibujamos tarjetas con discard. Los splats usan blending, que en GPUs tile-based tiene su costo propio (ver 4.1), pero la ordenación se paga una sola vez por cuadro para todos los árboles juntos (compound mesh).
3. **Un solo pipeline de arte para vegetación y objetos únicos.** Con una captura se obtiene un sauce, un muelle roto, una chata. Con polígonos cada uno es una pieza de arte.
4. **Comunidad.** Scaniverse en el teléfono, SuperSplat en el navegador y SPZ de pocos MB forman una cadena completa y gratuita de ponerle "un lugar real" al juego. Es un diferencial de producto (ver docs/producto).
5. **La condición del ADR 0005 se cumplió** (formatos comprimidos con soporte en Babylon). Corresponde revisar la decisión para *piezas* y *vegetación*, que el ADR no cerró.
6. **Animación posible por shader** (viento) y vía híbrida LeafFit (mallas animables obtenidas de splats).
7. **Trayectoria de investigación favorable:** Mobile-GS, LPGS, LODGE, WebSplatter y Spark 2.0 apuntan todos a móviles y web, y salieron entre 2025 y 2026.

---

## 4. Debilidades que conviene admitir (para que el lado B no las descubra solo)

1. **Costo del orden (sort) en el móvil.** Con CPU+worker, sort de ~1 M tarda ~150 ms (antimatter15), así que con 500k sería unos ~75 ms (extrapolación mía, [no verificado]). Con la cámara en barco, rápida, aparecen artefactos de orden desactualizado [verificado, GaussianSplats3D y PlayCanvas].
2. **Blending en GPUs tile-based.** El ADR 0005 ya lo señaló. No encontré un benchmark de overdraw de splats en Mali/Adreno/Apple GPU [no verificado].
3. **Sin números de árboles en teléfonos.** Todas las cifras de FPS móvil son de escenas distintas y de hardware tope de gama (Snapdragon 8 Gen 3, iPhone 15 Pro). Un celular de gama media no está medido en ninguna fuente que leí.
4. **iOS:** hay un reporte de peor rendimiento y otro de que no renderiza [verificado que los hilos existen].
5. **Iluminación y sombras:** el color de un splat está "cocinado" con la luz de la captura. No hay evidencia en lo que leí para cambiar la hora del día. Dato de la sección 2.4: el resumen de un paper reconoce que 3DGS "still lacks mature solutions for lighting, deformation, and editing" [verificado vía búsqueda].
6. **Viento por shader no probado en Babylon** con compound mesh. Spark lo ofrece, Babylon no está documentado en lo que leí [no verificado].
7. **Agua y estela:** los splats no interactúan con el shader de agua, así que hay que resolver reflejos y la línea de flotación con geometría aparte.
8. **Captura de árboles reales es difícil:** el propio ISPRS reconoce que el follaje denso desafía la reconstrucción. Y cada sauce capturado tiene fondo, cielo y luz propios que hay que limpiar.
9. **Licencias y moderación** de lo que suba la comunidad (privacidad de casas, caras, patentes). Excede esta nota.

---

## 5. Propuesta concreta: "árboles-splat con LOD, híbrido con polígonos"

**Principio:** no reemplazar nada. Agregar una *tercera* representación de árbol entre el árbol poligonal cercano y el impostor lejano (ADR 0003).

```
0-40 m     árbol poligonal actual (ramas + tarjetas): colisión, viento, sombra
40-250 m   árbol-splat (3-6k gaussianas, SH0), 1 compound mesh por celda de la grilla espacial (ADR 0002)
250 m +    impostor actual (ADR 0003)
Piezas     splats capturados de muelles/casas/clubes (300-500k máx, solo cerca), cargados bajo demanda
```

**Cómo se obtienen los splats de árbol sin capturar 22 km:**
1. **Hornear desde nuestros propios árboles procedurales.** Renderizar cada arquetipo (sauce, casuarina, álamo) desde ~100 vistas con el generador actual y entrenar un 3DGS (Postshot o Nerfstudio, offline). Esto elimina el problema de captura. Los árboles de *este* juego se parecen a sí mismos, y hay 3-6 arquetipos x variantes (escala, rotación, color) por grilla. Es mi propuesta, **no hay fuente que la haya hecho** [no verificado].
2. **Captura real** de 2-3 sauces y casuarinas del Delta con Scaniverse, como activos "de lujo" y como prueba de la vía comunitaria.
3. **Generación** con TRELLIS/LGM a partir de fotos de referencia, como tercera vía de comparación.

**Pipeline técnico:**
- Formato SPZ o SOG, SH0 (o SH1 si se justifica).
- En Babylon, `GaussianSplattingCompoundMesh` por celda con `addPart` por árbol (una transformada por árbol: posición, rotación, escala).
- Presupuesto duro: ≤150-300k splats visibles (por debajo del ~500k de Spark para teléfonos, que es la referencia más defendible que tengo).
- Viento: desplazamiento por shader proporcional a la altura (hay que verificar si se puede inyectar en el material del splat de Babylon; si no, Spark/three.js es el plan B de motor, pero es un cambio grande).
- Transición con dither/cross-fade en el cambio de LOD.
- Fallback automático: si el FPS cae, el radio de 250 m baja y todo vuelve a impostores.

## 6. Experimento que lo prueba (o lo mata) en un celular de gama media

**Equipo:** un Android de gama media (Snapdragon 7-series o Mali-G57/G68 o similar, 6 GB de RAM) y un iPhone de 2-3 años, ambos con la PWA publicada en GitHub Pages.

**Escena de prueba:** el mismo tramo de río con la misma ruta de cámara grabada (reproducible), tres variantes:
- **A:** árboles actuales (control).
- **B:** 40 árboles-splat (≈150k splats) entre 40 y 250 m, resto igual.
- **C:** 100 árboles-splat (≈400k splats), para ver el punto de quiebre.

**Mediciones:**
1. FPS medio y percentil 1% (cuadro más lento) a la resolución actual del juego, 3 minutos con la cámara en movimiento rápido (giros del barco), y con el teléfono tibio (después de 10 min, por el *throttling* térmico).
2. Tiempo del sort por cuadro (worker) y frecuencia de actualización. Contar artefactos visibles de orden al girar rápido.
3. Memoria: JS heap y textura GPU (Chrome `about:tracing` o Safari Web Inspector), tamaño descargado en SPZ/SOG.
4. Calidad: capturas de pantalla A/B/C a 3 distancias, con 5 personas, ciego, eligiendo cuál se ve más real (no vale decir "se ve bien").
5. Batería: % por 10 minutos.

**Criterio de éxito** (a fijar antes de medir): B mantiene ≥ 30 fps estables sin más de 3 ms extra de CPU por cuadro, y gana la prueba ciega de realismo en ≥ 70% de los casos. **Criterio de muerte:** C cae bajo 20 fps, o el sort produce artefactos visibles en giros normales, o la ventaja visual en ciego es < 55%.

**Experimento 2 (comunidad, barato):** capturar un muelle con Scaniverse, exportar SPZ, recortar con SuperSplat, cargarlo en el juego y medir el tamaño y el tiempo de punta a punta. Es un test de la historia "vecino que aporta".

---

## 7. Fuentes consultadas (≥20 sitios distintos)
GitHub: nianticlabs/spz · sparkjsdev/spark · mkkellogg/GaussianSplats3D · antimatter15/splat · playcanvas/supersplat · microsoft/trellis · aras-p/UnityGaussianSplatting. Docs y blogs: scaniverse.com (spz y comparativa de apps) · worldlabs.ai/blog/spark-2.0 · docs.worldlabs.ai · developer.playcanvas.com · blog.playcanvas.com · editor.babylonjs.com · forum.babylonjs.com · app.unpkg.com (tipos de Babylon) · radiancefields.com · developers.arcgis.com · sidefx.com · w3.org/2026/splat · forum.defold.com · just-scan-it-3d.uni-wuppertal.de. Papers: arxiv.org (3DGS 2308.04079, Mip-Splatting 2311.16493, EAGLES 2312.04564, LPGS 2406.19434, LODGE 2505.23158, Mobile-GS 2603.11531, WebSplatter 2602.03207, GaussianPlant 2512.14087, LeafFit 2602.11577, Wind on Trees 2609.17810, LGM 2402.05054, GSGen 2309.16585) · mdpi.com/2072-4292/17/8/1473 · isprs-annals.copernicus.org · splant.usask.ca.

*Nota:* varias de estas URL se conocieron por buscador y no pude abrirlas directamente. El PDF original es la fuente última para cualquier cifra antes de citarla en un ADR.
