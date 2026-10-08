# 10 · Cruce de nombres de ríos y arroyos (medido)

**Fecha:** 2026-10-08.
**Cómo se midió:** el workflow `Check river names` (`scripts/names/check_names.py`) corre en GitHub Actions cada vez que cambian los mapas. Compara los 211 nombres de nuestros mapas (cuatro zonas, sacados de OpenStreetMap) contra dos fuentes independientes y deja el reporte completo como artefacto del workflow:
- **GeoNames:** volcado de Argentina, rasgos hidrográficos dentro del Delta, 250 nombres, licencia CC BY 4.0.
- **Wikidata:** cursos de agua con coordenadas en la zona, 120 nombres, licencia CC0.

El IGN (WFS) no respondió (504); el workflow lo reintenta en cada corrida.

## Resultado
- **98 de 211 nombres confirmados** (✅ exacto o ≈ con otra grafía) por al menos una de las dos fuentes. Entre ellos, todos los ríos principales: Luján, Tigre, Sarmiento, San Antonio, Capitán, Paraná de las Palmas, Paraná Miní, Paraná Guazú, Reconquista, y también Abra Vieja, Caraguatá, Dorado, Pajarito, Rama Negra, Antequera, Toro, Felicaria y Canal de Vinculación.
- **Sin confirmar no significa mal.** Los arroyos chicos casi no están en estas fuentes. Por ejemplo, Gambado y Fulminante no aparecen en ninguna de las dos.

## Fuentes que pidió el usuario (2026-10-08)
Desde el entorno de desarrollo, el proxy bloquea las cuatro (error 403 de túnel). Por eso se consultan desde el workflow, en los servidores de GitHub.

