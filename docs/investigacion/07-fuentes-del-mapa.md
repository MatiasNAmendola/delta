# 07 · Fuentes del mapa: verificación de ríos y arroyos del Delta

**Fecha:** 2026-10-08. **Pedido:** revisar los nombres de ríos y arroyos y la definición de la geometría contra más de 20 fuentes independientes. Hoy el mapa sale solo de OpenStreetMap (volcado HOT / Geofabrik en `scripts/osm/*.overpass.json`).

## Cómo leer este documento y qué no pude hacer

- Marcas: **[verificado]** lo vi en un resultado de búsqueda o en un archivo del repo durante esta sesión. **[según documentación]** surge de documentación o conocimiento general que no abrí. **[no verificado]** no lo pude comprobar.
- **Límite de red.** Probé con `curl` 14 dominios (IGN, IDEBA, IDERA, SHN, Tigre, datos.gba, Wikipedia, Wikidata, Overpass, GeoNames, JRC, ESA y otros): todos dieron `CONNECT 403` del proxy. `WebFetch` falló con `ENOTFOUND` en tres dominios de prueba. Por eso **no pude ejecutar ni una sola consulta WFS/SPARQL/Overpass**; lo que figura como verificado viene de resúmenes de `WebSearch` y del volcado local. Las consultas de ejemplo de la Parte B están sin probar.
- **No pude alcanzar:** `wms.ign.gob.ar`, `ide.ign.gob.ar`, `ign.gob.ar`, `ideba.gba.gob.ar`, `catalogo.datos.gba.gob.ar` (solo vi su ficha en resultados), `hidro.gob.ar`, `idera.gob.ar`, `tigre.gob.ar`, `overpass-api.de`, `query.wikidata.org`, `api.geonames.org`, `es.wikipedia.org`, `global-surface-water.appspot.com`, `esa-worldcover.org`.
- **Búsquedas sin resultado útil:** el "Anexo: Ríos y arroyos del Delta del Paraná" de Wikipedia, las cartas SHN con los códigos H-112/H-211/H-212 (los que sí aparecieron son H-1001 y H-1014..H-1018A), un mapa PDF oficial del Municipio de Tigre, la nomenclatura oficial por decreto, mapas de asociaciones de vecinos, mapas de recorrido de Jilguero e Interisleña, páginas de Mapcarta de estos arroyos, y trabajos de Quesada o Fabricante.

## Hallazgos principales (resumen)

1. **El volcado local de OSM nombra menos de la mitad de las vías.** En `delta-tigre` hay 351 vías `waterway`, solo 150 con `name` (43 %); en Segunda 88 de 132; en Escobar 43 de 191; en Guazú 67 de 86. [verificado, conteo propio sobre `scripts/osm/`]
2. **El volcado no trae `alt_name`, `old_name` ni `wikidata` en ningún curso**; solo 3 etiquetas `name:en`, una `name:es` y un `source=maxar`. Puede ser que el export HOT recorte etiquetas: conviene reconsultar con Overpass antes de concluir que no existen. [verificado en el volcado; causa **no verificada**]
3. **Faltan o están mal nombrados varios cursos de la Primera Sección:** no hay ninguna vía llamada Carapachay, y "Espera" solo aparece como polígono (`Arroyo Espera Grande`). Hay erratas evidentes (`Río URíon`, `Arroyo Panatanosito`, `Aguaje del mojarras`, `Arroyo Sin Nombre`). Detalle en la Parte C.
4. **Geometría:** la capa oficial (IGN, republicada por la PBA y el Banco Mundial) se captura a 1:100.000, así que no mejora la definición de los arroyos chicos. La mejora real vendrá de una máscara de agua de Sentinel-2 a 10 m, con las limitaciones de la Parte B.
5. **Fuentes que no se pueden usar como datos** por sus términos: Google Maps, Bing/Azure Maps, HERE, Apple Maps, Navionics/Garmin, Esri World Imagery (solo para calcar y validar a mano).

## Parte A · Inventario de fuentes (44)

Peso = peso propuesto para votar **nombres** (Parte B); 0 = no vota (solo geometría, contexto o prohibida).

### A1. OpenStreetMap (HOT export / Geofabrik / Overpass)

- **Categoría:** Comunidad abierta · **Estado:** [verificado] · **Peso en nombres:** 0.6
- **URL:** https://wiki.openstreetmap.org/wiki/Tag:waterway%3Driver
- **Qué ofrece:** Geometría (líneas waterway=river/stream/canal y polígonos natural=water) y nombres (name, name:xx; alt_name, old_name, wikidata son posibles pero en el volcado local no aparecen). Sin anchos medidos (a lo sumo width=*).
- **Formato:** PBF, Overpass JSON, GeoJSON, export HOT
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Las cuatro extracciones locales (Tigre, Segunda, Escobar, Guazú) tienen 351, 132, 191 y 86 vías waterway; solo 150, 88, 43 y 67 llevan name (Tigre: 43 %).
- **Licencia / uso en repo público y juego gratis:** ODbL 1.0. El mapa renderizado es 'Produced Work' (atribución visible). Si el repo publica el volcado o un derivado de la base, ese derivado va bajo ODbL. Compatible con repo público y juego gratuito si se cumple eso.
- **Descarga / automatización:** Overpass: POST https://overpass-api.de/api/interpreter (ver Parte B); espejo https://overpass.kumi.systems/api/interpreter; el repo ya tiene scripts/osm/fetch-delta.sh. Overpass dio 504 en la prueba del doc 06.
- **Confiabilidad:** Media: geometría buena donde alguien la trazó, pero nombres incompletos o con erratas (ver Parte C).
- **Evidencia:** https://wiki.openstreetmap.org/wiki/Tag:waterway%3Driver; https://help.openstreetmap.org/questions/78764/how-does-the-license-apply-to-my-project-if-i-generate-game-maps-from-osm-data; https://osmfoundation.org/wiki/Attribution

### A2. Overpass API (instancias públicas)

- **Categoría:** Comunidad abierta · **Estado:** [verificado] · **Peso en nombres:** 0.0
- **URL:** https://dev.overpass-api.de/overpass-doc/en/more_info/index.html
- **Qué ofrece:** Consulta en vivo de OSM con filtros por bbox y etiquetas.
- **Formato:** JSON/XML/CSV
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Mundial.
- **Licencia / uso en repo público y juego gratis:** Datos ODbL; la instancia pide user agent descriptivo, sin consultas paralelas y esperar >=30 s tras un 429.
- **Descarga / automatización:** POST con data=... ; en Actions usar un solo request por corrida y reintentos con espera.
- **Confiabilidad:** Media: saturación frecuente (504 en el doc 06).
- **Evidencia:** https://dev.overpass-api.de/overpass-doc/en/more_info/index.html; https://wiki.openstreetmap.org/wiki/ES:Overpass_API

### A3. IGN Argentina, Capas SIG: Cursos de agua y Espejos de agua

- **Categoría:** Oficial nacional · **Estado:** [verificado] (existencia de la capa y términos); formato WFS [según documentación] · **Peso en nombres:** 0.9
- **URL:** https://www.ign.gob.ar/NuestrasActividades/InformacionGeoespacial/CapasSIG
- **Qué ofrece:** Líneas de cursos de agua y polígonos de espejos de agua con nombre oficial (escala de captura 1:100.000 según IGN). Sin anchos.
- **Formato:** Shapefile, GeoPackage (según catálogo de terceros); WMS/WFS
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Nacional; el Delta está incluido pero a 1:100.000 los arroyos chicos probablemente faltan [no verificado].
- **Licencia / uso en repo público y juego gratis:** Los términos de ign.gob.ar (tyc1.html, 'Usos permitidos de la información descargada') exigen citar 'Fuente: Instituto Geográfico Nacional de la República Argentina'. Un ticket de JOSM concluyó que el texto no era claro para OSM. Los espejos de la PBA y del Banco Mundial lo republican como CC BY 4.0. Para un repo público: usar con atribución y pedir confirmación escrita al IGN.
- **Descarga / automatización:** Descarga directa del zip desde la página CapasSIG, o WFS (ver Parte B). Desde este equipo el dominio da 403 del proxy.
- **Confiabilidad:** Alta en nombres y jerarquía oficial; baja definición geométrica.
- **Evidencia:** https://catalogo.datos.gba.gob.ar/en/dataset/cursos-agua; https://josm.openstreetmap.de/ticket/15010; https://josm.openstreetmap.de/wiki/Maps/Argentina?version=44; https://wbwaterdata.org/dataset/argentina-water-courses/resource/f2488547-58f1-4d3b-8c63-4924325e17f6

### A4. IGN Argentina, geoservicios (ide.ign.gob.ar y wms.ign.gob.ar)

