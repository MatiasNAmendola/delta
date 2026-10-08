# 04 - Olas, estelas y costas en el Delta del Tigre

> Revisión del juez (2026-10-08): revisé cada cifra con búsquedas propias (mismo límite que el autor: no pude abrir los PDF, trabajé con extractos de búsqueda). Las notas del juez van marcadas **[juez]**.
>
> - **Validado:** forma y exponentes de la fórmula de Bhowmik et al. (1991) `Hm = 0,537·V^-0,346·x^-0,345·L^0,56·D^0,355` (aparece igual en una segunda fuente independiente, Frontiers in Marine Science 2023); los valores de la tabla 1.2 (recalculados, coinciden); 246 corridas con 12 botes; 4 a 40 olas por evento (media 10 a 20) y 6 a 40 s de duración; Hmax ~0,6 m; alturas máximas del wakesurf 2 a 3 veces a 100 ft y ~2 veces a 600 ft, potencia 6 a 12 veces, distancias >500 ft / >425 ft (SAFL); máximos de estela a ~10 mph en todas las lanchas (SAFL); períodos T = 2πU/g (transversal) y T = 2πU·cosθ/g (divergente); pendiente máxima π·H/λ; clapotis H(1±Kr), antinodo en la pared y nodos a λ/4; Kr de pared vertical ~0,9; retroceso de márgenes de hasta 1,9 m/año (resumen de la tesis de Quesada); "tablestacado" como término en uso en el Delta.
> - **Corregido:** (1) la energía total del wakesurf a 100 ft es **3 a 9 veces**, no 6 a 9; (2) el rango de validez de Bhowmik es eslora **3,7 a 14,3 m**, calado 0,1 a 0,76 m y V 3,2 a 20,3 m/s, no "hasta ~8 m"; (3) error de conversión en la tabla final: 12 in = **0,30 m**, no 0,12 m; (4) el Kr de **tablestacado de madera** no puede tomarse del de muros perforados/porosos (0,6 a 0,75): un tablestacado es prácticamente impermeable para olas de 1 a 4 s, pasa a 0,8 a 0,95 [estimado]; (5) los períodos de lanchas planeando no pueden salir de 2πU·cosθ/g en la cúspide (daría 6 s a 12 m/s); se recalcularon como estimación de diseño ligada a la eslora; (6) la "lancha colectiva a 6 m/s" está en la joroba (Fr_L ≈ 0,5), no en un régimen de crucero distinto; (7) el exponente de canal angosto era inconsistente entre la sección 3.5 y la tabla; (8) se reescribió la nota sobre "el doble de olas en un registro temporal" (no sostenida tal cual por la fuente); (9) se agregó el régimen de **Froude de profundidad**, que el documento omitía y es crítico en arroyos de 2 a 4 m.
> - **No verificado (se mantiene marcado):** 20 in a 100 ft y 4–5 in / 12 in a 200 ft (cifras de prensa que no encontré); "300 ft para perder la mitad de 26 in" de Goudey (además es inconsistente con el decaimiento "precipitado" que el mismo informe describe); Kr de taludes naturales y márgenes vegetadas (sin medición publicada encontrada, solo Kr ≈ 0,09 en playa de arena en un trabajo estudiantil); varias cifras de Quesada (umbral 0,3 m, +100 % de tránsito, +150 % de ancho del Sarmiento, 80 % de 65 sitios, geobolsas); período medido de lanchas pequeñas.
> - **Confiabilidad general: media.** La estructura física es correcta y las fuentes existen, pero casi todas las cifras salen de extractos de búsqueda y la tabla final es en su mayoría estimación de diseño.

Investigación de física para el juego de lanchas del Delta del Tigre. Complementa el modelo de Kelvin que ya existe (cuña de 19,47°, ondas transversales y divergentes, λ = 2πU²/g·cos²θ, angostamiento ~1/Fr, joroba de planeo).

## Cómo leer este documento

- **[confirmado: fuente]**: el número apareció en un resultado de búsqueda o en un texto que pude leer, con la URL indicada.
- **[estimado]**: cálculo propio, física de manual o criterio de diseño. No tiene fuente directa.
- **[no verificado]**: dato que recuerdo o que vi citado de segunda mano, y que no pude contrastar.

**Limitaciones de esta investigación (importante):**

1. El entorno bloqueó la descarga directa de PDFs (WebFetch y curl fallaron con 403 o ENOTFOUND en todos los dominios probados). Trabajé solo con resultados de búsqueda y sus extractos. No pude leer completos a Maynord (2005), Sorensen, Kriebel y Seelig, Fonseca y Malhotra, PIANC 2003, el informe de SAFL/Minnesota, ni la tesis de Quesada (2019).
2. No encontré las tablas de coeficientes de reflexión del Coastal Engineering Manual (CEM). Los rangos de Kr por tipo de costa son por lo tanto mayormente **[estimado]** o **[no verificado]**, y los marco así.
3. No encontré una fuente que respalde el término técnico argentino para el revestimiento vertical de costa (ver sección 3.1).
4. No hay datos citables de alturas de estela para kayaks ni para jet skis. No los invento.

---

## 1. Altura y período de las estelas por tipo de embarcación

### 1.1 Datos de campo medidos

