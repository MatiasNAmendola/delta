# 08 · Veredicto del juez: Gaussian Splatting en la vegetación del Delta

**Rol:** juez independiente del debate [08a (a favor)](08a-gaussian-splatting-a-favor.md) vs. [08b (en contra)](08b-gaussian-splatting-en-contra.md). **Fecha:** 2026-10-08. No modifica el [ADR 0005](../adr/0005-gaussian-splatting.md); si este veredicto se adopta, corresponde un ADR nuevo que lo reemplace o lo amplíe.

**Cómo verifiqué.** Además de buscar en la web (WebFetch no anda en este entorno para la mayoría de los dominios), **leí el código de Babylon que el juego usa de verdad**: `node_modules/@babylonjs/core` y `@babylonjs/loaders` **7.54.3** (lo que instala `package.json` con `^7.0.0`). Varias afirmaciones de los dos lados se apoyaban en Babylon 9.x, y eso cambia bastante la discusión.

---

## 1. Resumen en una línea

**No a los splats para la vegetación del mundo. Sí a un experimento acotado con piezas emblemáticas capturadas (hero landmarks). La franja media de árboles en splats queda como experimento opcional, por tiempo limitado y con umbrales de muerte.** El aporte de la comunidad entra como **fuente de captura**: en el cliente se publica una malla o un impostor por defecto, y el splat crudo solo para piezas hero que pasen el experimento.

---

## 2. Qué dijo cada lado

**Lado A (a favor).** Propone una tercera representación de árbol entre el polígono cercano y el impostor lejano: árboles-splat de 3-6 mil gaussianas, SH0, en SPZ/SOG, agrupados en un `GaussianSplattingCompoundMesh` por celda de la grilla, en la franja de 40 a 250 m. Los splats se hornearían desde nuestros propios árboles procedurales, así que no haría falta capturar 22 km. Agrega piezas capturadas (muelles, clubes) y la vía comunitaria con Scaniverse → SuperSplat → SPZ. Sostiene que la condición de revisión del ADR 0005 "ya se cumplió". Admite con honestidad los puntos débiles: el sort en el celular, el blending en GPUs tile-based, que no hay números de gama media, la luz horneada y que no existe ningún juego con follaje en splats.

**Lado B (en contra).** El 3DGS es estático, horneado, translúcido y ordenado por profundidad, y el Delta necesita miles de instancias con viento, sol dinámico, niebla y overdraw barato. Los mejores números móviles salen de WebGPU o de renderers de investigación, no de WebGL2 + Babylon 7. Propone un plan poligonal completo (LODs, impostores octaédricos, dither, viento por vertex shader, thin instances) y deja los splats como "plan B" para escenas hero de menos de 150-300 mil splats, con SH0, solo en gama alta. Para la comunidad: convertir offline a malla o impostor y nunca renderizar splats crudos.

---

## 3. Qué está bien apoyado y qué es débil

### 3.1 Verificaciones propias (las que más pesan)