- **Categoría:** Oficial nacional · **Estado:** [verificado] (WMS/TMS topográfico); WFS hidrografía [no verificado] · **Peso en nombres:** 0.9
- **URL:** https://ide.ign.gob.ar/geoservicios/rest/services
- **Qué ofrece:** Teselas y WMS del Mapa topográfico IGN (nombres rotulados en el mapa); WFS de capas vectoriales.
- **Formato:** ArcGIS REST/TMS, WMS, WFS, WMTS
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Nacional; el JOSM lista también ortofotos del AMBA.
- **Licencia / uso en repo público y juego gratis:** Mismos términos que IGN SIG (atribución). JOSM lo trae con permission-ref a ign.gob.ar/descargas/tyc1.html.
- **Descarga / automatización:** Mapa topográfico: https://ide.ign.gob.ar/geoservicios/rest/services/Mapas_IGN/mapa_topografico/MapServer/tile/{z}/{y}/{x} (zoom 1-20). WFS hidrográfico: nombre de capa [no verificado]; listar con GetCapabilities.
- **Confiabilidad:** Alta, pero a veces el servidor cae.
- **Evidencia:** https://josm.openstreetmap.de/wiki/Maps/Argentina?version=29; https://josm.openstreetmap.de/wiki/Maps/Argentina?version=44; https://atlas.co/data-portals/ign-argentina/

### A5. IDERA (Infraestructura de Datos Espaciales de la República Argentina)

- **Categoría:** Oficial nacional · **Estado:** [verificado] (existe y lista IDEs); endpoints WFS [no verificado] · **Peso en nombres:** 0.0
- **URL:** https://www.idera.gob.ar/
- **Qué ofrece:** Catálogo de geoservicios de todos los organismos (IGN, provincias, INA, etc.). No es productora de datos.
- **Formato:** Catálogo CSW, enlaces a WMS/WFS
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Nacional.
- **Licencia / uso en repo público y juego gratis:** Depende del organismo de cada capa.
- **Descarga / automatización:** Catálogo con GetCapabilities/CSW; plugin QGIS ArgentinaGeoServices lista WMS/WFS. [no verificado]
- **Confiabilidad:** Media: muchos enlaces rotos.
- **Evidencia:** https://www.santafe.gov.ar/idesf/geoportal/paginas/ides-de-argentina; https://plugins.qgis.org/plugins/argentinageoservices_zip/json; https://opendata.fi.uncoma.edu.ar/jornadasIDERA/trabajos2023/Pose_etal.docx

### A6. Provincia de Buenos Aires, Datos Abiertos: dataset 'Cursos de agua' (IDEBA)

- **Categoría:** Oficial provincial · **Estado:** [verificado] · **Peso en nombres:** 0.85
- **URL:** https://catalogo.datos.gba.gob.ar/en/dataset/cursos-agua
- **Qué ofrece:** Cursos de agua de la provincia con nombre, derivados del IGN. Sin anchos.
- **Formato:** Shapefile, GeoJSON, KML (EPSG:4326)
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Toda la provincia, incluye el Delta bonaerense.
- **Licencia / uso en repo público y juego gratis:** Creative Commons Atribución 4.0 (ficha del dataset). Apto para repo público y juego gratuito con atribución.
- **Descarga / automatización:** Enlaces de descarga directos en la ficha del dataset (CKAN: /api/3/action/package_show?id=cursos-agua [según documentación]). La frecuencia figura como 'cada medio año' en una versión de la ficha y 'eventual' en otra.
- **Confiabilidad:** Alta en licencia clara; la geometría es la del IGN (1:100.000).
- **Evidencia:** https://catalogo.datos.gba.gob.ar/en/dataset/cursos-agua; https://catalogo.datos.gba.gob.ar/sr/dataset/cursos-agua

### A7. IDEBA (visor y geoservicios de la Provincia)

- **Categoría:** Oficial provincial · **Estado:** [verificado] (portal y uso de OGC); URLs de servicio [no verificado] · **Peso en nombres:** 0.0
- **URL:** https://ideba.gba.gob.ar/
- **Qué ofrece:** Visor y servicios OGC de capas provinciales (hidrografía, límites, catastro).
- **Formato:** WMS/WFS
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Provincial.
- **Licencia / uso en repo público y juego gratis:** Datos abiertos PBA, normalmente CC BY 4.0 [no verificado]
- **Descarga / automatización:** URL base de WFS [no verificado]; GetCapabilities para descubrirla.
- **Confiabilidad:** Media.
- **Evidencia:** https://www.santafe.gov.ar/idesf/geoportal/paginas/ides-de-argentina; https://50jaiio.sadio.org.ar:443/pdfs/sie/SIE-11.pdf

### A8. Autoridad del Agua (ADA) de la Provincia de Buenos Aires: visor GIS

- **Categoría:** Oficial provincial · **Estado:** [verificado] (URL listada por terceros) · **Peso en nombres:** 0.0
- **URL:** http://gis.ada.gba.gov.ar/gis/
- **Qué ofrece:** Visor con capas de recursos hídricos y peligrosidad; no encontré mapa específico del Delta.
- **Formato:** Visor web [no verificado]
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Provincia, foco en cuencas continentales.
- **Licencia / uso en repo público y juego gratis:** [no verificado]
- **Descarga / automatización:** Sin API conocida.
- **Confiabilidad:** Baja para el Delta.
- **Evidencia:** https://www.santafe.gov.ar/idesf/geoportal/paginas/visualizadores-de-argentina

### A9. Ministerio de Infraestructura PBA / Plan de obras del Delta; ARBA (catastro CARTO)

