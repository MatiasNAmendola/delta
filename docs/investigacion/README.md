# Investigación

Cada documento lo escribió un agente investigador y lo revisó un juez independiente, un modelo distinto. El juez buscó por su cuenta, corrigió en el lugar y dejó un bloque "Revisión del juez" al principio con lo validado, lo corregido y lo pendiente.

**Limitación común:** desde el entorno de desarrollo, un proxy bloquea los sitios oficiales argentinos (Prefectura, SHN, INA, Municipio) y Wikipedia. Casi todo salió de extractos de búsqueda. Las fuentes de datos se probaron después desde GitHub Actions; ver 06.

| Doc | Tema | Confiabilidad según el juez |
|---|---|---|
| [01](01-embarcaciones-de-tigre.md) | Embarcaciones típicas y pintorescas de Tigre; propuesta de 13 modelos | Media: historia, empresas y clubes buenos; medidas sin confirmar |
| [02](02-maniobra-y-controles.md) | Cómo se maneja cada embarcación (timón, palanca de mando, caña, remo, kayak) y física de maniobra | Media: física general alta; datos de Tigre baja |
| [03](03-reglas-de-navegacion.md) + [JSON](03-restricciones-vias.json) | Reglas de navegación, zonas y vías restringidas, líneas de colectivas | Media |
| [04](04-olas-estelas-y-costas.md) | Alturas de estela medidas (Bhowmik y otros), irregularidad, reflexión en tablestacados y barrancas | Media: física y fórmula validadas; tabla del juego en parte estimada |
| [05](05-apis-y-scraping.md) | APIs y sitios públicos: río, mareas, clima, tráfico, normas | Media-alta |
| [06](06-prueba-de-fuentes.md) | Prueba real de las fuentes desde GitHub Actions | Alta: medido |
| [07](07-fuentes-del-mapa.md) + [JSON](07-fuentes-del-mapa.json) | 44 fuentes de mapas, licencias, método de cruce de nombres, geometría y anchos, y erratas detectadas en OSM | Media: inventario sólido, cruce pendiente de ejecutar en GitHub Actions |
| [08a](08a-gaussian-splatting-a-favor.md) / [08b](08b-gaussian-splatting-en-contra.md) / [08](08-veredicto-gaussian-splatting.md) | Debate adversarial sobre Gaussian Splatting para la vegetación: a favor, en contra y veredicto del juez | Veredicto: no para la vegetación del mundo; experimento con una pieza emblemática |
| [10](10-cruce-de-nombres.md) | Cruce real de los 211 nombres del mapa contra GeoNames y Wikidata (workflow en GitHub) | Alta: medido |
| [11](11-ecosistema-en-fotos.md) | Qué forma parte del ecosistema del Delta según fotos de referencia, qué tiene el juego y qué falta, con prioridades | Observación directa |
| [12](12-vivi-tigre-recorridos-y-puntos.md) | Recorridos de las tres líneas de colectivas y 61 puntos de interés, transcriptos del mapa oficial «Viví Tigre» (ago. 2026), con datos en [JSON](12-vivi-tigre-mapa.json) | Municipio de Tigre |
| [09](09-estrategia-de-datos.md) | Estrategia de datos: API, scraping, curaduría o comunidad; marco legal argentino; arquitectura | Media |
| [08](08-veredicto-gaussian-splatting.md) ([08a](08a-gaussian-splatting-a-favor.md) / [08b](08b-gaussian-splatting-en-contra.md)) | Gaussian splatting para vegetación y capturas de la comunidad: debate y veredicto | Media: verificado contra el código de Babylon 7.54.3; sin mediciones en celulares |

**Para cerrar los pendientes** (lo que solo se resuelve con acceso directo o preguntando):
- el texto de la Disposición PZDE RI.7 Nº 02/2015 y sus reemplazos;
- recorridos de las líneas 451 y 452 (Interisleña);
- medidas de las colectivas;
- si el bote de travesía de los clubes es 4+ o 4x+;
- el término local exacto para cada tipo de costa.
