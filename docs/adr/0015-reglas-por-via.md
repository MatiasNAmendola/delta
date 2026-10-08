# 0015 · Reglas por río y arroyo

**Estado:** Implementada (v1) · **Fecha:** 2026-10-08

## Contexto
En el Delta hay reglas que dependen de la vía y del tipo de embarcación: tramos sin ola, zonas de remo y arroyos donde no corresponde meter una lancha grande. La base es [docs/investigacion/03](../investigacion/03-reglas-de-navegacion.md) y su [JSON](../investigacion/03-restricciones-vias.json), revisados por un juez.

## Decisión
`src/game/waterwayRules.ts` (puro, con tests) define reglas por vía y por familia de embarcación (colectiva, particular, moto, kayak, remo). Cada regla lleva su fuente y su nivel de confianza:

| Regla | Vías | A quién | Confianza | Cómo se juzga |
|---|---|---|---|---|
| **Sin ola** | Luján, Sarmiento, Carapachay, Caraguatá, Dorado, Pajarito, Abra Vieja | Motor | Confirmada: Disp. PZDE RI.7 Nº 02/2015 | Por la **altura de tu propia ola** (física de ADR 0012): más de 25 cm, primero aviso y a los 4 s multa (50). Con eso, la colectiva puede ir hasta ~16 km/h y las lanchas de planeo hasta ~7 km/h. El indicador marca ese límite |
| **Zona de remo** | Tigre, Canal Aliviador, Abra Vieja, Sarmiento, Caraguatá, Rama Negra | Motor | Probable | Ola de más de 18 cm (multa 30) |
| **Gambado: no entran lanchas grandes** | Arroyo Gambado | Colectiva (multa 300), particulares y motos (multa 80) | **Regla del juego**: recuerdo del usuario, sin norma encontrada | Primero aviso, multa a los 5 s si seguís adentro |
| **Arroyo angosto** | Donde se conozca el ancho real | Por familia: colectiva 14 m, particular 5 m, kayak 1,5 m | Diseño | Lista para usar; hoy inactiva porque OSM no tiene anchos reales de los arroyos |

- **Optativo:** "sin ola" y "zonas de remo" rigen con el modo Realista. Las reglas del juego (Gambado) rigen siempre.
- **Contradicción a resolver:** el usuario recuerda que en el Rama Negra no pasan colectivas, pero una guía dice que la Interisleña llega por línea pública. Por eso solo se aplica como zona de remo.

## Pendiente
- Medir el ancho real de los arroyos (imagen satelital) y completar `KNOWN_WIDTH_M`.
- Confirmar el texto de la Disposición 02/2015 y sus reemplazos.
- Sumar las normas que el usuario recuerde, con su confianza.
