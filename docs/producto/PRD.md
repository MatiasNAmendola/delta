# PRD · Delta

**Versión:** 2026-10-08 · **Estado:** vivo (se actualiza con cada pedido)

## Visión
Un juego que se siente como estar en el Delta de Tigre. No es un juego de carreras. Es una experiencia que engancha a quien recorre Tigre o acaba de hacerlo: una excursión en lancha colectiva, una visita al Puerto de Frutos, una remada en un club. Sirve para revivir y explorar el Delta y llevarse algo más que la visita física.

## Público
- Turistas y visitantes de Tigre, que juegan en el celular durante o después del paseo.
- Isleños, remeros, kayakistas y lancheros: tienen que reconocer su Delta. Si algo está mal, se dan cuenta enseguida.
- Familias y chicos: controles simples por defecto.

## Principios
1. **Real antes que espectacular.** El mapa, las mareas, las estelas, las reglas de navegación y las embarcaciones salen de datos y física documentados (ver [investigación](../investigacion/README.md)).
2. **Optativo, nunca impuesto.** Los controles clásicos se mantienen. El manejo realista, los datos en vivo y las reglas estrictas se eligen.
3. **Funciona en el celular.** Se instala como app (PWA), juega a pantalla completa y anda en equipos de gama media (ver ADR 0001–0004 y 0011).
4. **Respeto por el lugar.** Se respetan las reglas de convivencia del río: navegar por la derecha, cuidar a remeros y kayaks, no hacer ola. Se enseñan jugando, con avisos antes que multas.

## Requisitos funcionales (estado)
| # | Requisito | Estado | Referencia |
|---|---|---|---|
| F1 | Mapa real del Delta por zonas (Primera, Segunda, Tercera Sección, Escobar) | Hecho | OSM, `scripts/osm` |
| F2 | Embarcaciones típicas de Tigre, con familias y variantes | Parcial: 9 tipos; faltan colectiva de fibra, catamarán, almacenera, bote de travesía de fibra | [01-embarcaciones](../investigacion/01-embarcaciones-de-tigre.md), ADR 0010 |
| F3 | Modos de juego por embarcación (pasajeros, travesía, regata, exploración, contrarreloj) | Hecho | ADR 0010 |
| F4 | Controles clásicos simples (palanca que queda, timón progresivo) | Hecho | — |
| F5 | Manejo realista optativo por embarcación | Hecho (primera versión) | [02-maniobra](../investigacion/02-maniobra-y-controles.md), ADR 0013 |
| F6 | Reglas de navegación con avisos y multas | Hecho: derecha, zonas lentas, remeros, ola de costado | [03-reglas](../investigacion/03-reglas-de-navegacion.md) |
| F7 | Vías restringidas por tamaño o reglamento (colectiva en arroyos angostos, zonas de remo) | Pendiente | [03-restricciones-vias.json](../investigacion/03-restricciones-vias.json) |
| F8 | Río vivo: marea, corriente, viento, sudestada | Hecho | ADR 0009 |
| F9 | Estelas con física real (Kelvin, Froude) | Hecho | ADR 0012 |
| F10 | Estela irregular y rebote de olas en tablestacados | Pendiente | [04-olas](../investigacion/04-olas-estelas-y-costas.md) |
| F11 | Altura del río y clima reales del día (INA, Open-Meteo) | Pendiente; fuentes verificadas | [05-apis](../investigacion/05-apis-y-scraping.md), [06-prueba](../investigacion/06-prueba-de-fuentes.md) |
| F12 | Casas, muelles particulares, clubes y puntos de interés | Parcial: casas y muelles hechos, faltan clubes | ADR 0011, 0007 |
| F13 | Basura para juntar | Hecho | — |
| F14 | Vista de dron | Pendiente | ADR 0006 |
| F15 | App instalable a pantalla completa | Hecho | ADR 0014 |

## Requisitos no funcionales
- Carga de menos de 4 s en un celular de gama media. Hoy son ~3,6 s en el entorno de prueba sin GPU.
- 30 cuadros por segundo o más con la resolución nativa de pantalla. En celular nunca baja de la resolución CSS.
- Funciona sin conexión una vez instalado.
- Los datos externos se citan y respetan sus licencias: OSM (ODbL), Open-Meteo (CC BY 4.0, no comercial), INA.