| Afirmación | Qué encontré | Fuente |
|---|---|---|
| "Babylon soporta SPZ, SOG y malla compuesta" (A) | **En Babylon 7.54.3, el del juego, no.** El loader acepta `.splat`, `.ply` (también el PLY comprimido) y `.spz`. **SOG no existe y `GaussianSplattingCompoundMesh` tampoco.** SOG llegó en la serie 8.30 → 9.0. La malla compuesta con orden global de splats es de 9.x. | Código local: `@babylonjs/loaders/SPLAT/splatFileLoader.metadata.js` y `core/Meshes/GaussianSplatting/`. https://radiancefields.com/babylon.js-v9.0-3dgs-gets-shadows-sogs-and-triangle-splatting-support-announced · https://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0 |
| SPZ en Babylon 7 | **Solo SPZ versión 2** (gzip). `_parseSPZ` rechaza todo archivo con `version != 2`. El SPZ actual de Niantic es la **v4 (ZSTD por flujo, es la opción por defecto)**, con lectura de v1-3. Un `.spz` recién exportado puede **no cargar** en el juego si no se reempaqueta como v2. | Código local `splatFileLoader.js` (línea "ubufu32[1] != 2"); https://github.com/nianticlabs/spz (README: "Version 4 uses ZSTD… versions 1–3 gzip, read-only") |
| Cómo ordena Babylon 7 | **Un Web Worker por cada `GaussianSplattingMesh`**. Ordena con `BigInt64Array.sort()` (un sort por comparación, no radix) y **solo reordena cuando la dirección de la vista gira más de ~8°** (`|dot−1| ≥ 0,01`). La traslación de la cámara (el bote avanzando) no dispara un reorden. Entre mallas splat distintas no hay orden global: Babylon las ordena como objetos transparentes por centro. | Código local `gaussianSplattingMesh.js` (`_postToWorker`, `_CreateWorker`) |
| Niebla con splats (B: "hay que implementarla a mano") | **Falso para Babylon.** El shader de splats de 7.54.3 incluye `fogVertex`/`fogFragment`, así que la niebla EXP2 de la escena se aplica igual. Lo de B vale para el *SuperSplat Viewer*, no para Babylon. Lo que sí falta en 7 es luz, sombras y un mecanismo de plugin de material para inyectar viento. | Código local `Shaders/ShadersInclude/gaussianSplattingFragmentDeclaration.js` |
| Sombras y extensiones de material para splats | Llegaron en **Babylon 9.0** (proyectar sombras con "transparency shadow" y material plugins). En 7 no existen. | https://radiancefields.com/babylon.js-v9.0-3dgs-gets-shadows-sogs-and-triangle-splatting-support-announced |
| Spark 2.0: 500k-2,5M por cuadro (A y B) | **Correcto.** La documentación da por defecto ~1,5M en escritorio y **~500k en móvil**, compartidos entre todos los SplatMesh con LoD. Es three.js, no Babylon. | https://sparkjs.dev/docs/new-spark-renderer/ · https://sparkjs.dev/docs/new-features-2.0/ |
| iPhone 13 Pro Max: 38 fps (WebGL2) → 78 fps (WebGPU) (B) | **Las cifras existen, pero B las leyó mal.** La fuente habla de escenas de **1 a 4 M** de splats sin decir a qué conteo corresponde 38/78. Escribir "38 FPS con apenas 1M" es una sobreinterpretación. Corregido en 08b. | https://radiancefields.com/supersplat-ships-compute-based-webgpu-rendering-and-automatic-streamed-lod · https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins |
| Mobile-GS: "~4,8 MB y 116 FPS en SD 8 Gen 3" (A) | **Son dos cifras de experimentos distintos.** Los 116 FPS (Bicycle, 1600×1063) se midieron en el teléfono. Los 4,8 MB van con la comparación en **RTX 3090 Ti** (1098 FPS). Además el método no ordena (OIT con un corrector neuronal), así que no es lo que trae ningún motor web. Corregido en 08a. | https://arxiv.org/abs/2603.11531 · https://iclr.cc/virtual/2026/poster/10006810 |
| LeafFit: 47k primitivas, 11,9 MB → 0,75 MB y 2k vértices (B) | **Correcto** (figura 1: 936 FPS el splat vs 14.694 FPS la malla plantilla). Apoya la vía "capturar en splat y publicar en malla". | https://arxiv.org/pdf/2602.11577 · https://diglib.eg.org/handle/10.1111/cgf70374 |
| "Wind on Trees" (A lo cita como apoyo) | Existe, pero su conclusión es **más bien negativa** para el viento: la asignación de partes a huesos es degenerada en esqueletos densos y no recupera el amortiguamiento. Le da la razón a B. | https://arxiv.org/pdf/2609.17810 |
| Godot GDGS: overdraw de 10-50x, 4,85 ms por luz con 271k splats (B) | El 10-50x está en la nota. El 4,851 ms aparece truncado y sin una línea de base clara: la misma nota da "+4,7 % de frame time". Es GPU de escritorio. Sirve como dato indirecto, no como número para citar. | https://radiancefields.com/reconworldlab-adds-relighting-to-godot-gaussian-splats-in-gdgs-3.3.0 |
| Benchmarks de splats en gama media Adreno/Mali | **No encontré ninguno** (coincido con los dos lados). Lo único publicado es anecdótico y de gama alta: S22 60-80 fps, S24 60-120 fps, iPhone 15 Pro 30-40 fps, en una escena sin describir. | https://forum.babylonjs.com/t/gaussian-splat-low-performance-on-ios-devices-vs-android/62455 |
| Demo WebGPU del W3C | Confirma un *binning sort* en móvil con "slight popping" y que será difícil rendir en móvil "sin reducir la cantidad de splats". | https://www.w3.org/2026/splat/ |
| Juegos publicados con follaje en splats | **No encontré ninguno.** El caso más cercano (*Snap & Grab*, PC, 2026) usa splats para la imagen general, pero no consta que los use en la vegetación. | https://ingamenews.com/2026/05/gaussian-splatting-in-snap-grab-2026.html |
| Licencias | SPZ: MIT. El código de referencia de Inria: **no comercial**. gsplat/Nerfstudio y Brush: Apache 2.0. Postshot: propietario, y la exportación comercial requiere un plan pago. | https://scaniverse.com/spz · https://radiancefields.com/nerfstudio-releases-gsplat-1-0 · https://github.com/ArthurBrussee/brush · https://radiancefields.com/postshot-launches-v1-0-out-of-beta |