- **Categoría:** Oficial provincial · **Estado:** [verificado] (cifras y plugin); endpoints [no verificado] · **Peso en nombres:** 0.3
- **URL:** https://www.gba.gob.ar/node/23157
- **Qué ofrece:** Dicen que el Delta bonaerense tiene unas 300.000 ha de islas y cerca de 350 cursos de agua. ARBA ofrece parcelas catastrales (CARTO) que lindan con los cursos y llevan frente a 'río/arroyo'.
- **Formato:** HTML/PDF; ARBA: visor y WMS [no verificado]
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Provincial.
- **Licencia / uso en repo público y juego gratis:** [no verificado]
- **Descarga / automatización:** ARBA: ver plugin QGIS CatastroV3 para los endpoints (https://plugins.qgis.org/plugins/CatastroV3).
- **Confiabilidad:** Media.
- **Evidencia:** https://www.gba.gob.ar/node/23157; https://intranet.hcdiputados-ba.gov.ar/proyectos/07-08d12800.doc; https://plugins.qgis.org/plugins/CatastroV3

### A10. Municipio de Tigre (tigre.gob.ar: turismo, catastro, zonificación del Delta)

- **Categoría:** Municipal · **Estado:** folleto «Viví Tigre» recibido (ver abajo); sitio web [no verificado] · **Peso en nombres:** 0.8
- **URL:** https://www.tigre.gob.ar/
- **Qué ofrece:** Mapas turísticos, zonificación 'Zona Delta residencial consolidado/de expansión', Primera Sección de Islas.
- **Formato:** HTML/PDF [no verificado]
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Primera, Segunda (parte) y Tercera sección de Tigre.
- **Licencia / uso en repo público y juego gratis:** [no verificado] (pedir autorización).
- **Descarga / automatización:** Ninguna API encontrada. En el doc 06 el sitio no respondió desde servidores de EE. UU.
- **Confiabilidad:** Alta si publicaran la nomenclatura; no encontré un mapa PDF.
- **Evidencia:** https://www.frommers.com/destinations/tigre/planning-a-trip/; https://roomix.ai/blog/tigre-delta-guia-vivir
- **Actualización 2026-10-08: folleto oficial «Viví Tigre»** (Municipio de Tigre, Secretaría de Turismo). El usuario lo compartió como imagen. Es la fuente municipal que faltaba:
  - **Mapa de la Primera Sección** con los ríos y arroyos numerados. Confirma el recorrido del **Río Carapachay**: sale del Luján frente a Rincón de Milberg y sube al Paraná de las Palmas entre el Arroyo de los Nogales y el Cruz Colorada (doc 10).
  - **Líneas de lanchas colectivas** con su boletería en la Estación Fluvial: Líneas Delta (boletería 1), Jilguero (2) e Interisleña (3 y 4). Los recorridos están dibujados en colores; el de Jilguero va por el Carapachay.
  - **Puntos de interés:** museos, Puerto de Frutos, recreos, paseos y servicios.
  - **Uso:** referencia para validar nombres y recorridos y para ubicar puntos de interés y rutas de colectivas en el juego, con la atribución «Fuente: Municipio de Tigre – Viví Tigre». No se copia la imagen al repositorio; los datos se transcriben a mano, con fecha y fuente.

### A11. Municipio de San Fernando (islas de Segunda y Tercera sección, Reserva de Biosfera)

- **Categoría:** Municipal · **Estado:** [verificado] (texto); geoportal [no verificado] · **Peso en nombres:** 0.3
- **URL:** https://es.hispanopedia.com/wiki/Partido_de_San_Fernando
- **Qué ofrece:** El partido tiene 950 km2 con 2.ª y 3.ª sección; listados nombran arroyos Paycarabí, Cueva Grande, Estudiantes.
- **Formato:** HTML
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Segunda y Tercera sección.
- **Licencia / uso en repo público y juego gratis:** Wikipedia espejo CC BY-SA; geoportal municipal no encontrado.
- **Descarga / automatización:** Sin API.
- **Confiabilidad:** Media-baja.
- **Evidencia:** https://es.hispanopedia.com/wiki/Partido_de_San_Fernando; https://www.argenprop.com/casas/casa/zona-delta-san-fernando/dolares-hasta-75000

### A12. Municipio de Escobar (y Campana: 4.ª sección)

- **Categoría:** Municipal · **Estado:** [verificado] (solo avisos) · **Peso en nombres:** 0.1
- **URL:** https://www.argenprop.com/terrenos/zona-delta-campana
- **Qué ofrece:** Solo avisos que ubican el Paraná de las Palmas y el Canal Zorrilla en Escobar/Campana; los avisos se contradicen sobre la sección y el partido.
- **Formato:** HTML
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Islas de Escobar y Campana.
- **Licencia / uso en repo público y juego gratis:** Sin licencia (avisos comerciales).
- **Descarga / automatización:** Sin API.
- **Confiabilidad:** Baja.
- **Evidencia:** https://www.argenprop.com/terrenos/zona-delta-campana; https://www.argenprop.com/casa-en-venta-en-parana-de-las-palmas-1-ambiente--20048967

### A13. Servicio de Hidrografía Naval (SHN): cartas náuticas y Derrotero

- **Categoría:** Oficial náutico · **Estado:** [verificado] (existencia de las cartas H-1001/H-1014+); códigos H-112/H-211/H-212 que se me pidieron: no aparecieron [no verificado] · **Peso en nombres:** 1.0
- **URL:** https://www.hidro.gob.ar/
- **Qué ofrece:** Cartas oficiales: H-1001 Canal Emilio Mitre, 'Río Paraná de las Palmas', serie H-1014..H-1018A del Paraná a 1:25.000 / 1:10.000. Nombres y balizamiento. Profundidades de los canales troncales.
- **Formato:** Cartas papel y ráster (BSB/ENC) de pago; tablas de marea HTML
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Canales navegables troncales; arroyos chicos no están.
- **Licencia / uso en repo público y juego gratis:** Carta oficial con derechos del SHN; no redistribuir. Solo para consulta de nombres.
- **Descarga / automatización:** Alturas y mareas por scraping HTML (doc 06: 200). Catálogo de cartas [no verificado]
- **Confiabilidad:** Muy alta para canales navegables.
- **Evidencia:** https://legacy.iho.int/mtg_docs/rhc/SWATHC/SWATHC6/CHAtSO6-08-Reporte_Nacional_de_Argentina.pdf; https://legacy.iho.int/mtg_docs/rhc/SWATHC/SWATHC7/CHAtSO7-6a_Informe_Naciona_Argentina.pdf; https://www.swedishclub.com/news/loss-prevention/paraguay-parana-waterway-use-of-argentinean-charts/

### A14. Prefectura Naval Argentina: disposiciones de navegación del Delta, zonas

- **Categoría:** Oficial náutico · **Estado:** [verificado] (disposiciones); anexos de Tigre no leídos [no verificado] · **Peso en nombres:** 0.9
- **URL:** https://www.argentina.gob.ar/prefecturanaval/reglamentacion/ordenanzas
- **Qué ofrece:** Normas que nombran arroyos y zonas habilitadas: PZDE RI7 N° 02/15 (Primera Sección de Islas, Tigre), Ordenanza 1/18 (DPSN), Disposición 1471/2025; anexos con listas de arroyos (los de Paranacito son de Entre Ríos).
- **Formato:** PDF/HTML
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Zona Delta (Tigre, San Fernando, Escobar).
- **Licencia / uso en repo público y juego gratis:** Normativa pública (dominio público).
- **Descarga / automatización:** PDFs en argentina.gob.ar/sites/default/files y argentina.gob.ar/normativa; parseo de anexos con pdftotext.
- **Confiabilidad:** Alta para el nombre usado en reglamentación.
- **Evidencia:** https://mail.centronaval.org.ar/yccn/instrucciones-regatas/DISPOSICIONES-PREFECTURA-2016.doc; https://www.argentina.gob.ar/normativa/nacional/norma-419036/texto

### A15. INA, proyecto Delta del Paraná (INA-DELTA, INA-CARU)

- **Categoría:** Científico oficial · **Estado:** [verificado] · **Peso en nombres:** 0.6
- **URL:** https://www.argentina.gob.ar/ina/recursos/delta-parana
- **Qué ofrece:** Mapas de sitios de medición, relevamientos batimétricos, 'cursos de agua modelados', modelo topobatimétrico, informes con red de canales (HEC-RAS/Delft3D).
- **Formato:** PDF, mapas; modelo de elevación y shapefile [no verificado]
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Delta completo, énfasis en brazos principales y Bajo Delta.
- **Licencia / uso en repo público y juego gratis:** [no verificado] (publicaciones del Estado; pedir al INA).
- **Descarga / automatización:** Informes en https://www.ina.gob.ar/delta/pdf/ ; repositorio https://repositorio.ina.gob.ar ; serie de alturas INA a5 ya probada en el doc 06.
- **Confiabilidad:** Alta en hidráulica; no es fuente de toponimia fina.
- **Evidencia:** https://www.ina.gob.ar/delta/pdf/INA-DELTA_Info_01_Topobatimetria.pdf; https://www.ina.gob.ar/delta/pdf/INA-CARU_2019_Informe3_ModeloHidrodinamico.pdf; https://repositorio.ina.gob.ar/bitstreams/bb06f976-9ccf-4fee-8bbb-b88431184cd2/download

### A16. INA, base cartográfica de 53 mapas históricos del Delta (400 años)

- **Categoría:** Histórico · **Estado:** [verificado] · **Peso en nombres:** 0.1
- **URL:** https://www.ina.gob.ar/archivos/pdf/Ina-Phc-DBdelta.pdf
- **Qué ofrece:** Fichas con origen, escala e imagen de 53 mapas históricos; sirve para ver cambios de nombres.
- **Formato:** PDF
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Frente del Delta y brazos.
- **Licencia / uso en repo público y juego gratis:** Mapas antiguos en dominio público, la ficha es del INA.
- **Descarga / automatización:** PDF directo.
- **Confiabilidad:** Media: solo contexto histórico.
- **Evidencia:** https://www.ina.gob.ar/archivos/pdf/Ina-Phc-DBdelta.pdf; https://repositorio.ina.gob.ar/bitstreams/eaf4274b-66f3-4a40-8c96-7495f4090ad0/download

### A17. INTA (EEA Delta del Paraná; mapa de susceptibilidad a la inundación)

- **Categoría:** Científico oficial · **Estado:** [verificado] · **Peso en nombres:** 0.2
- **URL:** https://repositorio.inta.gob.ar/xmlui/handle/20.500.12123/7256
- **Qué ofrece:** Mapas de agua derivados de imágenes satelitales 1980-2010; forestación en islas. Útil como máscara de agua independiente.
- **Formato:** PDF/ráster [no verificado]
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Delta.
- **Licencia / uso en repo público y juego gratis:** [no verificado]
- **Descarga / automatización:** Repositorio institucional.
- **Confiabilidad:** Media.
- **Evidencia:** https://repositorio.inta.gob.ar/xmlui/handle/20.500.12123/7256; https://revistas.unc.edu.ar/index.php/revista-asagai/article/download/46086/46262/189784

### A18. Atlas Ambiental de Buenos Aires, mapa N2.6 Hidrografía (2006)

- **Categoría:** Oficial provincial · **Estado:** [verificado] · **Peso en nombres:** 0.5
- **URL:** https://observatorioamba.org/descargas/cartografia/N2_6_hidrografia.pdf
- **Qué ofrece:** Hoja de hidrografía con rótulos (Paraná Miní, Paraná de las Palmas, Luján, Canal Mitre, Río Unión, Río San Antonio, Barca Grande).
- **Formato:** PDF
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** AMBA y bordes del Delta; pide citar el Atlas. Declara ajustarse a la cartografía oficial (Ley 22.963, IGM).
- **Licencia / uso en repo público y juego gratis:** Citar fuente 'Atlas Ambiental de Buenos Aires'.
- **Descarga / automatización:** PDF directo; texto con pdftotext.
- **Confiabilidad:** Media: 2006, escala chica.
- **Evidencia:** https://observatorioamba.org/descargas/cartografia/N2_6_hidrografia.pdf

### A19. Banco Mundial, 'Argentina Water Courses' y 'Water Bodies'

- **Categoría:** Republicador · **Estado:** [verificado] · **Peso en nombres:** 0.0
- **URL:** https://wbwaterdata.org/dataset/argentina-water-courses/resource/f2488547-58f1-4d3b-8c63-4924325e17f6
- **Qué ofrece:** Copia del shapefile de cursos y cuerpos de agua del IGN (actualización marzo 2020; copia 2017 como 001_cursos_de_agua.zip).
- **Formato:** Shapefile, Feature Service
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Nacional.
- **Licencia / uso en repo público y juego gratis:** CC BY 4.0 (declarada por el repositorio; el origen es IGN).
- **Descarga / automatización:** Descarga desde la ficha.
- **Confiabilidad:** Media: igual que el IGN pero con fecha fija.
- **Evidencia:** https://wbwaterdata.org/dataset/argentina-water-courses/resource/adf24f3c-5e79-4913-b6f3-edaa5143cfb6; https://wbwaterdata.org/dataset/argentina-water-bodies/resource/4445a799-a440-4318-9f3e-d1bc40686094; https://datacatalog.worldbank.org/search/dataset/0042027/argentina-water-courses

### A20. Wikipedia (es/en) y espejos: Partido de Tigre, Río Luján, Delta del Paraná

- **Categoría:** Enciclopedia · **Estado:** [verificado] (artículos); Anexo [no verificado] · **Peso en nombres:** 0.4
- **URL:** https://en.wikipedia.org/wiki/Tigre_Partido
- **Qué ofrece:** Nombres de los ríos principales, longitudes, cuencas. El 'Anexo: Ríos y arroyos del Delta del Paraná' no apareció en ninguna búsqueda.
- **Formato:** HTML, API MediaWiki, dumps
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Solo ríos principales (Luján, Reconquista, Paraná de las Palmas).
- **Licencia / uso en repo público y juego gratis:** CC BY-SA 4.0.
- **Descarga / automatización:** https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=... (desde Actions).
- **Confiabilidad:** Media.
- **Evidencia:** https://en.wikipedia.org/wiki/Tigre_Partido; https://es.hispanopedia.com/wiki/R%C3%ADo_Luj%C3%A1n; https://ninos.kiddle.co/R%C3%ADo_Luj%C3%A1n

### A21. Wikidata (SPARQL)

- **Categoría:** Enciclopedia · **Estado:** [según documentación] (la búsqueda no devolvió ítems de Wikidata de arroyos de Tigre) · **Peso en nombres:** 0.4
- **URL:** https://query.wikidata.org/sparql
- **Qué ofrece:** Entidades de cursos de agua con coordenadas (P625), alias y enlace a Wikipedia. Cobertura de arroyos chicos del Delta probablemente baja.
- **Formato:** SPARQL JSON/CSV
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** [no verificado]
- **Licencia / uso en repo público y juego gratis:** CC0.
- **Descarga / automatización:** GET con ?query=... y header Accept: application/sparql-results+json (ver Parte B).
- **Confiabilidad:** Media-baja.
- **Evidencia:** https://query.wikidata.org/sparql

### A22. GeoNames

- **Categoría:** Gazetteer · **Estado:** [verificado] · **Peso en nombres:** 0.5
- **URL:** https://download.geonames.org/export/dump/
- **Qué ofrece:** Topónimos con alternate names; para el Delta hay áreas postales (p. ej. 'Rio Carapachay', CP 1649, -34.3553 -58.5427) y pocos cursos.
- **Formato:** TXT (dump), API JSON/XML
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Pobre en arroyos.
- **Licencia / uso en repo público y juego gratis:** CC BY 4.0 (gratis, uso comercial permitido con crédito).
- **Descarga / automatización:** Dump AR.zip + alternateNamesV2.zip; API api.geonames.org/searchJSON (10.000 créditos/día, 1.000/hora).
- **Confiabilidad:** Media-baja.
- **Evidencia:** https://geonames.org/export/; https://www.geonames.org/export/geonames-search.html; https://data.mongabay.com/world_zip_codes/Argentina/RIO_CARAPACHAY.html

### A23. NGA GEOnet Names Server (geonames.nga.mil)

- **Categoría:** Gazetteer · **Estado:** [verificado] · **Peso en nombres:** 0.5
- **URL:** https://geonames.nga.mil/geon-ags/rest/services/RESEARCH/GIS_OUTPUT/MapServer/0
- **Qué ofrece:** Topónimos oficiales de EE. UU. para el exterior; 'Río Paraná de las Palmas' en -34.32, -58.48.
- **Formato:** ArcGIS REST (JSON)
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Ríos grandes.
- **Licencia / uso en repo público y juego gratis:** Dato público de EE. UU. [no verificado]
- **Descarga / automatización:** REST query con where=FULL_NAME LIKE '%Palmas%'.
- **Confiabilidad:** Media.
- **Evidencia:** https://geonames.nga.mil/geon-ags/rest/services/RESEARCH/GIS_OUTPUT/MapServer/0/4125143

### A24. Mapcarta (y satellites.pro)

- **Categoría:** Agregador · **Estado:** [no verificado] · **Peso en nombres:** 0.0
- **URL:** https://mapcarta.com/
- **Qué ofrece:** Agrega OSM y Wikidata; no aporta nombres propios. La búsqueda no devolvió ninguna página de Mapcarta de arroyos del Delta.
- **Formato:** HTML
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** [no verificado]
- **Licencia / uso en repo público y juego gratis:** Contenido derivado de OSM/Wikidata; sin API oficial.
- **Descarga / automatización:** No recomendado.
- **Confiabilidad:** Baja (no independiente de OSM).
- **Evidencia:** https://mapcarta.com/17370126

### A25. Google Maps

- **Categoría:** Comercial · **Estado:** [verificado] (términos, por resumen de terceros y por Cesium) · **Peso en nombres:** 0.0
- **URL:** https://cloud.google.com/maps-platform/terms/maps-service-terms
- **Qué ofrece:** Nombres en el mapa base y vista satelital; la cobertura de arroyos chicos no pude comprobarla.
- **Formato:** Tiles/API
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** [no verificado]
- **Licencia / uso en repo público y juego gratis:** Prohíbe copiar, extraer, rasterizar, almacenar fuera del servicio y crear derivados (cache solo para IDs y por 30 días en ciertos campos). NO usar para datos del juego.
- **Descarga / automatización:** Ninguna permitida. Solo consulta visual manual para detectar errores.
- **Confiabilidad:** Alta visualmente, inutilizable como fuente de datos.
- **Evidencia:** https://cloud.google.com/maps-platform/terms/maps-service-terms; https://cesium.com/legal/terms-for-google/; https://conductatlas.com/platform/google-maps/google-maps-platform-terms-of-service/no-scraping-or-content-extraction/

### A26. Bing Maps / Azure Maps

- **Categoría:** Comercial · **Estado:** [verificado] (retiro y caching de Azure); términos Bing [no verificado] · **Peso en nombres:** 0.0
- **URL:** https://www.microsoft.com/en-us/maps/bing-maps/product
- **Qué ofrece:** Mapa base. Bing Maps for Enterprise está en retiro hacia Azure Maps. Imágenes Bing se pueden calcar en OSM.
- **Formato:** API/tiles
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** [no verificado]
- **Licencia / uso en repo público y juego gratis:** Azure Maps: prohíbe cachear para servir a varios usuarios; el texto de Bing no pude leerlo [no verificado]. No usar como datos.
- **Descarga / automatización:** No aplicable.
- **Confiabilidad:** n/a
- **Evidencia:** https://learn.microsoft.com/en-us/answers/questions/214472/azure-maps-caching-policy; https://wiki.openstreetmap.org/Tag:source:geometry=Bing

### A27. HERE Platform

- **Categoría:** Comercial · **Estado:** [verificado] (existe la restricción); texto [no verificado] · **Peso en nombres:** 0.0
- **URL:** https://developers.here.com/terms-and-conditions
- **Qué ofrece:** Mapa base y geocodificación.
- **Formato:** API
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** [no verificado]
- **Licencia / uso en repo público y juego gratis:** Tiene sección 'Restrictions on HERE Materials'; texto no recuperado [no verificado]. No usar como datos.
- **Descarga / automatización:** No aplicable.
- **Confiabilidad:** n/a
- **Evidencia:** https://developers.here.com/terms-and-conditions

### A28. Apple Maps (MapKit JS)

- **Categoría:** Comercial · **Estado:** [verificado] (copia de terceros del texto) · **Peso en nombres:** 0.0
- **URL:** https://developer.apple.com/forums/thread/120637
- **Qué ofrece:** Mapa base.
- **Formato:** API
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** [no verificado]
- **Licencia / uso en repo público y juego gratis:** Schedule 6 §2.5: no cachear, precargar ni almacenar datos de mapa salvo temporal. No usar como datos.
- **Descarga / automatización:** No aplicable.
- **Confiabilidad:** n/a
- **Evidencia:** https://developer.apple.com/forums/thread/120637; https://developer.apple.com/forums/thread/116695

### A29. Esri World Imagery

- **Categoría:** Imágenes · **Estado:** [verificado] · **Peso en nombres:** 0.0
- **URL:** https://wiki.openstreetmap.org/wiki/Esri
- **Qué ofrece:** Fondo satelital para validar a ojo; los términos permiten calcar y validar para crear datos vectoriales.
- **Formato:** Tiles
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Delta con imagen de alta resolución (fecha variable).
- **Licencia / uso en repo público y juego gratis:** La imagen no es abierta; lo calcado a mano puede publicarse (en OSM va bajo ODbL). No exportar/rasterizar las teselas al repo.
- **Descarga / automatización:** Solo editores (JOSM/iD) o inspección manual.
- **Confiabilidad:** Alta para verificar geometría.
- **Evidencia:** https://wiki.openstreetmap.org/wiki/Esri; https://wiki.openstreetmap.org/wiki/Template:Esri_image/doc; https://geoawesomeness.com/esri-world-imagery-comes-to-openstreetmap/

### A30. Natural Earth (ríos y lagos 1:10m)

- **Categoría:** Abierto global · **Estado:** [verificado] (licencia por espejos Stanford/BTAA) · **Peso en nombres:** 0.0
- **URL:** https://www.naturalearthdata.com/downloads/10m-physical-vectors/
- **Qué ofrece:** Ejes de grandes ríos. Demasiado grueso: el Delta sale como pocas líneas.
- **Formato:** Shapefile
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Mundial.
- **Licencia / uso en repo público y juego gratis:** Dominio público.
- **Descarga / automatización:** Descarga directa.
- **Confiabilidad:** Alta pero inútil para arroyos.
- **Evidencia:** https://geo.btaa.org/catalog/stanford-fv375tj7951; https://purl.stanford.edu/hv485tn5089

### A31. JRC Global Surface Water Explorer (Landsat 30 m, 1984-2021)

- **Categoría:** Satélite · **Estado:** [verificado] · **Peso en nombres:** 0.0
- **URL:** https://data.jrc.ec.europa.eu/dataset/jrc-gswe-global-surface-water-explorer-v1
- **Qué ofrece:** Ocurrencia, recurrencia y estacionalidad de agua. A 30 m solo resuelve cursos de más de ~60 m de ancho.
- **Formato:** GeoTIFF por teselas 10x10 grados; Earth Engine (JRC/GSW1_4)
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Mundial.
- **Licencia / uso en repo público y juego gratis:** Programa Copernicus, gratis, sin restricción de uso; citar 'EC JRC/Google'.
- **Descarga / automatización:** Descarga de teselas por HTTP desde el portal JRC o Earth Engine.
- **Confiabilidad:** Alta para brazos grandes; no para arroyos.
- **Evidencia:** https://data.jrc.ec.europa.eu/dataset/jrc-gswe-global-surface-water-explorer-v1; https://developers.google.com/earth-engine/tutorials/tutorial_global_surface_water_01

### A32. ESA WorldCover 2021 v200 (10 m)

- **Categoría:** Satélite · **Estado:** [verificado] · **Peso en nombres:** 0.0
- **URL:** https://registry.opendata.aws/esa-worldcover-vito/index.html
- **Qué ofrece:** Clasificación a 10 m; clase 80 = agua permanente. Máscara para anchos de más de ~30 m.
- **Formato:** Cloud Optimized GeoTIFF en S3 (AWS Open Data)
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Mundial.
- **Licencia / uso en repo público y juego gratis:** CC BY 4.0; atribución '© ESA WorldCover project / Contains modified Copernicus Sentinel data'.
- **Descarga / automatización:** s3://esa-worldcover/v200/2021/map/ (acceso anónimo) [según documentación]
- **Confiabilidad:** Media: clase 80 omite canales tapados por copa.
- **Evidencia:** https://registry.opendata.aws/esa-worldcover-vito/index.html; https://developers.google.com/earth-engine/datasets/catalog/ESA_WorldCover_v200; https://docs.planet.com/data/public-data/other-datasets/esa-worldcover/

### A33. Sentinel-2 L2A (Copernicus Data Space Ecosystem)

- **Categoría:** Satélite · **Estado:** [verificado] · **Peso en nombres:** 0.0
- **URL:** https://dataspace.copernicus.eu/node/605
- **Qué ofrece:** Bandas B03/B08 a 10 m para calcular NDWI y medir anchos (Parte B).
- **Formato:** SAFE, COG vía STAC, OData, openEO
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Revisita de 5 días.
- **Licencia / uso en repo público y juego gratis:** Datos abiertos y gratuitos con política de uso justo (Copernicus).
- **Descarga / automatización:** OData/STAC del CDSE; alternativa sin registro: Earth Search STAC en AWS (earth-search.aws.element84.com/v1) [según documentación]
- **Confiabilidad:** Alta para geometría de agua a 10 m.
- **Evidencia:** https://dataspace.copernicus.eu/node/605; https://earthobservations.org/storage/documents/Events/Open-Data-Open-Knowledge-workshop/Session-1/Presentation 2 - Razvan Cosac - ESA.pdf

### A34. GRWL, MERIT Hydro y HydroRIVERS (anchos y redes globales)

- **Categoría:** Satélite · **Estado:** [verificado] · **Peso en nombres:** 0.0
- **URL:** https://zenodo.org/record/1269595
- **Qué ofrece:** GRWL: anchos de ríos de más de ~90 m (Landsat). MERIT Hydro: ancho a 556 m. HydroRIVERS: red vectorial para cuencas >10 km2.
- **Formato:** Shapefile/GeoTIFF
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Mundial; irrelevante para arroyos chicos, sirve para Luján, Paraná de las Palmas, Paraná Miní.
- **Licencia / uso en repo público y juego gratis:** GRWL: citar a Allen y Pavelsky (2018), licencia exacta [no verificado]. MERIT Hydro: CC BY-NC 4.0 u ODbL 1.0 a elección. HydroRIVERS: licencia HydroSHEDS [no verificado]
- **Descarga / automatización:** Descarga desde Zenodo/Hydrosheds.
- **Confiabilidad:** Media-baja.
- **Evidencia:** https://zenodo.org/record/1269595; https://developers.google.com/earth-engine/datasets/catalog/MERIT_Hydro_v1_0_1?hl=it

### A35. Overture Maps (tema base/water)

- **Categoría:** Abierto global · **Estado:** [verificado] (licencias); capa water [no verificado] · **Peso en nombres:** 0.0
- **URL:** https://docs.overturemaps.org/
- **Qué ofrece:** Agua derivada de OSM y otros; no es independiente de OSM.
- **Formato:** GeoParquet en S3/Azure
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Mundial.
- **Licencia / uso en repo público y juego gratis:** CDLA-Permissive 2.0, con ODbL en lo derivado de OSM.
- **Descarga / automatización:** CLI overturemaps download --type=water --bbox=-58.95,-34.5,-58.3,-33.9 [según documentación]
- **Confiabilidad:** Media; redundante con OSM.
- **Evidencia:** https://blog.desdelinux.net/overture-maps-el-google-maps-con-datos-abiertos-ya-esta-disponible-para-su-uso-en-general/; https://community.openstreetmap.org/t/overturemaps-org-big-businesses-osmf-alternative/6760/182

### A36. Trabajos académicos: Kandus et al. 2019 (Inventario de humedales del Bajo Paraná), Sarubbi et al. (Análisis cartográfico del Delta), Taller Ecologista 2010

- **Categoría:** Académico · **Estado:** [verificado] (existencia); contenido [no verificado] · **Peso en nombres:** 0.2
- **URL:** https://www.argentina.gob.ar/sites/default/files/inventario_de_humedales_delta_del_parana_final.pdf
- **Qué ofrece:** Unidades de paisaje, mapas, histórico de 53 mapas. Los autores que me nombraste (Quesada, Fabricante) no los encontré en la búsqueda.
- **Formato:** PDF
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Bajo Delta.
- **Licencia / uso en repo público y juego gratis:** Cita académica; mapas con derechos de autor.
- **Descarga / automatización:** PDF directo.
- **Confiabilidad:** Alta en metodología, baja en nombres de arroyos.
- **Evidencia:** https://www.argentina.gob.ar/sites/default/files/inventario_de_humedales_delta_del_parana_final.pdf; https://rsistest.ramsar.org/RISapp/files/48745696/documents/AR2255_lit1510.doc; https://www.ina.gob.ar/archivos/pdf/Ina-Phc-DBdelta.pdf

### A37. Mapa Ningit 'Tigre & Delta' (plegable impermeable, 1:78.000, 1.ª y 2.ª sección + 1:260.000 con índice de canales y arroyos)

- **Categoría:** Turismo · **Estado:** [verificado] (ficha comercial) · **Peso en nombres:** 0.5
- **URL:** https://www.stanfords.co.uk/mendoza-9789872616106
- **Qué ofrece:** Índice de canales, arroyos e islas en papel. La ficha de la tienda tiene el título cruzado con otro producto (Mendoza): confirmar ISBN.
- **Formato:** Papel
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Primera y Segunda sección.
- **Licencia / uso en repo público y juego gratis:** Con derechos; solo comprar y consultar los nombres.
- **Descarga / automatización:** Ninguna.
- **Confiabilidad:** Media-alta.
- **Evidencia:** https://www.stanfords.co.uk/mendoza-9789872616106

### A38. Recorridos turísticos en catamarán y lanchas colectivas (Interisleña, Jilguero, Líneas Delta Argentino)

- **Categoría:** Turismo · **Estado:** [verificado] · **Peso en nombres:** 0.5
- **URL:** https://es-academic.com/dic.nsf/eswiki/612645
- **Qué ofrece:** Usan nombres de uso común: ríos Tigre, Luján, Sarmiento, Capitán, Carapachay, Angostura, Espera, arroyo Rama Negra Grande y Chico. Los mapas de recorrido de las líneas no aparecieron.
- **Formato:** HTML/PDF
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Primera Sección.
- **Licencia / uso en repo público y juego gratis:** Sin licencia.
- **Descarga / automatización:** Scraping no recomendado; leer a mano.
- **Confiabilidad:** Media (nombres de uso).
- **Evidencia:** https://es-academic.com/dic.nsf/eswiki/612645; https://www.welcomeargentina.com/tigre/delta-catamaran.html; https://www.guruwalk.com/es/walks/65959-senderos-cautivantes-del-delta-tigre-monte-blanco; https://www.civitatis.com/es/tigre/catamaran-rios-tigre-lujan-sarmiento/; https://www.lanacion.com.ar/salud/salidas-en-catamaran-entre-canales-y-vegetacion-frondosa-para-internarse-en-otro-mundo-nid01032025/

### A39. Cartas electrónicas para navegantes: Navionics/Garmin, GPSNauticalCharts (AR_H13001 Delta del Paraná 1:150.000)

- **Categoría:** Náutica comercial · **Estado:** [verificado] (carta listada); términos [no verificado] · **Peso en nombres:** 0.0
- **URL:** https://www.gpsnauticalcharts.com/main/ar_h13001-delta-del-parana-nautical-chart.html
- **Qué ofrece:** Profundidades y nombres de canales principales; escala demasiado general para arroyos.
- **Formato:** Apps/ENC
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Delta.
- **Licencia / uso en repo público y juego gratis:** Navionics/Garmin: licencia de suscripción, términos de redistribución no recuperados [no verificado]; no usar como datos.
- **Descarga / automatización:** Ninguna.
- **Confiabilidad:** Media.
- **Evidencia:** https://www.gpsnauticalcharts.com/main/ar_h13001-delta-del-parana-nautical-chart.html; https://panbo.com/chart-wars-post-acquisitions-whats-the-status-of-charts/

### A40. Mapas históricos: Biblioteca Nacional, Academia Nacional de la Historia, IGN Cartoteca, Royal Museums Greenwich, British Library

- **Categoría:** Histórico · **Estado:** [verificado] (fichas); Biblioteca Nacional [no verificado] · **Peso en nombres:** 0.1
- **URL:** https://rmg.co.uk/collections/objects/rmgc-object-545843
- **Qué ofrece:** 'Plano de navegación del Río Paraná y Río de la Plata' (RMG), carta de 1817 (Aldao), manuscritos de la British Library, 'Plano del Río Tigre' de 1908 (ficha de cartoteca). No hallé material digital de la Biblioteca Nacional.
- **Formato:** Imágenes/fichas
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Variable.
- **Licencia / uso en repo público y juego gratis:** Dominio público en general; verificar cada institución.
- **Descarga / automatización:** Manual.
- **Confiabilidad:** Baja para nombres actuales; útil para toponimia vieja (old_name).
- **Evidencia:** https://rmg.co.uk/collections/objects/rmgc-object-545843; https://searcharchives.bl.uk/catalog/036-002027975; https://contenido.ign.es/web/catalogo-cartoteca/resources/pdfcards/card005775.pdf; https://historylab.es/?p=5131

### A41. Portales inmobiliarios (Argenprop, Zonaprop, MercadoLibre, Remax, Mudafy, Roomix)

- **Categoría:** Uso popular · **Estado:** [verificado] · **Peso en nombres:** 0.2
- **URL:** https://www.argenprop.com/inmuebles/venta/arroyo-carapachay/dolares-hasta-45000
- **Qué ofrece:** Nombre de uso de cada curso en el campo 'Río/Arroyo' de la dirección y la sección (1.ª/2.ª). Muy útil como señal de uso, no como fuente oficial; los avisos a veces se contradicen.
- **Formato:** HTML
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Todas las secciones.
- **Licencia / uso en repo público y juego gratis:** Sin licencia; no copiar texto ni fotos, solo contar frecuencias de nombres.
- **Descarga / automatización:** Sin API; scraping prohibido por los términos de la mayoría [no verificado]
- **Confiabilidad:** Baja-media.
- **Evidencia:** https://www.argenprop.com/inmuebles/venta/arroyo-carapachay/dolares-hasta-45000; https://www.argenprop.com/inmuebles/espera; https://www.argenprop.com/inmuebles/capitan; https://mudafy.com.ar/casas/canal-gobernador-jose-inocencio-arias-dique-lujan-provincia-de-buenos-casa-en-venta-198214

### A42. Decreto o ley de nomenclatura de cursos de agua del Delta

- **Categoría:** Normativa · **Estado:** [verificado] (no encontrado); existencia de otra norma [no verificado] · **Peso en nombres:** 0.0
- **URL:** https://normas.gba.gob.ar/ar-b/decreto/2021/710/257115
- **Qué ofrece:** No encontré ninguna norma que fije los nombres. Decreto 710/2021 (emergencia hídrica del Delta) y la Ley 22.963 (cartografía oficial en manos del IGN) son lo único cercano.
- **Formato:** HTML/PDF
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** n/a
- **Licencia / uso en repo público y juego gratis:** Dominio público.
- **Descarga / automatización:** Buscar en normas.gba.gob.ar y en infoleg por 'denominación' y 'cursos de agua'.
- **Confiabilidad:** n/a
- **Evidencia:** https://normas.gba.gob.ar/ar-b/decreto/2021/710/257115; https://observatorioamba.org/descargas/cartografia/N2_6_hidrografia.pdf

### A43. Asociaciones de vecinos, clubes de remo y náuticos del Delta

- **Categoría:** Uso popular · **Estado:** [verificado] (solo la difusión); mapas vecinales [no verificado] · **Peso en nombres:** 0.0
- **URL:** https://mail.centronaval.org.ar/yccn/instrucciones-regatas/DISPOSICIONES-PREFECTURA-2016.doc
- **Qué ofrece:** El Centro Naval difunde las zonas de remo de la disposición de Prefectura. No hallé mapas de asociaciones vecinales ni de clubes con nombres.
- **Formato:** DOC/PDF
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Primera Sección.
- **Licencia / uso en repo público y juego gratis:** [no verificado]
- **Descarga / automatización:** Manual.
- **Confiabilidad:** Baja.
- **Evidencia:** https://mail.centronaval.org.ar/yccn/instrucciones-regatas/DISPOSICIONES-PREFECTURA-2016.doc

### A44. INA a5 (alerta.ina.gob.ar): alturas del río en San Fernando

- **Categoría:** Datos vivos · **Estado:** [verificado en doc 06, no en esta sesión] · **Peso en nombres:** 0.0
- **URL:** https://alerta.ina.gob.ar/a5/obs/puntual/series?var_id=2&estacion_id=52&format=json
- **Qué ofrece:** No sirve para nombres ni geometría, pero fija el nivel de agua para elegir imágenes de Sentinel-2 (ver Parte B). Medido en el doc 06: 200 desde GitHub Actions.
- **Formato:** JSON
- **Cobertura (Primera/Segunda/Tercera sección, San Fernando, Escobar):** Estación San Fernando (Luján).
- **Licencia / uso en repo público y juego gratis:** Datos públicos (Prefectura/INA).
- **Descarga / automatización:** GET directo.
- **Confiabilidad:** Alta.
- **Evidencia:** docs/investigacion/06-prueba-de-fuentes.md

## Parte B · Método para cruzar las fuentes

### B1. Principio general

1. **Primero la geometría, después el nombre.** Cada curso se identifica por su trazado, no por su nombre, porque los nombres son justamente lo dudoso. Se agrupan las vías de todas las fuentes cuando su eje cae a menos de 30 m del de OSM en al menos el 70 % del largo (distancia de Hausdorff media sobre muestras cada 25 m).
2. **Nombre canónico por votación ponderada con prioridad oficial:**
   - Se normaliza cada variante: minúsculas, sin acentos, sin prefijo (`arroyo|río|rio|canal|aguaje|riacho`), plural y singular unificados (`Felicaria`/`Felicarias`), guiones y espacios unificados (`Guazú-Nambí`/`Guazú Nambí`), distancia de Levenshtein <= 1 en nombres de más de 6 letras.
   - Puntaje de cada variante = suma de los pesos de las fuentes que la usan (columna "Peso" de la Parte A: SHN 1,0; IGN 0,9; PBA 0,85; Prefectura 0,9; Municipio 0,8; OSM 0,6; INA 0,6; GeoNames/NGA/turismo/Ningit 0,5; Wikipedia/Wikidata 0,4; inmobiliarias 0,2).
   - **Regla oficial:** si IGN, PBA, SHN o Prefectura coinciden entre sí, se adopta esa grafía, aunque otra gane por puntaje. Si el IGN y la PBA son la misma capa se cuentan como **una** sola voz.
   - **Tipo (Río/Arroyo/Canal):** se toma de la fuente oficial; si no hay, del tipo más votado. Los avisos inmobiliarios no votan el tipo.
   - Todas las variantes perdedoras se guardan en `alt_names` con la fuente. Las que aparezcan en mapas históricos van a `old_name`.
   - Se marca `revisar: true` cuando la variante ganadora saca menos del 20 % de ventaja, o cuando OSM tiene el curso sin `name`.
3. **Independencia:** OSM, Mapcarta, Overture y los espejos de Wikipedia derivan unos de otros; se cuentan una vez. IGN, el Banco Mundial y la PBA son la misma capa; cuentan una vez.
4. **Salida:** `data/curated/waterways.json` con `{id, name, kind, alt_names[], old_names[], wikidata, sources[], score, width_m{p10,p50,p90}, geometry_source, revisar}`. El juego lee solo esto.

### B2. Geometría: OSM contra IGN contra máscara satelital

- **OSM** (hoy): bueno donde hubo calco reciente (`source=maxar` aparece en el volcado). Detectar huecos: arroyos que la máscara de agua muestra y OSM no.
- **IGN / PBA** (1:100.000): sirve como control de nombres y de jerarquía. Descartar para geometría de los arroyos chicos.
- **Máscara de agua de Sentinel-2:** NDWI = (B03 - B08) / (B03 + B08), a 10 m, sobre compuesto de la mediana de 20 a 40 escenas de L2A con nubosidad < 10 % de 2023 a 2026. Umbral por Otsu local. [según documentación; fórmula de McFeeters, no leída en las fuentes de esta sesión]
- **Marea y crecida:** el Delta cambia de ancho con el nivel del Río de la Plata. Filtrar escenas por altura en San Fernando (INA a5, estación 52, ya medida en el doc 06) para quedarse con una banda de nivel (por ejemplo, entre 0,8 y 1,4 m) y reportar ese nivel junto al ancho.
- **Contrastes que se pueden automatizar:** (a) distancia de cada eje OSM al eje esquelético de la máscara; (b) porcentaje del eje que cae sobre píxeles de agua; (c) agua que la máscara ve y que no tiene ninguna vía OSM a menos de 40 m (candidatos a curso faltante); (d) comparación con ESA WorldCover clase 80 y con JRC GSW occurrence > 50 % como control.
- **Limitación importante:** a 10 m un arroyo de 15 m de ancho son 1 o 2 píxeles y la vegetación de la orilla lo tapa; JRC GSW (30 m) no resuelve cursos de menos de unos 60 m. En esos casos se conserva el eje de OSM y se estima el ancho por defecto según el orden del curso. Verificar a ojo en Esri World Imagery (permitido para calcar y validar).

### B3. Anchos

1. Esqueletizar la máscara y muestrear transectos perpendiculares al eje OSM cada 50 m.
2. Ancho del transecto = largo del tramo continuo de agua que cruza el eje, con interpolación sub-píxel sobre el NDWI.
3. Por curso: percentiles p10, p50 y p90, descartando transectos con nube, sombra o puentes. Si hay menos de 5 transectos válidos, `width_m = null` y se usa el valor por defecto del tipo.
4. Control cruzado en los brazos grandes (Luján, Paraná de las Palmas, Paraná Miní) con GRWL/MERIT Hydro y con los anchos de las cartas SHN.

### B4. GitHub Action

Las corridas deben ser en GitHub Actions porque el servidor de desarrollo no llega a los dominios argentinos (el doc 06 ya mostró que el IGN, el INA a5 y la SHN responden desde ahí, y que Prefectura, Interisleña y Tigre no). El flujo propuesto es **un workflow semanal con `workflow_dispatch`** que:

1. Descarga cada fuente a `raw/` (con reintentos y `--max-time`), y guarda un `summary.txt` con código HTTP, tamaño y fecha de cada una, igual que `probe-sources.yml`.
2. Corre `scripts/data/reconcile.py` (por escribir) y deja `waterways.json` y un `informe.md` de discrepancias como artefacto.
3. Abre un pull request solo si cambia algún nombre canónico; nunca publica directo en `main`.

```yaml
name: Cruce de fuentes del mapa
on:
  workflow_dispatch:
  schedule: [{ cron: "17 6 * * 1" }]
permissions: { contents: read, pull-requests: write }
jobs:
  fetch:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4
      - name: Descargar fuentes oficiales
        run: bash scripts/data/fetch-sources.sh   # IGN WFS, PBA CKAN, Wikidata, GeoNames, Overpass
      - uses: actions/upload-artifact@v4
        with: { name: raw, path: raw/ }
  reconcile:
    needs: fetch
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: raw, path: raw/ }
      - run: pip install shapely pyproj rapidfuzz rasterio numpy scikit-image
      - run: python scripts/data/reconcile.py raw/ data/curated/
      - uses: actions/upload-artifact@v4
        with: { name: curated, path: data/curated/ }
```

El token de GeoNames va en un secreto del repo (`GEONAMES_USER`), nunca en el código. [propuesta; no probada]

### B5. Consultas de ejemplo (todas sin ejecutar: [no verificado])

**1. IGN, WFS GetFeature de cursos de agua en el bbox (lat -34,5..-33,9; lon -58,95..-58,3).** Primero listar las capas, porque no pude confirmar el nombre; el eje de coordenadas en WFS 2.0 con `urn:ogc:def:crs:EPSG::4326` es **lat,lon**.

```bash
# 1) Capas disponibles
curl -sS "https://wms.ign.gob.ar/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities" -o caps.xml
grep -o '<Name>[^<]*</Name>' caps.xml | grep -i -E 'agua|hidro|curso|espejo'
# 2) Traer la capa (reemplazar CAPA por el nombre hallado, p. ej. ign:...)
curl -sS -G "https://wms.ign.gob.ar/geoserver/ows" \
  --data-urlencode "service=WFS" --data-urlencode "version=2.0.0" \
  --data-urlencode "request=GetFeature" --data-urlencode "typeNames=CAPA" \
  --data-urlencode "bbox=-34.5,-58.95,-33.9,-58.3,urn:ogc:def:crs:EPSG::4326" \
  --data-urlencode "outputFormat=application/json" -o ign_cursos.geojson
```
Alternativa sin WFS: el zip de Capas SIG o el dataset de la PBA (`https://catalogo.datos.gba.gob.ar/en/dataset/cursos-agua`) recortado con `ogr2ogr -spat -58.95 -34.5 -58.3 -33.9`.

**2. Wikidata, cursos de agua con coordenadas dentro del bbox, con alias** (Q355304 = curso de agua y P625 = coordenadas son identificadores que recuerdo, no los vi en una fuente de esta sesión):

```sparql
SELECT ?item ?itemLabel ?coord (GROUP_CONCAT(DISTINCT ?alias; separator=" | ") AS ?alias_es) WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(-58.95 -34.5)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(-58.3 -33.9)"^^geo:wktLiteral .
  }
  ?item wdt:P31/wdt:P279* wd:Q355304 .
  OPTIONAL { ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "es") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
} GROUP BY ?item ?itemLabel ?coord
```
Se envía por `https://query.wikidata.org/sparql?format=json&query=...` con `User-Agent` descriptivo. Variante por partido: sustituir el bloque `box` por `?item wdt:P131* wd:<Q del Partido de Tigre>`. [Q no verificado]

**3. GeoNames** (cursos y accidentes hidrográficos en el bbox; `featureClass=H`):

```bash
curl -sS "http://api.geonames.org/searchJSON?featureClass=H&country=AR&north=-33.9&south=-34.5&east=-58.3&west=-58.95&maxRows=1000&style=FULL&username=$GEONAMES_USER"
# Nombres alternativos: usar el dump
curl -sSO https://download.geonames.org/export/dump/AR.zip
curl -sSO https://download.geonames.org/export/dump/alternateNamesV2.zip
```
El dump tiene tabla de nombres alternativos aparte (`alternateNamesV2`). [según documentación]

**4. Overpass: todos los cursos con todas las etiquetas de nombre en el bbox** (para saber si `alt_name`/`old_name`/`wikidata` existen de verdad):

```
[out:json][timeout:180];
(
  way["waterway"~"^(river|stream|canal|ditch|tidal_channel)$"](-34.5,-58.95,-33.9,-58.3);
  relation["waterway"](-34.5,-58.95,-33.9,-58.3);
);
out tags center;
```
Contar luego `name`, `alt_name`, `old_name`, `name:es`, `wikidata`, `width`.

**5. Sentinel-2 por STAC (sin registro)**, Earth Search en AWS: `POST https://earth-search.aws.element84.com/v1/search` con `{"collections":["sentinel-2-l2a"],"bbox":[-58.95,-34.5,-58.3,-33.9],"datetime":"2023-01-01/2026-09-30","query":{"eo:cloud_cover":{"lt":10}}}`; leer `green` (B03) y `nir` (B08) como COG. [según documentación]

## Parte C · Nombres problemáticos de la Primera Sección (y vecinos)

**Qué se comparó.** Solo pude revisar tres tipos de fuente: (1) el **volcado local de OSM** (`scripts/osm/*.overpass.json`, leído completo, [verificado]); (2) **avisos inmobiliarios** y textos turísticos que aparecieron en `WebSearch` [verificado como texto de aviso, no como fuente oficial]; (3) pocos gazetteers. **Ninguna fuente oficial (IGN, PBA, SHN, Prefectura, Tigre) pude abrirla**, de modo que la columna "oficial" está vacía y toda discrepancia es una *hipótesis a confirmar* en la Action. Entre paréntesis va el tipo `waterway` de OSM y la cantidad de vías.

| Curso | OSM (volcado local) | Avisos, turismo y gazetteers | Discrepancia / acción |
|---|---|---|---|
| Río Luján | `Río Luján` (river, 8 vías en Tigre, 9 en Escobar) | "Río Luján" en avisos de Dique Luján y en espejos de Wikipedia; Atlas Ambiental "Luján" | Sin conflicto. Pendiente: tramo que algunos llaman "Canal Arias" |
| Río Tigre | `Río Tigre` (river, 1) | Tours "ríos Tigre, Luján y Sarmiento"; un espejo de Wikipedia lo describe como brazo del Reconquista | Sin conflicto de nombre. OSM tiene también `Río de la Reconquista` (3 vías); el antiguo nombre "Las Conchas" (según Wikipedia) iría en `old_name` |
| Río Sarmiento | `Río Sarmiento` (river, 1) | Avisos "Río Sarmiento", muelle San Carlos | Sin conflicto. Solo 1 vía en OSM: revisar continuidad |
| Río Capitán | `Río Capitán` (river, 1 en Tigre y 1 en Segunda); además `Arroyo Capitán Viejo` (stream), `Arroyo Capitancito` (river) y `Río Capitancito` (river) | Avisos "Río Capitán" y "Río Toro" juntos; no encontré "Capitancito" fuera de OSM | **Capitancito aparece como Río y como Arroyo** en la misma extracción y en la de Segunda. Unificar tipo; confirmar si "Capitán Viejo" es otro curso |
| Río San Antonio | `Río San Antonio` (river, 1) | Atlas Ambiental lo rotula | Sin conflicto |
| Carapachay | **Ninguna vía con ese nombre** en las cuatro extracciones (el repo lo usa en `waterwayRules.ts` y en `delta.world.json`) | Avisos: "Arroyo Carapachay" (Argenprop) y "Río Carapachay" (Remax); tours: "río Carapachay"; GeoNames: área postal "Rio Carapachay" CP 1649 | **Falta en OSM con ese nombre** y hay conflicto Río/Arroyo. Prioridad alta: buscar el eje por geometría y revisar si el `name` quedó en otra etiqueta o en una relación |
| Espera | Solo un polígono `Arroyo Espera Grande` (área); ninguna línea. `Arroyo Esperita` (river, 1) | Avisos y turismo: "Arroyo Espera" / "río Espera"; "Espera Chico" no aparece en ninguna fuente | Línea de `Espera` faltante. Falta evidencia de "Espera Chico". Decidir si "Esperita" es el nombre vigente |
| Abra Vieja | `Arroyo Abra Vieja` (river, 1 + polígono) | Aviso: "arroyo Abra Vieja", Primera Sección | Sin conflicto |
| Gambado | `Arroyo Gambado` (river, 2 vías) | Ninguna fuente externa lo mencionó | Sin contraste: [no verificado] fuera de OSM. Las reglas del juego ya lo usan (commit "the Gambado") |
| Rama Negra | `Arroyo Rama Negra` (river 1 + stream 1) | Turismo: "arroyo Rama Negra Grande y Chico" | OSM no distingue Grande y Chico; tipo mezclado river/stream |
| Caraguatá | `Arroyo Caraguatá` (river, 1) | Avisos: "Caraguatá" / "arroyo Caraguatá", Primera Sección | Sin conflicto de grafía (con tilde) |
| Dorado | `Arroyo Dorado` (river, 1 + polígono) | Avisos: "Arroyo Dorado" y también "Río Dorado" | Conflicto Río/Arroyo en avisos |
| Pajarito | `Arroyo Pajarito` (canal, 1) | Sin resultados | Tipo `canal` dudoso; sin contraste |
| Toro | `Arroyo Toro` (river 1 + stream 1 + polígono) | Avisos: "Arroyo Toro" y "Río Toro" | Conflicto Río/Arroyo; tipo mezclado en OSM |
| Antequera | `Arroyo Antequera` (river, 1 + polígono) y `Arroyo Antequerita` (stream, 1) | Sin resultados | Sin contraste |
| Durazno | `Aguaje del Durazno` (Tigre: river; Segunda: river y canal) y `Arroyo Durazno` (Segunda y Escobar, misma vía 1456901750) | Aviso: "arroyo Durazno", Segunda Sección de San Fernando | **Tres grafías para lo mismo** (`Aguaje del`, `Arroyo`). "Aguaje" no es término usual en el Delta [no verificado]. Confirmar con IGN y ubicar la sección |
| Felicaria | `Arroyo Felicaria` (river, Segunda) y `Arroyo Felicarita` (stream) | Aviso San Fernando: "Arroyo **Felicarias**" (plural), junto al Paraná Miní, Segunda Sección | **Singular vs plural** y **sección**: el pedido lo ubica en Primera pero OSM y el aviso lo ponen en Segunda |
| Esperita | `Arroyo Esperita` (river, 1) | Sin resultados | Ver Espera |
| Canal de Vinculación | `Canal de Vinculación` (river, 1) | Sin resultados | El pedido dice "Vinculación"; OSM le da prefijo "Canal de" y lo etiqueta `river` |
| Canal Arias | `Canal Gobernador Arias` (canal; Tigre y Escobar, vía 300909780). En Segunda y Guazú hay otro, `Canal Gobernador Arana` | Mudafy: "Canal Gobernador José Inocencio Arias" y "Canal Arias", cerca de Dique Luján, Primera Sección | **Arias vs Arana**: parecen dos canales distintos con apellido casi igual; no confundirlos. Nombre completo con nombre de pila según avisos |
| Canal Aliviador | `Canal Aliviador` (river 2 + stream 1 + polígono) | Sin resultados | Tipo mezclado río/arroyo para un canal |

### Otras discrepancias detectadas en el volcado

| Caso | Evidencia | Acción |
|---|---|---|
| `Arroyo Gelves` (OSM) contra "Gelvez" en avisos de Argenprop | OSM `Arroyo Gelves` (river, 1); avisos "Arroyo Gelvez" en Delta del Tigre | Consultar IGN/Prefectura para la grafía; el aviso "Gelvez" aparece junto al "Arroyo Toro" |
| `Río URíon` (OSM, error de tipeo con mayúscula) contra "Río Unión" (Atlas Ambiental) | OSM, Tigre (river, 1); Atlas lo rotula | Corregir a `Río Unión`; reportar al mapa de OSM |
| `Arroyo Panatanosito` (Segunda y Guazú) contra `Arroyo Pantanoso` (Segunda y Guazú) | Dos nombres para lo que parece el mismo curso | Corregir erratas |
| `Aguaje del mojarras` (`name:es=mojarras`) | OSM Tigre, stream | Posible "Aguaje de las Mojarras"; confirmar |
| `Arroyo Sin Nombre` (2 vías) | OSM puso un marcador en el `name` | Quitar del juego; sin nombre real |
| `Arroyo Paycarabí`, `Arroyo Pay Carabi` (Escobar), `Arroyo Paycarabicito` | OSM; avisos de San Fernando "arroyo Paycarabí" | Unificar como `Paycarabí` |
| `Arroyo Cuevas Grandes` (Escobar) contra "Cueva Grande" (aviso de San Fernando) | OSM y avisos | Confirmar grafía |
| `Arroyo Estudiante` y `Canal Estudiante` (OSM) contra "Estudiantes" (aviso) | OSM, avisos | Confirmar grafía |
| `Arroyo Guazú Nambí` (OSM, 8 vías) contra "Guazú-Nambí" (texto sobre Tigre) | OSM y texto turístico | Normalizar guión |
| Mismo nombre con `river` y `stream` (Correa, Cruz Colorada, Santa Rosa, Rama Negra, Toro, Piraña...) | OSM | Unificar el tipo según jerarquía y ancho medido |
| 201 vías `waterway` sin nombre en `delta-tigre` | Conteo propio | Nombrar por cruce con IGN/PBA y con la máscara |

## Próximos pasos

1. Ejecutar las consultas de B5 en la Action (el primer objetivo es listar `GetCapabilities` del IGN y confirmar el nombre de capa).
2. Subir esos resultados como artefacto y completar la columna "oficial" de la Parte C con IGN, PBA y Prefectura.
3. Pedir al IGN, por escrito, la aclaración de licencia para incluir sus nombres en un repositorio público.
4. Corregir en OSM las erratas claras (`Río URíon`, `Panatanosito`, `Sin Nombre`), con fuente, para que el próximo volcado ya salga bien.
5. Implementar `reconcile.py` y la máscara de agua de Sentinel-2.