| Hecho | Valor | Fuente |
|---|---|---|
| Barcos recreativos (12 botes, 246 corridas controladas en los ríos Illinois y Mississippi). Altura promedio de ola | 0,01 a 0,25 m, mediana ~0,06 a 0,12 m | [confirmado: Bhowmik et al., Illinois State Water Survey / USGS UMESC](https://www.umesc.usgs.gov/documents/reports/1992/92s003.txt) y [ideals.illinois.edu](https://www.ideals.illinois.edu/items/77055) (valores vistos vía resumen de búsqueda) |
| Misma serie, altura máxima | hasta ~0,6 m | idem |
| Misma serie, trenes de ola | 4 a 40 olas por evento, media 10 a 20; duración 6 a 40 s o más | idem; **[juez]** confirmado en el resumen de la Parte I ([USGS 92-S013](https://www.umesc.usgs.gov/documents/reports/1992/92s013.txt)), que además da alturas *promedio por evento* de 0,06 a 0,52 m: el rango 0,01 a 0,25 m de la fila de arriba viene del registro de ISWS y las dos cifras no son la misma métrica |
| Wake boat (wakesurf) en Lake Independence, MN, a 100 ft (~30 m) de la trayectoria | altura máxima hasta ~20 pulgadas (~0,5 m) según prensa | [confirmado: cobertura de prensa del estudio SAFL/UMN](https://e3.eurekalert.org/news-releases/942007) (la cifra de 20 in viene de notas periodísticas, no del informe). **[juez] no verificado:** no encontré la cifra en pulgadas en ninguna búsqueda. Además, los botes pasaron a 225, 325, 425 y 625 ft de la costa ([MLSA](https://mymlsa.org/umn-boat-generated-waves-report-now-available/)); "100 ft" es la distancia operativa del informe, no un sensor a 100 ft |
| Wakesurf vs lanchas comunes a 100 ft | altura máxima 2 a 3 veces mayor, energía total **3 a 9 veces** (3 veces a 500 ft), potencia máxima 6 a 12 veces (4 veces a 600 ft) | [confirmado: SAFL Phase 1 FAQ](https://www.wpr.org/wp-content/uploads/2024/08/SAFL_Phase-1-Report_FAQs.pdf); **[juez] corregido** "6 a 9" → "3 a 9" según el resumen citado en [testimonio ante la Legislatura de Oregón](https://apps.oregonlegislature.gov/liz/2022R1/Downloads/PublicTestimonyDocument/37343) |
| Mismo estudio, a 600 ft | wakesurf aún ~2 veces la altura de las no wakesurf | [confirmado: resultado de búsqueda sobre el estudio SAFL](https://cse.umn.edu/safl/news/umn-researchers-study-waves-created-recreational-boats) |
| Distancia para que el wakesurf decaiga al nivel de una lancha común | >500 ft (~150 m) en operación típica; >425 ft (~130 m) en la condición de olas máximas | [confirmado: SAFL Phase 1 FAQ](https://www.wpr.org/wp-content/uploads/2024/08/SAFL_Phase-1-Report_FAQs.pdf) |
| Lancha con esquí a 200 ft (~60 m) | 4 a 5 pulgadas (~0,10 a 0,13 m); wake boat a 200 ft: ~12 pulgadas (~0,30 m) | [confirmado: KARE 11, prensa](https://www.kare11.com/article/news/local/kare11-sunrise/wake-boat-study-university-of-minnesota-st-anthony-falls/89-f3b53537-78a0-49b0-a5c1-9363000b5fbb). **[juez]** no pude reencontrar estas cifras; tratarlas como **[no verificado]** (prensa) |
| Nautique G-23 (Goudey, Florida 2015), a 10 ft de la trayectoria | crucero ~15,4 in (~0,39 m); wakeboard ~22 in (~0,56 m); wakesurf ~27 in (~0,69 m) | [confirmado: Goudey / WSIA, vía resumen](https://gencourt.state.nh.us/statstudcomm/committees/1434/documents/Wake%20Sport%20Wave%20Energy%20Study.pdf) |
| Mismo estudio: wakesurf en agua profunda | hacen falta 300 ft (~90 m) para perder la mitad de la altura original de 26 in | [confirmado: Goudey, ídem]. **[juez] no verificado e inconsistente:** con decaimiento x^-1/3 desde 10 ft, a 300 ft la altura ya sería ~32 % de la original, y el mismo informe habla de caída "precipitada" en los primeros 100 a 150 ft. Probablemente la distancia de referencia no es la de 10 ft. No usar como dato de calibración. Los botes pasaron a 10, 110 y 210 ft de la costa ([presentación Goudey](https://minocquakawaga.org/wp-content/uploads/2023/03/Wave-Energy-Study-C.A.-Goudey-Assoc.-Final-1.pdf)) |
| Mismo estudio: decaimiento | wakeboard/wakesurf caen "precipitadamente" en los primeros 100 a 150 ft; el crucero decae más lento porque las olas chicas no rompen | [confirmado: Goudey, ídem] (el patrocinador es una cámara de la industria, ver nota de sesgo) |
| Ferries convencionales de pasajeros (estudio antiguo) | frecuencias 0,25 a 0,5 Hz (períodos 2,5 a 4 s), alturas máximas 0,1 a 0,5 m (distancia no aclarada) | [confirmado: extracto de búsqueda, ref. a Kirkegaard / Kofoed-Hansen](https://icce-ojs-tamu.tdl.org/icce/article/download/5612/5284/23324) (distancia no especificada, usar con cuidado) |
| Ferries rápidos, Bahía de Tallinn | alturas hasta 0,7 m, períodos ~10 s, a 2,4 km de la línea de navegación en 2,7 m de profundidad | [confirmado: JCU](https://researchonline.jcu.edu.au/18086/) (régimen crítico, no aplica a lanchas del Delta) |
| Intracoastal Waterway (EE.UU.), estelas de botes | pueden superar 40 cm y resuspender sedimento | [confirmado: Sustainability 2018](https://ideas.repec.org/a/gam/jsusta/v10y2018i2p436-d130713.html) |
| Río Swan (Australia), embarcaciones recreativas cortas | las estelas de más energía coinciden con ~8 nudos (~4,1 m/s), por joroba y por agua de 2 a 4 m. Por debajo de 6 nudos ninguna producía más energía que las olas de viento extremas | [confirmado: Gourlay 2010, Curtin](https://cmst.curtin.edu.au/wp-content/uploads/sites/4/2016/08/Gourlay-2010-Full-scale-boat-wake-and-wind-wave-trials-on-the-Swan-River.pdf) |
| Río Willamette | todas las embarcaciones generaron su ola máxima en la condición lenta (~10 mph, ~4,5 m/s) | [confirmado: resultado de búsqueda, AMC/Willamette](https://apps.oregonlegislature.gov/liz/2021R1/Downloads/CommitteeMeetingDocument/233536). **[juez]** lo mismo informa SAFL para sus cuatro botes: estelas mínimas planeando (~20 mph) y máximas a ~10 mph ([SAFL FAQ](https://www.lmac.des.nh.gov/sites/g/files/ehbemt671/files/inline-documents/sonh/minnesota-2022-wake-boat-faqs.pdf)) |
| Lancha colectiva y de porte mediano en el Delta, Primera Sección | oleaje erosivo de altura > 0,3 m | [confirmado: tesis Quesada, UBA 2019](https://bibliotecadigital.exactas.uba.ar/download/tesis/tesis_n6728_Quesada.pdf) (vía resumen de búsqueda). **[juez]** no pude reencontrar el 0,3 m en el resumen: **[no verificado por el juez]** |

**Nota sobre la medición:** cerca del barco el valle es más profundo que la cresta, y "altura" suele ser cresta-valle. En aguas profundas la velocidad de fase es el doble de la de grupo; por eso el tren se alarga y el número de olas que pasan por un punto fijo **aumenta con la distancia** a la trayectoria (dispersión). **[juez]** La versión anterior decía que "un registro temporal puede mostrar el doble de olas que una foto del mismo tren"; esa afirmación no se sostiene tal cual y no la encontré en la [FAQ de Minnesota](https://www.lmac.des.nh.gov/sites/g/files/ehbemt671/files/inline-documents/sonh/minnesota-2022-wake-boat-faqs.pdf). La relación c = 2·c_g es física de manual **[estimado]**.

### 1.2 Fórmula empírica de Bhowmik et al. (vía Sorensen)

Fuente: página docente de la Universidad de Wisconsin que reproduce la regresión atribuida a Bhowmik, Soong, Reichelt y Seddik (1991) y resumida por Sorensen. Se construyó con 12 embarcaciones recreativas.

`Hm = 0,537 · V^(-0,346) · x^(-0,345) · L^0,56 · D^0,355`

- Hm: altura máxima (m); V: velocidad (m/s); x: distancia a la trayectoria o a la costa (m); L: eslora (m); D: calado (m).
- **[confirmado: forma de la ecuación, página UW](https://cosefm.cee.wisc.edu/CEE514_Coastal_Engineering/2003_Students_Web/Scott/Wave%20Height.htm), pero el buscador avisó que los exponentes se leían mal en la página. Verificar contra el informe original EMTC 92-S003 antes de usar.**
- **[juez] Validado:** la misma ecuación, con los mismos coeficiente y exponentes (`Hm = 0,537 V^-0,346 S^-0,345 L^0,56 D^0,355`), aparece en un artículo independiente de *Frontiers in Marine Science* (2023, [doi 10.3389/fmars.2023.1220975](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2023.1220975/xml)), visto por extracto de búsqueda. No existe una forma adimensional "Hm/D = ..." de esta regresión que haya podido encontrar: la ecuación es **dimensional** (no es homogénea, las longitudes suman exponente 0,57) y vale solo en SI (m, m/s).
- **[juez] Rango de los datos:** 12 embarcaciones de **3,7 a 14,3 m** de eslora, calado **0,1 a 0,76 m**, velocidades **3,2 a 20,3 m/s** (extracto de búsqueda sobre la misma fuente). Una reseña habla de 120 corridas; el informe del USGS dice 246.
- No distingue tipo de casco.
- **Consecuencia importante:** la regresión da una altura que *baja* con la velocidad, porque sus datos son de botes que ya planeaban o iban a planeo parcial. No sirve para pasar por la joroba.
- El exponente de la distancia (-0,345) es consistente con el clásico y^(-1/3) de las olas de barcos.

Resultados de la fórmula (cálculo propio, **[estimado]**, solo válido si los exponentes son correctos; calados supuestos por mí):

| Caso | V (m/s) | Hm a 30 m | a 60 m | a 100 m |
|---|---|---|---|---|
| Bote 5 m, calado 0,3 m | 6 | 0,14 m | 0,11 m | 0,10 m |
| Lancha 6 m, calado 0,4 m | 8 | 0,16 m | 0,13 m | 0,11 m |
| Lancha 6 m, calado 0,4 m | 12 | 0,14 m | 0,11 m | 0,09 m |
| Lancha colectiva 15 m, calado 1 m | 4 | 0,47 m | 0,37 m | 0,31 m |
| Lancha colectiva 15 m, calado 1 m | 6 | 0,41 m | 0,32 m | 0,27 m |

La razón entre alturas a 60 y 30 m es 0,79 y a 100 y 30 m es 0,66 (con el exponente −0,345 de la regresión; con −1/3 exacto serían 0,79 y 0,67).

**[juez]** Recalculé la tabla: todos los valores coinciden con la fórmula. El caso de 15 m y 1 m de calado está **fuera del rango** de calado (máx. 0,76 m) y apenas por encima del de eslora; con un calado de 0,76 m la colectiva a 6 m/s da 0,36 / 0,28 / 0,24 m.

### 1.3 Decaimiento con la distancia

- **H ∝ y^(-1/3)** para la ola divergente máxima de un barco. **[confirmado en forma cualitativa]** El exponente -0,345 de Bhowmik concuerda. Un modelo malayo con ensayos en tanque encontró exponentes entre -0,36 y -0,75 en agua profunda según el número de Froude de profundidad (resumen de búsqueda sobre [khub.utp.edu.my](https://khub.utp.edu.my/scholars/20486)), o sea que -1/3 es el piso del decaimiento y las olas rompientes (wake boat) decaen más rápido al inicio.
- Las olas que rompen (wakeboard, wakesurf) pierden altura mucho más rápido en los primeros 100 a 150 ft y después se parecen a las demás **[confirmado: Goudey]**.
- Con poca profundidad (Fr de profundidad cerca de 1) hay menor atenuación por la menor dispersión ([confirmado: resumen del informe Goudey 2020 para New Hampshire](https://gencourt.state.nh.us/statstudcomm/committees/1434/documents/Wake%20Sport%20Wave%20Energy%20Study.pdf)).
- **[juez] Omisión importante para el Delta:** el número de Froude de profundidad Fh = U/√(g·h) importa tanto como el de eslora. Con h = 3 m, √(g·h) ≈ 5,4 m/s: una lancha colectiva o una planeadora en la joroba (4 a 6 m/s) en un arroyo de 2 a 4 m navega con **Fh ≈ 0,7 a 1,1**, es decir en régimen transcrítico. Ahí el ángulo de la cuña se abre por encima de 19,47° hasta ~90° en Fh = 1, desaparecen las transversales para Fh > 1 y la ola principal decae más lento que x^-1/3 (física de manual de Havelock, **[estimado]**; el ensayo de [UTP](https://khub.utp.edu.my/scholars/20486) mide exponentes que dependen de Fh). Las profundidades de 2 a 4 m son las del caso del río Swan (Gourlay 2010); no verifiqué batimetrías de arroyos del Delta.
- Referencia para olas de barcos grandes: Sorensen y Weggel predicen altura máxima en función de velocidad, desplazamiento, profundidad y distancia (**[no verificado]**, no pude leer el modelo).

### 1.4 Período de las olas

- **Derivado de la física, [estimado]:** la ola transversal viaja a la velocidad del barco, por lo tanto T = 2πU/g. Valores: U = 2 m/s, 1,3 s; 3 m/s, 1,9 s; 4 m/s, 2,6 s; 5 m/s, 3,2 s; 6 m/s, 3,8 s; 8 m/s, 5,1 s; 10 m/s, 6,4 s. Las ondas divergentes que se ven en el punto de máxima altura a un lado tienen período menor, T = (2πU/g)·cosθ (el mismo cos θ de λ).
- **[juez] Validado:** la ola transversal tiene c = U, λ = 2πU²/g, y T = λ/c = 2πU/g; la divergente con normal a ángulo θ de la trayectoria tiene c = U·cosθ, λ = 2πU²cos²θ/g y T = 2πU·cosθ/g. En la cúspide (θ ≈ 35,3°, cosθ ≈ 0,82) T ≈ 0,82·2πU/g. Como la frecuencia se conserva al propagarse, ese período es el que llega a la costa (sin corriente). **Límite:** en planeo (Fr de eslora > ~0,5) la cuña se angosta y la ola dominante ya no es la de la cúspide; un ensayo en tanque de un casco planeador encontró que el período de las divergentes **baja** al subir la velocidad ([Aalto, *Wake waves of a planing boat*](https://aaltodoc.aalto.fi/items/e14c17c5-8823-418e-8adc-a3182387cef8)). Entonces 2πU·cosθ/g sobrestima mucho el período a alta velocidad (daría 6,3 s a 12 m/s). Para el juego, en planeo conviene ligar la longitud de onda dominante a la eslora (λ ≈ L a 2L, T = √(2πλ/g)), coherente con el angostamiento ~1/Fr de Rabaud y Moisy que ya usa el juego **[estimado de diseño]**.
- **Medido, [confirmado]:** ferries convencionales, 2,5 a 4 s. Estudios de embarcaciones pequeñas muestran períodos en el rango de 1 a 3 s, pero no pude abrir la fuente (Macfarlane/Cox, [AMC](https://www.amcsearch.com.au/source-assets/images/List-of-AMC-Wave-Wake-Publications-10Oct2025.pdf)) y lo dejo como **[estimado]**.
- Dato útil: el período de las olas más altas varía poco y está ligado a la velocidad de crucero ([confirmado: JCU, ferries](https://researchonline.jcu.edu.au/5558/)).

### 1.5 Altura máxima en la joroba

- **[confirmado: Gourlay 2010]** En embarcaciones cortas la estela de mayor energía aparece cerca de la velocidad de joroba (~8 nudos para esos botes), y no a alta velocidad. Este es el comportamiento que el juego ya modela como "planing hump".
- **[estimado]** Fr de eslora ≈ 0,4 a 0,5 es el valor tradicional de la joroba para cascos de desplazamiento (U = Fr·√(gL): para L = 6 m, 3 a 3,8 m/s; para L = 15 m, 4,9 a 6 m/s). Esto es física clásica de naval, no una cifra que haya confirmado en estas fuentes.
- **[juez]** Consecuencia: una lancha colectiva de ~15 m a 5 a 6 m/s (10 a 12 nudos) navega **en la joroba** (Fr_L ≈ 0,41 a 0,49). Su "crucero" y su "joroba" son prácticamente el mismo régimen, lo que es coherente con que sean las que más erosionan (Quesada).
- La aproximación en dos regímenes aparece en la literatura de lanchas pequeñas: Maynord (2005) *Wave height from planing and semi-planing small boats*, River Research and Applications, y Soehngen (2010) la extienden con modos desplazamiento, semi-planeo y planeo ([confirmado en existencia: IAHR](https://www.iahr.org/library/info?pid=14828), **sin acceso a la ecuación**).
- Alturas típicas de joroba a 30 m: ver el cuadro final. Son **[estimado]**, calibrados con los datos de la tabla 1.1.

### 1.6 Lo que no pude encontrar

- Kayaks y remo: no hay medición publicada de estela que haya hallado. **[estimado]** Para el juego, tratarlos como casi sin estela (< 2 cm), tipo ola de grupo de un casco de desplazamiento a Fr < 0,3.
- Jet ski: no hallé un estudio que mida su estela. **[no verificado]** Los datos que sí vi (Minnesota) son de lanchas comunes y wakesurf.
- PIANC WG 41 (2003) existe como *Guidelines for Managing Wake Wash from High-Speed Vessels* ([Chalmers](https://research.chalmers.se/en/publication/234580)), pero está orientado a embarcaciones rápidas grandes. No pude acceder a sus valores.

---

## 2. Estelas reales: irregularidad

Lo siguiente combina datos confirmados con razonamiento físico **[estimado]**.

**Qué vuelve irregular el patrón:**

1. **Grupos y dispersión.** En agua profunda la velocidad de grupo es la mitad de la de fase, así que cada tren se estira y las olas "nacen" en la popa del grupo y "mueren" en la proa. Eso hace que el patrón de dos brazos de la cuña sea en realidad un tren de olas separado por frecuencia, con las olas más largas adelante (la divergente de mayor período llega primero a un punto fijo lateral). **[confirmado en lo cualitativo: resumen sobre fase/grupo, Minnesota]**
2. **La primera ola es la mayor** en un punto fijo a gran distancia, y luego decrecen: es lo típico en registros de estelas ([estudios de AMC](https://www.amcsearch.com.au/source-assets/images/GJM_NB_JTD-SNAME-AM2012_Final-plus-Discussion-and-Responses_30Oct2012.pdf) discuten que "la ola más alta" por sí sola no describe bien el tren en velocidades transcríticas; **[confirmado en existencia]**). Para un juego: amplitud con envolvente decreciente. **[juez]** Matiz: en registros reales la mayor suele estar entre las primeras 1 a 3 olas, no siempre en la primera; el modelo de envolvente decreciente es una simplificación aceptable **[estimado]**.
3. **Número de olas y duración.** Bhowmik: 4 a 40 olas, media 10 a 20, duración 6 a 40 s **[confirmado]**. En una lancha del Delta a 30 m, usar 6 a 12 olas útiles en ~10 s **[estimado]**.
4. **Viento y corriente.** Las estelas de lanchas de crucero se mezclan con ola de viento; las olas de viento extremas pueden igualar la estela a baja velocidad ([confirmado: Gourlay 2010]). En el Delta hay corriente de marea y sudestada: la corriente a favor estira λ y la contraria la acorta (Doppler), **[estimado]**.
5. **Turbulencia de hélice y casco:** ruido de alta frecuencia y espuma que no sigue la cuña de Kelvin. **[estimado]**
6. **Trayectorias y cambios de rumbo/aceleración:** la estela de una aceleración tiene forma distinta a la de régimen estacionario ([Macfarlane et al., AMC](https://www.amcsearch.com.au/source-assets/images/GJM_KGP_MC-Wave-Wake-during-Acceleration-AUTHOR-VERSION.pdf), **[confirmado en existencia]**).
7. **Reflexiones en costas** (sección 3), que son la mayor fuente de irregularidad en canales angostos.

---

## 3. Interacción con la costa

### 3.1 Nombre técnico del revestimiento vertical

**No lo pude confirmar con fuente directa.** Lo que sí encontré:

- La tesis de Quesada (UBA 2019) menciona, en el contexto de la historia del Delta, que desde 1888 hubo "rellenos de las márgenes, endicamientos y construcción de tablestacados" ([confirmado: resumen en búsqueda](https://bibliotecadigital.exactas.uba.ar/download/tesis/tesis_n6728_Quesada.pdf)). Es decir que **"tablestacado"** aparece en literatura académica argentina sobre el Delta. No pude ver si esa tesis lo usa para las defensas de los isleños actuales.
- La misma tesis habla de **enrocados**, **geobolsas** y **playas artificiales** como alternativas ([confirmado: resumen de búsqueda]).
- Los otros términos que la consigna sugirió ("muro de contención", "defensa de costa", "revestimiento", "bulkhead", "sheet pile wall") no los pude respaldar con una fuente argentina. En inglés, "bulkhead" y "sheet pile wall" son términos de ingeniería costera estándar **[estimado]**.
- **[juez]** Encontré uso local no técnico del término para la costa de las propiedades isleñas: avisos inmobiliarios del Delta de Tigre describen "muelle ... con un **tablestacado de madera dura**" ([Argenprop, listado Delta Tigre](https://www.argenprop.com/inmuebles/venta/delta-tigre), página volátil, vista por extracto). Con esto y la tesis de Quesada, "tablestacado" queda **[confirmado en uso]** para el Delta. "Muro de contención" y "costanera" no aparecieron asociados a las costas isleñas en mis búsquedas (**[no verificado]**); "costanera" es más bien el paseo urbano sobre la margen continental. En la literatura internacional, "sheet pile wall" = tablestacado, y figura como medida de control de erosión junto a muros de hormigón y gaviones.
- **Recomendación:** usar "tablestacado" como término principal dentro del juego (respaldo parcial) y "defensa costera / muro" como sinónimos coloquiales, **[estimado]**. Conviene validarlo con un vecino o con ingeniería del municipio.

### 3.2 Coeficientes de reflexión Kr

No pude abrir el CEM. Los valores de la tabla son por lo tanto rangos de uso habitual **[estimado]**, más lo que sí se confirmó:

| Tipo de costa | Kr usado | Estado | Fuente |
|---|---|---|---|
| Pared vertical lisa e impermeable | 0,9 a 1,0 | **[confirmado]** el valor ~0,9 | [canal de ensayo 2019, muro plano totalmente reflejante 0,9; muros porosos 0,6 a 0,75](https://castjournals.cast.org.cn/joweb/aos/EN/PDF/10.1007/s13131-019-1386-6) |
| Pared vertical perforada o porosa (cajones perforados) | 0,6 a 0,75 | **[confirmado]** para muros porosos | idem |
| **[juez]** Tablestacado de madera (juntas finas, casi impermeable) | 0,8 a 0,95 | **[estimado]**: se comporta como pared vertical; las juntas no tienen porosidad comparable a la de un muro perforado. Allsop (ICCE) informa ~0,9 en muros verticales con agua alta y ~0,65 cuando la ola rompe al pie con agua baja | [Allsop y Hettiarachchi, *Reflections from coastal structures*](https://icce-ojs-tamu.tdl.org/icce/article/download/4265/3946/17947) (extracto) |
| Pared frente a escollera | menor que sola | [confirmado: la reflexión sin escollera es 90 a 100 % mayor](https://ricerca.univaq.it/bitstream/11697/170620/2/jmse-09-00937-v2_red.pdf) | Pratola et al., J. Mar. Sci. Eng. 2021 |
| Escollera (riprap) / enrocado | 0,3 a 0,5 | **[estimado]**, con cota superior **[confirmada]**: en estructuras de enrocado convencionales sin sobrepaso se espera Kr < ~0,6 ([van Rijn, nota sobre estabilidad de estructuras](https://www.leovanrijn-sediment.com/papers/Stabilitystructures2015.pdf), extracto). Davidson et al. (1996, *Coastal Eng.* 28) midieron en campo que tender el talud de 1:0,82 a 1:1,55 bajó el Kr máximo ~15 % ([PDF](https://data-ww3.ifremer.fr/BIB/Davidson_etal_CE1996.pdf), **[juez] confirmado en extracto**) | |
| Talud natural suave de barro | 0,05 a 0,2 | **[estimado]**. **[juez]** Referencia débil: un trabajo estudiantil midió Kr ≈ 0,09 en playa de arena y 0,23 en playa de grava (lago Mendota) ([UW](https://cosefm.cee.wisc.edu/CEE514_Coastal_Engineering/2006_Students_web/Brain_Gab/Further.htm)). Fórmulas: Seelig y Ahrens 1981 ([DTIC ADA101879](https://apps.dtic.mil/sti/pdfs/ADA101879.pdf)) | |
| **[juez]** Barranca de erosión casi vertical (margen socavada, típica de canales con tránsito) | 0,3 a 0,6 | **[estimado]**, sin fuente. Las márgenes erosionadas del Delta suelen quedar escarpadas, así que reflejan más que un talud suave | |
| Margen vegetada (juncos, camalotes, sauces) | 0,05 a 0,15 | **[estimado]**, no hay Kr medido que haya podido ubicar. **[juez]** Tampoco lo encontré; los estudios con *Spartina* o manglar reportan atenuación, y dos ensayos de manglar dan tendencias opuestas del Kr con la densidad | |

Contexto verificado sobre cálculo de Kr:

- Zanuttigh y van der Meer (2008, *Coastal Engineering* 55) proponen una fórmula de Kr en función del parámetro de rompiente con dos coeficientes que dependen de la rugosidad ([confirmado en existencia](https://cris.unibo.it/handle/11585/32164)). No pude confirmar los coeficientes.
- Seelig y Ahrens (1981) mostraron que la fórmula de Miche sobreestima la reflexión en taludes lisos ([confirmado en extracto](https://agris.fao.org/search/en/records/647472e92d5d435c424ee82b)).
- Reflexión mayor cuanto más empinada la costa: [confirmado, resumen de estudios de Quebec](https://lmcd.org/wp-content/uploads/2022/06/Impact-of-wakeboats-waves-results-of-studies-%E2%80%93-Association-du-Lac-Mercier.htm).
- Caso real de reflexión de estelas: el estudio de Tampa Bay (2025) encontró que un muro vertical "fue una fuente significativa de reflexión", con estelas reflejadas visibles solo con marea alta ([confirmado](https://www.mdpi.com/2076-3417/15/9/4807)).

### 3.3 Atenuación por vegetación

- Marisma, Dengie (Inglaterra): la mayor reducción de altura ocurre en los primeros 10 m de vegetación, con 2,1 % y 1,1 % por metro en dos sitios; promedio de toda la marisma 0,1 a 0,5 % por metro ([confirmado: Möller y Spencer 2002](https://journals.flvc.org/jcr/article/view/80281)).
- Marisma del Yangtsé (Spartina): las olas se eliminaron en ~80 m; hacen falta ≥100 m para atenuar del todo las máximas ([confirmado: Yang et al.](https://pure.knaw.nl/ws/files/463806/Yang_ea_5258.pdf)).
- Bahía de Fundy: más del 60 % de la energía se disipa en los primeros 10 m con < 1 m de profundidad ([confirmado: Ngulube](https://www.nsercresnet.ca/uploads/6/3/9/8/6398839/ngulube_wave_dissipation_spartina.pdf)).
- Ensayo de laboratorio: hasta 60 % de la reducción se debe a la vegetación ([confirmado: Möller et al. 2014, Nature Geoscience](https://www.nature.com/articles/ngeo2287)).
- **Advertencia:** la tesis de Quesada indica que los árboles reducen el retroceso, pero por el lavado del oleaje son inviables en canales de alta erosión ([confirmado: resumen](https://bibliotecadigital.exactas.uba.ar/download/tesis/tesis_n6728_Quesada.pdf)). Una vegetación en canal de mucho tráfico se socava.

### 3.4 Clapotis y ondas estacionarias

- Reflexión total: ola incidente + reflejada = onda estacionaria (clapotis) con altura **2H** en los antinodos y 0 en los nodos. Con reflexión parcial (Kr < 1), el máximo es H(1+Kr) y el mínimo H(1−Kr). **[confirmado en el concepto]**: [Wikipedia: Clapotis](https://en.wikipedia.org/wiki/Clapotis) y [AMS Glossary](https://glossarystaging.ametsoc.net/wiki/Clapotis). La fórmula (1±Kr) es teoría lineal estándar **[estimado]**.
- En la pared hay un antinodo (altura 2H en la pared), los nodos están a λ/4 de distancia y se repiten cada λ/2 **[estimado]**. Las fuentes en línea hablan de "media longitud de onda" sin resolver esto, hay que contrastarlo con el CEM.
- En movimiento de partículas: vertical en los antinodos, horizontal en los nodos ([confirmado](https://en.wikipedia.org/wiki/Clapotis)).
- **[juez] Validado (teoría lineal de manual):** H(1±Kr) y el antinodo en la pared (la pared impone velocidad horizontal nula, que corresponde a un antinodo de elevación), nodo a λ/4 y repetición cada λ/2 son correctos para incidencia normal. **Matiz:** las estelas llegan oblicuas (la divergente a ~35° respecto de la trayectoria, o sea ~55° de la normal a una costa paralela). Con incidencia a ángulo α respecto de la normal, el patrón es de crestas cortas ("diamantes"), la separación nodo-antinodo medida perpendicular a la pared es λ/(4·cosα), y el patrón se desplaza a lo largo de la pared. No es una onda estacionaria pura.
- **[juez]** El 2H en la pared es un límite lineal; con olas empinadas el clapotis real puede superarlo algo (efectos no lineales) o romper. Para el juego, 2H como máximo es razonable.

### 3.5 Canal angosto con muros

**[estimado]**, física lineal sin un estudio específico de estelas que lo confirme (la búsqueda no halló comparación controlada, [ver resultados](https://www.mdpi.com/2076-3417/15/9/4807)):

- Con dos paredes de Kr ≈ 0,8, la energía rebota de lado a lado. Después de n rebotes la amplitud es Kr^n: 0,8, 0,64, 0,51, 0,41...
- Como las ondas divergentes viajan oblicuas a la pared, la reflexión genera un nuevo conjunto de ondas que cruza el canal. Se ve un patrón "de red" en lugar de un solo brazo de cuña.
- El decaimiento deja de ser y^(-1/3): en un canal de ancho W, la energía queda confinada entre las paredes y la altura cae sobre todo por las pérdidas en cada rebote (Kr^n) y por disipación, no por dispersión geométrica. Para el juego, el exponente efectivo de distancia queda entre **0 y −0,2** **[estimado de diseño]**, no medido. **[juez]** La versión anterior decía "~0 a 0,5" (signo y valor inconsistentes con la tabla final); se unificó.
- Una embarcación en el canal sentirá la estela propia rebotada después de un tiempo t ≈ W/(c_g·senθ) por cada cruce (θ medido entre la normal de la ola y la trayectoria; con c_g de la componente que cruza), con el efecto de bambolear a baja velocidad. **[estimado]**

---

## 4. Efecto sobre una embarcación pequeña y erosión

### 4.1 Maniobras (kayak y remo)

Fuente: foros de paddling y un club local. **No son guías oficiales**, así que son reglas prácticas, **[estimado]**:

- Acercarse a la estela con la proa a más de 45° de la cara de la primera ola, o de frente; no navegar paralelo a las olas, porque se vuelca el kayak. Mantener proa o popa a menos de 30° de la perpendicular ([foro](https://forums.paddling.com/t/dealing-with-boat-wakes/34291), [club NJ Kayak](https://njkayak.net/?p=495)).
- De frente es lo más fácil para principiantes (cabeceo en lugar de balanceo), pero solo para olas menores a medio pie (~15 cm) o menores que la proa ([foro](https://forums.paddling.com/t/another-wake-question/34471)).
- En agua de menos de ~5 ft (~1,5 m) las olas se empinan al sentir el fondo. Cerca de la costa la estela rebota y empeora ([foro](https://forums.paddling.com/t/paddling-through-a-wake/42481)).
- Regla de los codos: si la ola es más alta que los codos, apoyo bajo (low brace) hacia la ola.
- **Magnitudes de balanceo y cabeceo:** no encontré datos medidos. Para el juego, **[estimado]**: la inclinación pico del agua es ≈ π·H/λ en radianes; una ola de 0,15 m con λ = 5 m da ~5° de pendiente máxima, y una de 0,3 m con λ = 8 m ~7°. Es una derivación geométrica, no una medición de kayaks.

### 4.2 Cruces entre embarcaciones

Sin estudios citables. **[estimado]** como lógica de juego:

- **Adelantamiento:** el que sobrepasa deja su estela en el costado del adelantado, con las ondas divergentes llegando casi de popa a ~20 a 35° (el ángulo de la divergente máxima ronda 35° respecto a la trayectoria). **[juez]** Precisión: en la cúspide, la *dirección de propagación* (normal a la cresta) forma 35,26° con la trayectoria y las *crestas* forman ~54,7°; la *línea* de cúspides está a 19,47° (menos en planeo, por el angostamiento ~1/Fr).
- **Cruce de frente:** la cuña pasa por el lateral a velocidad relativa alta; las olas se sienten con período corto (compresión Doppler).
- **Cruce perpendicular:** se atraviesa el brazo de la cuña, con la ola máxima a ~19,5° del eje.

### 4.3 Erosión de márgenes en el Delta

Todos los puntos son de la tesis doctoral de **Agustín Quesada, UBA 2019**, *Geomorfología ambiental de la Primera Sección del delta del río Paraná*, [PDF](https://bibliotecadigital.exactas.uba.ar/download/tesis/tesis_n6728_Quesada.pdf), datos tomados de un resumen de búsqueda **[confirmado en resumen, sin acceso al texto completo]**:

- Lanchas colectivas y de mediano porte producen oleaje erosivo > 0,3 m de altura.
- El tránsito aumenta ~100 % los fines de semana de verano.
- El río Sarmiento aumentó su ancho ~150 % desde mediados del siglo XX por oleaje náutico.
- De 65 sitios en 19 canales, 80 % mostró retroceso de márgenes; en canales de mucho tránsito el ensanche llegó a 1,9 m/año (1934 a 2019).
- Se proponen geobolsas y boyas para reducir la velocidad de las lanchas.
- Medidas: playas artificiales con recarga cada 4 años; enrocados con alto impacto paisajístico.

**[juez]** Estado de verificación de esta lista: el título, el carácter de tesis **doctoral** (FCEN-UBA, defendida el 23/9/2019, directora Silvia C. Marcomini), el análisis morfodinámico de 50 a 100 años y la cifra de **1,9 m/año** aparecen en extractos del resumen ([Biblioteca Digital FCEN](https://bibliotecadigital.exactas.uba.ar/collection/tesis/document/tesis_n6728_Quesada), [IGEBA](https://igeba.gl.fcen.uba.ar/content/geomorfologia-ambiental-de-la-primera-seccion-del-delta-del-rio-parana-erosion-natural-y)), aunque el extracto no aclara a qué canal corresponde. El umbral de 0,3 m, el +100 % de tránsito, el +150 % de ancho del Sarmiento, el 80 % de 65 sitios y las geobolsas **no los pude reencontrar**: quedan **[no verificado por el juez]** hasta leer el texto. Fuente adicional: Quesada y Marcomini (2025, *Boletín de la Sociedad Geológica Mexicana*) describen que el oleaje náutico de las lanchas a motor provoca un intenso retroceso de las márgenes y cambia el perfil transversal de los canales ([BSGM](http://boletinsgm.igeolcu.unam.mx/bsgm/index.php/volumenes-volumes/cuarta-epoca/375-sitio/articulos/cuarta-epoca/7703/2937)).

Otros antecedentes:

- Un estudio de la Universidad Nacional del Litoral midió el retroceso de la costa del Paraná por el paso de una lancha deportiva paralela a la orilla ([resumen LADHI 2018](https://www.ina.gob.ar/congreso_hidraulica/resumenes/LADHI_2018_RE_207.pdf), **[confirmado en resumen]**). **[juez]** El resumen informa una pérdida media de 26 cm de espesor de costa y 17,23 m³ erosionados en el tramo estudiado (extracto de búsqueda; no es un dato de Quesada).
- Normativa: el REGINAVE prohíbe navegar a velocidad que cause daños a costas o instalaciones ([confirmado: P&I, vía resumen](https://ukpandi.com/news-and-resources/articles/2022/wash-damage-and-speed-regulation-river-plate-and-parana-de-las-palmas-argentina)). La Prefectura Zárate fijó 10 nudos en un tramo del Pasaje Talavera (Disposición 6-2022), pero para buques de carga, no para el Delta de Tigre.
- **No encontré** una campaña oficial de la Municipalidad de Tigre ni de la Prefectura sobre "la ola de las lanchas". Hay una Disposición de la Prefectura Tigre (PZDE RI7 Nº 02/15) sobre zonas de deportes náuticos, que no pude leer ([documento](https://mail.centronaval.org.ar/yccn/instrucciones-regatas/DISPOSICIONES-PREFECTURA-2016.doc)). Queda como tarea de búsqueda.

---

## Parámetros para el juego

Todas las alturas son **cresta-valle (altura de ola) a 30 m, 60 m y 100 m de la trayectoria**. La columna "Estado" indica con qué rigor se respalda cada cifra. Donde no hay medición, el valor es una interpolación **[estimado]** a partir de los datos de las secciones 1.1 y 1.2.

### Altura de estela y período por tipo de embarcación

**[juez]** Tabla revisada. Alturas en régimen de agua profunda (Fh < ~0,7); en arroyos de poca profundidad ver la fila de Fh en "Otros parámetros". Los períodos en desplazamiento/joroba salen de Kelvin (T entre 2πU·cos35°/g y 2πU/g); en planeo, de λ ≈ L a 2L con T = √(2πλ/g). Ambos son **[estimado de diseño]**: no encontré períodos medidos de lanchas chicas.

| Tipo | Régimen | H a 30 m | H a 60 m | H a 100 m | Período T | Estado / fuente |
|---|---|---|---|---|---|---|
| Kayak / bote a remo | todo | < 0,02 m | < 0,015 m | < 0,01 m | 1 a 1,5 s | [estimado] (sin datos medidos) |
| Fuera de borda chico (4 a 5 m, 15 a 30 HP) | crucero (~6 m/s, semiplaneo) | 0,10 a 0,14 m | 0,08 a 0,11 m | 0,07 a 0,10 m | 1,6 a 2,5 s | H: Bhowmik (5 m, D 0,3 m) da 0,14 / 0,11 / 0,10 m [fórmula confirmada]; T [estimado de diseño, λ ≈ L a 2L] |
| Fuera de borda chico | joroba (~3 m/s) | 0,15 a 0,20 m | 0,12 a 0,16 m | 0,10 a 0,14 m | 1,5 a 2 s | [estimado]; Bhowmik extrapolado a 3 m/s (apenas fuera de rango) da 0,18 / 0,14 / 0,12 m; joroba confirmada cualitativamente (Gourlay 2010, SAFL); T de Kelvin |
| Lancha planeadora (6 m, 100 a 150 HP) | crucero (~12 m/s) | 0,12 a 0,16 m | 0,10 a 0,13 m | 0,08 a 0,11 m | 2 a 3 s | H: Bhowmik da 0,14 / 0,11 / 0,09 m; T **[juez] corregido** (antes 3 a 4 s; Kelvin en la cúspide daría 6,3 s, que no aplica en planeo) [estimado de diseño] |
| Lancha planeadora | joroba (~4 m/s, Fr_L ≈ 0,5) | 0,20 a 0,30 m | 0,16 a 0,24 m | 0,13 a 0,20 m | 2 a 2,6 s | Bhowmik a 4 m/s da 0,20 / 0,16 / 0,13 m (cota inferior); pico a baja velocidad confirmado (Gourlay ~8 nudos; SAFL ~10 mph); T de Kelvin |
| Wake boat (wakesurf) | surf (~5 m/s, lastrada) | 0,30 a 0,50 m | 0,22 a 0,33 m | 0,18 a 0,27 m | 2,6 a 3,2 s | **[juez] corregido:** 2 a 3 veces la planeadora a la misma distancia [confirmado: SAFL] da 0,28 a 0,42 m a 30 m; el 0,5 m a 100 ft y el 0,30 m (12 in, antes mal convertido a 0,12 m) a 200 ft son de prensa [no verificado]; decaimiento más rápido cerca (olas rompientes, Goudey). T de Kelvin [estimado] |
| Wake boat | crucero (planeando, ~9 m/s) | 0,15 a 0,25 m | 0,12 a 0,18 m | 0,10 a 0,14 m | 2 a 3 s | [estimado]; SAFL: todos los botes dan estelas mínimas al planear |
| Moto de agua (jet ski) | crucero | 0,08 a 0,12 m | 0,06 a 0,10 m | 0,05 a 0,08 m | 1,5 a 2 s | [estimado] (sin fuente); T **[juez] corregido** (antes 2 a 3 s) por eslora ~3 m |
| Lancha colectiva (~15 m) | crucero 5 a 6 m/s (10 a 12 nudos) = **joroba** (Fr_L ≈ 0,41 a 0,49) | 0,35 a 0,55 m | 0,28 a 0,44 m | 0,24 a 0,37 m | 2,6 a 3,8 s | **[juez] filas unificadas.** Bhowmik (extrapolado; D 0,76 a 1 m) da 0,36 a 0,47 / 0,28 a 0,37 / 0,24 a 0,31 m; el extremo alto agrega el pico de joroba [estimado]; erosivas > 0,3 m [Quesada, no verificado por el juez]; T de Kelvin |

**Advertencia:** Bhowmik se ajustó con lanchas de 3,7 a 14,3 m de eslora, 0,1 a 0,76 m de calado y 3,2 a 20,3 m/s (**[juez] corregido**, antes decía "hasta ~8 m"). Una colectiva de 15 m con 1 m de calado queda levemente fuera de rango: **[estimado]**. La regresión no reproduce la joroba (su altura siempre baja con V).

### Otros parámetros

| Parámetro | Valor | Estado / fuente |
|---|---|---|
| Exponente de decaimiento lateral de la ola máxima (mar abierto) | −1/3 (usar −0,345) | [confirmado: Bhowmik/Sorensen, página UW](https://cosefm.cee.wisc.edu/CEE514_Coastal_Engineering/2003_Students_Web/Scott/Wave%20Height.htm) y **[juez]** misma ecuación en Frontiers in Marine Science 2023 |
| Exponente para olas que rompen (wake boat, primeros 100 a 150 ft) | −0,5 a −0,75 hasta ~45 m y luego −1/3 | [estimado] a partir de [Goudey](https://gencourt.state.nh.us/statstudcomm/committees/1434/documents/Wake%20Sport%20Wave%20Energy%20Study.pdf) y del rango −0,36 a −0,75 de [ensayo malayo](https://khub.utp.edu.my/scholars/20486) |
| **[juez]** Froude de profundidad Fh = U/√(g·h) | Fh < 0,7: Kelvin normal; 0,7 a 1: la cuña se abre hacia 90° y crece la ola; > 1: sin transversales, ángulo de cuña = arcsen(1/Fh); exponente de decaimiento entre −0,2 y −1/3 cerca de Fh = 1 | [estimado], física de manual (Havelock); dependencia del exponente con Fh [confirmada cualitativamente: UTP](https://khub.utp.edu.my/scholars/20486). Con h = 3 m, Fh = 1 a 5,4 m/s |
| Exponente en canal angosto con muros | 0 a −0,2 | [estimado de diseño] |
| Kr pared vertical lisa (hormigón) | 0,9 a 1,0 (usar 0,9); ~0,65 si la ola rompe al pie | [confirmado: 0,9](https://castjournals.cast.org.cn/joweb/aos/EN/PDF/10.1007/s13131-019-1386-6); **[juez]** 0,65 a 0,9 según nivel de agua en [Allsop (ICCE)](https://icce-ojs-tamu.tdl.org/icce/article/download/4265/3946/17947) |
| Kr tablestacado de madera | 0,8 a 0,95 (usar 0,85) | **[juez] corregido** (antes 0,6 a 0,75, tomado de muros perforados): [estimado] |
| Kr muro perforado/poroso | 0,6 a 0,75 (usar 0,7) | [confirmado para muros porosos](https://castjournals.cast.org.cn/joweb/aos/EN/PDF/10.1007/s13131-019-1386-6) |
| Kr enrocado | 0,3 a 0,5 (usar 0,4) | [estimado], cota superior ~0,6 [confirmada: van Rijn](https://www.leovanrijn-sediment.com/papers/Stabilitystructures2015.pdf) |
| Kr barranca de erosión escarpada | 0,3 a 0,6 (usar 0,4) | [estimado de diseño, sin fuente] |
| Kr talud natural de barro suave | 0,05 a 0,2 (usar 0,1) | [estimado]; referencia débil: Kr ≈ 0,09 en playa de arena ([UW](https://cosefm.cee.wisc.edu/CEE514_Coastal_Engineering/2006_Students_web/Brain_Gab/Further.htm)) |
| Kr margen vegetada (juncal) | 0,05 a 0,15 (usar 0,08), más disipación 1 a 2 % por metro en los primeros 10 m | Kr [estimado]; disipación [confirmado: Möller y Spencer 2002](https://journals.flvc.org/jcr/article/view/80281) (medida en marisma costera, no en juncal de río) |
| Altura máxima con reflexión | H(1+Kr), mínimo H(1−Kr); con Kr = 1, 2H | teoría lineal estándar [estimado, física de manual]; concepto [confirmado](https://en.wikipedia.org/wiki/Clapotis) |
| Distancia nodo-antinodo | λ/4 (pared = antinodo, repite cada λ/2); con incidencia oblicua a α de la normal, λ/(4·cosα) | [estimado, física de manual] |
| Período de la ola transversal / divergente en la cúspide | T = 2πU/g / T ≈ 0,82·2πU/g (solo en desplazamiento y joroba; en planeo ver tabla) | [estimado], física de Kelvin que ya usa el juego; **[juez] validado** |
| Número de olas útiles del tren | 4 a 40, típico 10 a 20 | [confirmado: Bhowmik, USGS 92-S013](https://www.umesc.usgs.gov/documents/reports/1992/92s013.txt) |
| Duración del paso del tren | 6 a 40 s | [confirmado: ídem] |
| Altura máxima extrema en lanchas comunes | ~0,6 m | [confirmado: ídem] |
| Umbral de oleaje erosivo | > 0,3 m | [Quesada](https://bibliotecadigital.exactas.uba.ar/download/tesis/tesis_n6728_Quesada.pdf), según el autor; **[juez] no verificado** |
| Retroceso de márgenes en canales de mucho tránsito | hasta ~1,9 m/año | **[juez]** [confirmado en resumen: Quesada](https://bibliotecadigital.exactas.uba.ar/collection/tesis/document/tesis_n6728_Quesada) (canal no especificado en el extracto) |
| Pendiente máxima de agua para un kayak | θ ≈ π·H/λ (rad); 5 a 7° para 0,15 a 0,3 m | [estimado]; **[juez]** cálculo verificado (5,4° y 6,8°) |

### Cómo agregar irregularidad (receta propuesta)

Todo **[estimado]**, basado en las observaciones de la sección 2:

1. **Envolvente del tren:** H_n = H_max · (1 − (n−1)/N)^p con N entre 8 y 20 (número de olas) y p ≈ 1 a 1,5, de modo que la primera ola sea la mayor. Fuente del rango de N: Bhowmik.
2. **Dispersión:** que cada ola del tren tenga período creciente hacia el frente (las largas primero); T_n = T_0 · (1 − 0,08·(n−1)/N) como ajuste inicial, a afinar jugando, con n = 1 la primera ola en llegar. **[juez] corregido:** la versión anterior tenía el signo +, que hacía más largas las olas de atrás, al revés de lo que dice el propio texto (en la rama divergente el período baja a lo largo del tren).
3. **Ruido:** multiplicar cada cresta por un factor aleatorio lognormal con σ ≈ 0,15 (variación visual, sin fuente).
4. **Mezcla con ola de viento:** sumar un campo de olas de viento de 0,03 a 0,10 m, con menor peso cuando hay costa a barlovento. La referencia cualitativa es que las estelas a baja velocidad quedan por debajo de las olas de viento extremas (Gourlay 2010).
5. **Corriente:** modular λ y la ley de velocidad con el efecto Doppler U±Uc.
6. **Reflexión:** sumar una segunda fuente imagen, espejada respecto de cada pared, con amplitud Kr·H y defasaje por la distancia recorrida.
7. **Aceleración y giros:** cuando el barco cambia de velocidad o rumbo, emitir un tren con la λ de la velocidad en el momento de la emisión, sin suponer régimen estacionario ([Macfarlane et al.](https://www.amcsearch.com.au/source-assets/images/GJM_KGP_MC-Wave-Wake-during-Acceleration-AUTHOR-VERSION.pdf)).

---

## Pendientes sugeridos para una segunda pasada

1. Obtener el texto completo de Maynord (2005), PIANC WG 41 (2003), el informe SAFL Fase 1 y la tesis de Quesada, para verificar exponentes, períodos medidos y el vocabulario de las defensas costeras.
2. Tabla de Kr del Coastal Engineering Manual, Parte VI, y Zanuttigh y van der Meer (2008).
3. Entrevistar o buscar normativa de Tigre y Prefectura sobre velocidad máxima en arroyos, y el término usado por los isleños para el muro.
4. Datos de estelas de motos de agua y de kayaks.