### 3.2 Lado A: bien apoyado / débil

**Bien apoyado:**
- Los formatos comprimidos maduraron: SPZ es 10x más chico que PLY y SOG entre 15 y 20x.
- Spark 2.0 trabaja con un presupuesto fijo de unos 500k en móvil.
- Existe una cadena de captura gratuita: Scaniverse → SuperSplat.
- Su estimación de tamaño es correcta: con SPZ v2 y SH0 son unos 19-20 B por splat antes de comprimir, así que un árbol de 5k ocupa alrededor de 100 KB. Es mucho más defendible que las cifras de B.

**Débil:**
- Su plan técnico (malla compuesta por celda, SOG, un solo sort por cuadro para todos los árboles) **depende de Babylon 9**. El juego está en 7, así que hace falta migrar de versión mayor antes de probarlo.
- La "condición del ADR cumplida" es una lectura parcial. El ADR pedía WebGPU generalizado **y** formatos con soporte en Babylon. Lo segundo existe solo en 9.x, y lo primero no está resuelto para nuestro público.
- Ignora que en el juego la franja media ya está bajo niebla. Con `FOGMODE_EXP2` y densidad 0,0065 (`Environment.ts`), a 100 m queda ~65 % del color y a 170 m ~30 %. La franja de 170 a 250 m que propone es casi pura niebla, y hoy `Forest.ts` corta en 170 m.
- La ventaja de realismo en la franja media es una hipótesis sin medición.
- El viento por shader no se puede inyectar en Babylon 7 sin pisar el shader en `ShaderStore`.

### 3.3 Lado B: bien apoyado / débil

**Bien apoyado:**
- El costo del sort, los artefactos con giros rápidos y la luz horneada son límites reales. El ciclo día/noche es incompatible con color horneado, y en Babylon 7 los splats no reciben luz ni proyectan sombra.
- La falta de benchmarks en gama media es real.
- LeafFit (malla 15x más chica) y el consenso de la industria (SpeedTree, impostores, dither) están bien citados.
- La recomendación de convertir offline lo que aporta la comunidad es sensata.