| Fuente | Qué devolvió | Uso |
|---|---|---|
| [ign.gob.ar](https://www.ign.gob.ar/) y [geoportal.ign.gob.ar](https://geoportal.ign.gob.ar/) | **258 nombres oficiales** de la capa WFS `ign:lineas_de_aguas_continentales_*` (campos `fna` = nombre completo, `gna` = tipo, `nam` = nombre; fuente `sag: IGN`), pidiendo el recuadro en orden lon,lat. Cubre poco la Primera Sección (no tiene Tigre, Abra Vieja ni Urión), pero sí tiene el **Río Carapachay** con su geometría. Grafías propias del IGN: "Felicariu", "Pay Curabí" y "Paycarabh", probablemente erratas. El geoportal usa el GeoServer `wms.ign.gob.ar/geoserver/ows`, que publica capas WFS de hidrografía: `ign:lineas_de_aguas_continentales_perenne`, `_intermitentes`, `BH010` a `BH030` y `BI020`; `ign:areas_de_aguas_continentales_*`; `ign:puntos_de_aguas_continentales_*`. Con el recuadro del Delta devolvieron 0 elementos; se reintenta con el otro orden de ejes | Fuente oficial: queda como referencia principal cuando devuelva datos |
| [viatigre.com.ar/tigre/delta/mapa/](https://viatigre.com.ar/tigre/delta/mapa/) | Lista de 36 ríos y arroyos de la Primera Sección. Incluye **Río Urion**, **Arroyo Gelvez**, **Arroyo Pay Carabi**, **Río Carapachay** (falta en nuestro mapa), Canal Rompani y Canal Honda | Guía turística local; cuenta como una fuente |
| [satellites.pro](https://satellites.pro/plano/mapa_de_Delta_del_Tigre.Argentina) | El mapa se dibuja con JavaScript a partir de teselas; la página no trae nombres en texto | No sirve para cruzar nombres |

**Resultado (última corrida del workflow, 2026-10-08):** 105 de 210 nombres confirmados por al menos una de las cuatro fuentes que responden (GeoNames, Wikidata, IGN y ViaTigre). Corrida anterior: 100 de 210 nombres confirmados por al menos una fuente.

## Corregido en el importador (`scripts/osm/name-fixes.json`)
| En OSM | En el juego | Por qué |
|---|---|---|
| Río URíon | **Río Urión** | **Confirmado por 3 fuentes:** GeoNames "Río Urión" (exacto), ViaTigre "Río Urion" y el aviso. Solo la mayúscula estaba mal. Un aviso lo ubica "sobre río Urión a 300 m del arroyo Borazo" ([argenprop](https://www.argenprop.com/negocios-especiales/partido-de-tigre/dolares-hasta-75000)), y en el mapa el Arroyo Boraso desemboca ahí. Confianza: probable, falta fuente oficial. *Corrección del 2026-10-08: antes había quedado como "Río Unión" por error. La mención del Atlas Ambiental no se verificó, y el "Arroyo Unión" de GeoNames coincidía solo por normalización. Ninguna búsqueda encontró un "Río Unión" en Tigre.* |
| Arroyo Panatanosito | Arroyo Pantanosito | Errata; GeoNames confirma el "Arroyo Pantanoso" vecino |
| Arroyo Paycarabí (OSM) | **Arroyo Pay Carabi** | GeoNames y ViaTigre lo escriben separado. *Antes se había unificado al revés, por error.* |
| Arroyo Gelves | **Arroyo Gelvez** | GeoNames, ViaTigre y avisos |
| Canal Honda | **Canal Hondo** | IGN (oficial) y GeoNames; ViaTigre dice "Honda" |
| Arroyo Caracoles | **Arroyo Caracolas** | IGN (oficial) y GeoNames |
| Arroyo las Casas | Arroyo Las Casas | Mayúscula |
| Ayo Pacu | Arroyo Pacu | "Ayo" es la abreviatura de Arroyo |
| Arroyo Sin Nombre | (se quitó) | Era un marcador, no un nombre |
| Cruce bajos del temor a punta moran | (se quitó) | Es una ruta de cruce, no un río |

## Fuentes consultadas: caso Urión (2026-10-08)
| Búsqueda | Resultado | Fuente |
|---|---|---|
| "Río Urión" Tigre Delta | Una isla en venta "sobre río Urion a 300 metros del arroyo Borazo", a unos 20 min en lancha del puerto de Tigre | [argenprop, partido de Tigre](https://www.argenprop.com/negocios-especiales/partido-de-tigre/dolares-hasta-75000) |
| "Urión" arroyo Delta Tigre | Mismo aviso, listado como "Venta en Urion, Delta del Tigre"; no hay otras menciones | Ídem |
| "Arroyo Unión" / "Río Unión" Tigre | **Ninguna mención** de un curso con ese nombre en Tigre | [Página/12 Turismo](https://www.pagina12.com.ar/diario/suplementos/turismo/9-353-2004-03-07.html?mobile=1), [zonaprop](https://www.zonaprop.com.ar/venta-delta-q-islas.html) y [mercadolibre](https://inmuebles.mercadolibre.com.ar/bsas-gba-norte/tigre/isla-delta) (ninguno lo nombra) |
| OpenStreetMap (volcado HOT, `scripts/osm/delta-tigre.overpass.json`) | `name=Río URíon` | OSM, ODbL |
| GeoNames (workflow `Check river names`) | "Arroyo Unión" coincidía solo por normalización; no se verificó que sea el mismo curso | download.geonames.org, CC BY 4.0 |
| Mapa del juego | El Arroyo Boraso desemboca en este río; coincide con el aviso | `src/world/data/delta-real.world.json` |

**Pendiente:** confirmar "Urión" en una fuente oficial (IGN, Provincia, SHN o Municipio de Tigre) o con un vecino. Si se confirma, corregirlo también en OpenStreetMap.

## Lección
Un nombre no se cambia con una sola coincidencia en un nomenclátor ni con un dato visto solo en un resumen de búsqueda. Hace falta que el nombre encaje con el lugar (por ejemplo, los arroyos vecinos) y al menos dos fuentes, o una oficial.

## Grafías en duda (no se cambian sin una fuente oficial o un vecino)
GeoNames tiene sus propias erratas (por ejemplo "Tarapuati", "Caviotas", "Norancito"), así que una diferencia con GeoNames sola no alcanza para cambiar un nombre.

| En el juego (OSM) | Otra grafía | Fuente |
|---|---|---|
| Arroyo Chileno | Arroyo Chileño | GeoNames |
| Arroyo Correa | Arroyo Correas | GeoNames |
| Arroyo Tutuparé | Arroyo Tuyuparé | GeoNames |
| Arroyo Guazú Nambí | Arroyo Guazunamby | GeoNames |
| Arroyo Manzano de Medina | Arroyo Manzanos de Medina | GeoNames |
| Bajos del Temor | Bajo del Temor | GeoNames |
| Aguaje del Durazno | Arroyo Durazno | GeoNames |
| Aguaje del mojarras | — | Probable "Aguaje de las Mojarras" |
| Arroyo de los Lobos | Arroyo Lobos / Los Lobos | GeoNames |
| Pozos del Barca Grande | Canal Pozos del Barca Grande | GeoNames y Wikidata |

## Faltantes conocidos
- **Río Carapachay:** no está en el extracto de OSM, pero ViaTigre lo lista. Hay que agregarlo desde otra fuente con geometría (IGN o Provincia).
- **Canal Buenos Aires:** Wikidata lo tiene y nuestro mapa también (el usuario lo nombró).

## Próximo
- Insistir con el IGN y sumar la capa "Cursos de agua" de la Provincia (CC BY 4.0) al workflow.
- Lo que resuelvan las fuentes oficiales o los vecinos se agrega a `name-fixes.json`, con su fuente.