**Débil:**
- **Los números con los que argumenta están inflados.** Calcula con un "sauce de ~200k splats" y con "10-20 MB por especie". En su experimento pide **50k, 150k y 400k splats por árbol × 150 árboles**, entre 7,5 y 60 M de splats. Ese experimento falla siempre y no prueba la propuesta de A (3-6k por árbol, unos 150-400k en total). Es un hombre de paja.
- Lo de la niebla es incorrecto para Babylon.
- "38 FPS con apenas 1M" sobreinterpreta la fuente.
- En Babylon 9 la malla compuesta conserva una transformada por parte, así que "fusionar = perder instancing" ya no es del todo cierto (en 7 sí).
- Su criterio de ≥45 FPS p1 es más exigente que el propio juego: la resolución adaptativa ya considera bajo rendimiento por debajo de 28 fps (`AdaptiveResolution.ts`).

---

## 4. Decisión para ESTE juego

| Uso | Decisión | Por qué |
|---|---|---|
| **Vegetación de todo el mundo** (bosque, pasto, juncos) | **No.** Se sigue con polígonos + impostores (ADR 0002/0003). | Sol dinámico, viento, sombras, miles de instancias, 22 km procedurales desde OSM. En Babylon 7 los splats no tienen luz, sombra ni viento. Ninguna fuente muestra un bosque de splats en WebGL2 de gama media. |
| **Árboles de media distancia** (30-170 m) | **Todavía no. Spike opcional de hasta 3 días con umbrales de muerte (sección 5, E2).** La prioridad es la fase 2 del ADR 0003 (impostores octaédricos) más el viento por shader, que resuelven lo mismo sin sort. | La niebla ya se come buena parte del detalle. El costo en Babylon 7 es un worker y un sort por malla, y el orden solo se actualiza con la rotación. La ganancia visual no está demostrada. |
| **Piezas emblemáticas** (Estación Fluvial, un muelle o club, el MAT visto desde el río, la pantalla de inicio) | **Sí, como experimento E1.** Hasta 300k splats, SH0, SPZ **v2**, cargadas solo cerca y desactivables. | Es el caso donde los splats ganan claramente (un objeto único, estático y fotorrealista) y el riesgo queda acotado. Coincide con el ADR 0005 y con el plan B de 08b. |
| **Capturas de la comunidad** | **Sí como fuente; en el cliente, malla o impostor por defecto.** El splat crudo solo entra por curaduría como pieza hero que cumpla el presupuesto de E1. | Moderación, tamaño, privacidad y luz horneada. La conversión offline (malla, impostor, LeafFit) se integra con la iluminación y la niebla del juego. |

---

## 5. Plan concreto y experimento

### 5.0 Antes de medir (mitad de un día)
- Fijar el equipo: **3 celulares reales**.
  1. **Android gama media con Adreno**, por ejemplo Motorola Moto G84 o G54 (Snapdragon 695 o 7s Gen 2).
  2. **Android gama media con Mali**, por ejemplo Samsung Galaxy A54 o A35 (Exynos 1380 / Mali-G68 MP5).
  3. **iPhone de 3-5 años**, iPhone 11 o 12 (A13/A14), con Safari.
- Usar la PWA publicada, Chrome/Safari actualizados, brillo al 50 %, modo de 60 fps y resolución adaptativa **trabada** (para medir el costo real, sin que lo esconda la adaptación).
- Usar una ruta de cámara grabada y reproducible: 3 minutos a velocidad de colectiva (≈10-15 m/s), con giros de 90° en ≤1 s.
- Herramientas: el panel `?perf=1` (FPS y p95), Chrome remote debugging (Performance, memoria), Safari Web Inspector (Timelines). Medir el tiempo de sort con `performance.now()` alrededor del `postMessage`/`onmessage` del worker.
- Todo en **Babylon 7.54.3**, que es lo que se publica. El spike en Babylon 9 queda aparte (ver 5.3).

### 5.1 E1: pieza hero capturada (el experimento principal)
**Contenido:** un muelle o fachada del Delta capturado con Scaniverse. Se recorta en SuperSplat, se exporta con SH0 y se reempaqueta a **SPZ v2** (gzip). Dos variantes: 150k y 300k splats. Se carga con `GaussianSplattingMesh` cuando el bote está a menos de 120 m y se descarga al alejarse.

**Pasa si, en los 3 celulares:**
1. FPS p1 ≥ 30 y p95 de frame ≤ 33 ms con la pieza ocupando ~50 % de la pantalla, con la variante de 300k (o la de 150k, y entonces el tope pasa a ser ese).
2. Costo extra respecto de la misma ruta sin la pieza: ≤ 4 ms de p95.
3. Archivo ≤ 8 MB. Hasta que se vea, ≤ 4 s con la red limitada a 10 Mbps. Ninguna tarea larga del hilo principal > 100 ms durante la carga.
4. Memoria extra ≤ 60 MB. Sin cierres de pestaña en iPhone tras 5 ciclos de carga y descarga.
5. Sort: latencia ≤ 3 cuadros. Con el giro de 90°/s, ≤ 1 de 5 observadores nota "parpadeo/orden roto".
6. Integración: al amanecer, mediodía y atardecer, con niebla, ≤ 2 de 5 observadores la marcan como "pegada/de otra luz". Se permite un tinte por hora del día aplicado al color del splat.

**Muere si:** cualquier celular baja de 25 fps p1, si Safari no la renderiza o se cierra, o si falla el punto 6 en dos de las tres horas. En ese caso, las piezas hero se publican como malla o impostor horneados desde la captura.

### 5.2 E2: árboles-splat de media distancia (opcional, ≤3 días, solo si E1 pasa)
**Contenido:** 3 arquetipos (sauce, casuarina, álamo) **horneados desde el generador procedural actual**: unas 100 vistas, entrenados con gsplat o Brush (Apache 2.0), con 4k splats cada uno, SH0. En Babylon 7 no hay malla compuesta, así que los árboles de **cada celda se pre-transforman y se concatenan en un solo buffer `.splat`** (`updateData`), y queda una `GaussianSplattingMesh` (un worker) por celda. Se reemplaza el LOD1 en la franja de 30 a 170 m. Hay que forzar el reorden cada ~6 cuadros con traslación, porque Babylon 7 solo reordena por rotación.

**Variantes en la misma ruta:**
- **A:** control actual.
- **B:** 40 árboles-splat (≈160k).
- **C:** 100 árboles-splat (≈400k).
- **D (si existe):** impostor octaédrico de la fase 2 del ADR 0003.

**Pasa (se adopta B) solo si se cumple todo en los 3 celulares:**
1. B tiene **p95 ≤ control + 2 ms** y p1 ≥ 30 fps. El hilo principal suma ≤ 1 ms por cuadro.
2. Descarga extra de vegetación ≤ 1,5 MB y memoria extra ≤ 30 MB.
3. Después de 10 minutos (con el celular ya tibio), el p50 de FPS de B es ≥ 85 % del inicial y la diferencia con A no crece más de 10 puntos.
4. En la prueba ciega (5 personas, capturas a 50, 100 y 150 m, tres horas del día), B le gana al control en **≥ 65 %** de los pares y a D en **≥ 55 %**.
5. Con giros de 90°/s, ≤ 1 de 5 observadores nota artefactos de orden o de mezcla entre celdas.

**Muere si:** C baja de 25 fps p1 en cualquier celular, si B no supera el punto 4 frente al control, o si en el atardecer más de 2 de 5 notan árboles "con otra luz". Si muere, se cierra la vía de splats para vegetación hasta que cambie algo de la sección 6.

### 5.3 Spike en Babylon 9 (solo información, no bloquea)
Si el proyecto migra a Babylon 9 por otras razones, repetir E2 con `GaussianSplattingCompoundMesh` (un sort global), SOG y material plugin para viento y tinte por hora. Se aplican los mismos umbrales.

### 5.4 Mientras tanto (lo que sí conviene hacer ya)
- Fase 2 del ADR 0003: impostores octaédricos, dither entre LODs y viento en vertex shader para árboles, pasto y juncos. Es la parte fuerte del plan de 08b.
- Dejar previsto el código de carga de piezas hero detrás de una opción (feature flag), para correr E1 sin tocar el resto.

---

## 6. Qué cambiaría el veredicto

- **A favor de más splats:**
  - Un benchmark publicado (o el nuestro) con **≥ 400k splats a ≥ 30 fps p1 en gama media Mali/Adreno sobre WebGL2**.
  - WebGPU disponible en ≥ 90 % de nuestro público real (medido con analítica), con sort por GPU en Babylon.
  - Una relighting barata en Babylon (normales por splat, tinte por luz del sol) que haga creíble el atardecer.
  - Un juego publicado que use follaje en splats en móviles.
- **En contra incluso de las piezas hero:**
  - Que E1 falle en el iPhone o en Mali.
  - Que la moderación de capturas consuma más de lo que aportan.
  - Que el SPZ v2 deje de poder generarse con herramientas libres.
- **Neutral, pero obliga a revisar:** migrar a Babylon 9 (malla compuesta, SOG, sombras, plugins). Cambia el costo de E2, no el de la vegetación de todo el mundo.

---

## 7. Cómo puede aportar la comunidad

El repo es público, y la idea de un "vecino que aporta su muelle" vale como producto. Pero cada aporte tiene que pasar por una puerta clara.

**Apps de captura (en el teléfono).**
- **Scaniverse**: gratis, procesa en el teléfono, exporta PLY/SPZ. Es la recomendada.
- **Polycam**, **KIRI Engine** y **Luma**: procesan en la nube. Leer sus términos, porque algunas publican la captura o limitan la exportación en el plan gratuito.
- Para quien tenga PC: entrenar con **Brush** o **gsplat/Nerfstudio** (Apache 2.0) a partir de fotos o video. **No usar el código de referencia de Inria** para algo que se publique, porque su licencia es no comercial.
- Para recortar y limpiar: **SuperSplat** (en el navegador, open source).

**Formatos que aceptamos.**
1. **Malla glTF/GLB**, la vía preferida: ≤ 20k triángulos y ≤ 2 MB, con texturas de 1024² como máximo y KTX2 si se puede (el repo ya usa `@gltf-transform/cli`).
2. **Splat fuente** en PLY o SPZ (cualquier versión). Se guarda como **fuente** y no se publica tal cual.
3. Para piezas hero aprobadas: **SPZ v2**, SH0, ≤ 300k splats y ≤ 8 MB. Lo reempaqueta el mantenedor, no quien aporta.

**Conversión (la hace el pipeline, no el cliente).**
- De splat a malla: reconstrucción de superficie con métodos de investigación tipo 2DGS, o fotogrametría clásica con las mismas fotos (COLMAP, Meshroom), y después simplificar con gltf-transform. Esta parte no la verifiqué herramienta por herramienta.
- De splat a impostor: renderizar la captura desde una grilla de vistas (como en el ADR 0003) a un atlas.
- Para plantas: **LeafFit** (código público) produce una malla con plantilla por hoja, animable por viento.
- De captura a SPZ v2: la biblioteca `nianticlabs/spz` (MIT), que también lee v1-3 y la v4 actual.

**Licencias y privacidad.**
- Licencia del aporte: **CC BY 4.0** o **CC0** para los assets, y el código bajo la licencia del repo. Quien aporta declara que la captura es suya.
- **Propiedad privada:** solo lo que se ve desde el agua o desde lugares públicos. Las casas de isleños requieren permiso escrito del dueño, o se aportan como volumen genérico.
- **Personas, caras, patentes y matrículas de embarcaciones:** se recortan o se borran en SuperSplat antes de subir. Un splat conserva detalles que la persona que filma no ve.
- Quitar los metadatos de ubicación del archivo fuente si no son necesarios. La ubicación en el juego se declara a mano.
- Las apps de captura tienen sus propios términos. Revisar que permitan redistribuir lo exportado.

**Esquema para `CONTRIBUTING.md`** (a escribir cuando se abra la vía):
1. *Qué aceptamos:* mallas (preferidas), splats como fuente, fotos de referencia de especies del Delta.
2. *Antes de capturar:* permiso del lugar, sin personas, luz pareja (cielo nublado), recorrido completo alrededor.
3. *Cómo exportar:* formatos y límites (los de arriba). Nombre de archivo `lugar-objeto-autor`.
4. *Metadatos obligatorios* (`asset.json`): autor, licencia, fecha, lugar aproximado, app usada, permiso del dueño (sí/no/no aplica).
5. *Cómo enviarlo:* un pull request a `assets/comunidad/` con Git LFS para los archivos grandes, o un issue con un enlace si no usás Git.
6. *Revisión:* un chequeo automático en CI (tamaño, triángulos o splats, licencia, que no falte `asset.json`) y una revisión humana de privacidad y calidad.
7. *Qué pasa después:* el mantenedor lo convierte (malla, impostor o SPZ v2) y te acredita en los créditos del juego.
8. *Retiro:* cualquier dueño de un lugar capturado puede pedir que se baje el asset por issue o mail, y se atiende sin discusión.

---

## 8. Fuentes de las verificaciones del juez

- Código local: `node_modules/@babylonjs/core@7.54.3/Meshes/GaussianSplatting/gaussianSplattingMesh.js`, `Shaders/gaussianSplatting.*.js`, `Shaders/ShadersInclude/gaussianSplattingFragmentDeclaration.js`, `node_modules/@babylonjs/loaders@7.54.3/SPLAT/splatFileLoader*.js`; `src/world/vegetation/Forest.ts`, `src/world/Environment.ts`, `src/utils/AdaptiveResolution.ts`.
- https://github.com/nianticlabs/spz (README leído con curl)
- https://radiancefields.com/babylon.js-v9.0-3dgs-gets-shadows-sogs-and-triangle-splatting-support-announced
- https://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0
- https://forum.babylonjs.com/t/possible-gaussian-splat-sogs-compatibility/60371
- https://app.unpkg.com/@babylonjs/core@9.18.0/files/Meshes/GaussianSplatting/gaussianSplattingCompoundMesh.pure.d.ts
- https://sparkjs.dev/docs/new-spark-renderer/ · https://sparkjs.dev/docs/new-features-2.0/ · https://radiancefields.com/world-labs-releases-spark-v2.0
- https://radiancefields.com/supersplat-ships-compute-based-webgpu-rendering-and-automatic-streamed-lod · https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins
- https://arxiv.org/abs/2603.11531 · https://iclr.cc/virtual/2026/poster/10006810
- https://arxiv.org/pdf/2602.11577 · https://diglib.eg.org/handle/10.1111/cgf70374
- https://arxiv.org/pdf/2609.17810
- https://radiancefields.com/reconworldlab-adds-relighting-to-godot-gaussian-splats-in-gdgs-3.3.0
- https://forum.babylonjs.com/t/gaussian-splat-low-performance-on-ios-devices-vs-android/62455
- https://www.w3.org/2026/splat/
- https://ingamenews.com/2026/05/gaussian-splatting-in-snap-grab-2026.html
- https://scaniverse.com/spz · https://www.nianticspatial.com/capture/scaniverse-community-guidelines
- https://radiancefields.com/nerfstudio-releases-gsplat-1-0 · https://github.com/ArthurBrussee/brush · https://radiancefields.com/postshot-launches-v1-0-out-of-beta
