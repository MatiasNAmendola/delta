# 05 - APIs, fuentes de datos y scraping para el juego del Delta del Tigre

> **Revisión del juez (fecha 2026-10-08):** el juez tampoco pudo hacer curl/WebFetch a estos hosts; verificó por búsquedas web.
> **Validado:** términos de Open-Meteo (gratuito solo no comercial, <10.000 llamadas/día, 5.000/hora, 600/minuto, CC BY 4.0, definición de "no comercial": sin suscripciones ni publicidad) — pasa a [confirmado]; existencia de una API del INA usada por terceros (caso HydroSOS/UKCEH) con aviso de datos no validados; py-smn y app oficial SMN con alertas 24/48/72 h y de muy corto plazo; patrón de PDFs del INA; límites orientativos de Overpass; orden de la bbox Overpass (sur, oeste, norte, este) correcto.
> **Corregido:** los umbrales "San Fernando alerta 3,00 m / evacuación 3,50 m" **no pudieron confirmarse** (la fuente citada, `hidraulica.gob.ar/.../ReporteSala_20260820.pdf`, no apareció; los ReporteSala son del INA) → pasan a [no confirmado] y se agregaron alturas reales del SHN en eventos de sudestada (3,10 m en feb-2024; 2,90 m pronosticados en nov-2025) como referencia; se agregó el Centro de Prevención de Crecidas del SHN y la regla de que las alturas de San Fernando se repiten ~1 h después en Tigre/Primera Sección; dominio de contacto `hidro.gov.ar` marcado como posible error (`hidro.gob.ar`); horario de amanecer del ejemplo JSON recalculado.
> **Sigue sin verificar:** cualquier endpoint concreto (SHN, INA a5, ws.smn.gob.ar, aisstream), robots.txt de todos los hosts, licencia de datos del SMN/INA/SHN, cobertura AIS en el Delta.

Fecha de la investigación: 2026-10-08.

## 0. Advertencia metodológica (leer primero)

**Ninguna prueba con curl fue exitosa.** El proxy de salida de esta máquina respondió `CONNECT tunnel failed, response 403` (denegación por política de la organización; solo `api.github.com` respondió) para todos los hosts probados:

`api.open-meteo.com`, `marine-api.open-meteo.com`, `www.hidro.gob.ar`, `www.smn.gob.ar`, `ws.smn.gob.ar`, `www.ina.gob.ar`, `alerta.ina.gob.ar`, `www.prefecturanaval.gob.ar`, `aisstream.io`, `overpass-api.de`, `www.windguru.cz`, `www.argentina.gob.ar`, `example.com`. [verificado con curl: fallo 403 del proxy, no es un fallo de DNS del dominio en sí]

WebFetch tampoco resuelve DNS (`getaddrinfo ENOTFOUND` para `open-meteo.com`, `www.smn.gob.ar`, `aisstream.io`). Por lo tanto **no se pudo verificar ningún endpoint ni robots.txt desde esta máquina**. Lo único con evidencia externa viene de búsquedas web (se cita la URL). Todo lo demás proviene de conocimiento previo y está marcado **[no verificado]**.

Consecuencia práctica: el primer paso del proyecto debe ser un workflow de GitHub Actions de "sondeo" (`workflow_dispatch`) que haga `curl -I` / `curl` a cada endpoint desde los servidores de GitHub y guarde códigos HTTP, tipo de contenido y primeros bytes como artefacto. Los runners de GitHub tienen salida a internet abierta y DNS público, así que es probable que alcancen los dominios `.gob.ar`. Aun así, varios organismos argentinos bloquean IPs de datacenters extranjeros (los runners están en Azure/EE. UU.); hay que contemplarlo (ver fallbacks).

Los scripts del Action deben usar un User-Agent identificable, por ejemplo `delta-game-bot (+https://github.com/<usuario>/delta)`.

---

## 1. Altura del río y mareas

### 1.1 Servicio de Hidrografía Naval (SHN) - hidro.gob.ar
- **Qué ofrece:** pronóstico de marea (tablas astronómicas) para puertos del Río de la Plata (Buenos Aires, San Fernando, Montevideo, etc.), alturas observadas en tiempo real de mareógrafos, y un "modelo empírico" del Río de la Plata con pronóstico de altura incluyendo efecto meteorológico. Una presentación del propio SHN menciona la ruta `hidro.gob.ar/prediccion-marea/modelo-empirico` y la ampliación de la red mareográfica: https://www.cima.fcen.uba.ar/proyectos/pronomar/doc/7.Fiore-SHN-PotencialesAportesSeccionMareas.pdf [según documentación; ruta no revalidada]. Contacto de mareas publicado como `mareas@hidro.gov.ar` (misma fuente). *Juez:* el dominio institucional actual es `hidro.gob.ar`; verificar la dirección antes de escribir [no confirmado].
- **Tablas de marea:** el SHN las publica como libro/PDF anual (Tablas de Marea). Existen PDFs de ejemplo en argentina.gob.ar, p. ej. https://www.argentina.gob.ar/sites/default/files/2019-03-15_con_alturas.pdf (documento de otro tipo, ver 1.3). [no verificado el contenido]
- **Formato:** HTML con tablas y gráficos de imagen; PDFs para tablas. No conozco una API JSON documentada oficialmente. Sé que el sitio carga datos del mareógrafo con scripts internos, pero **no pude verificarlo** y no debe asumirse estable. [no verificado]
- **Frecuencia:** observaciones cada 10-60 min según estación [no verificado]; predicción astronómica es fija y calculable de antemano.
- **Autenticación / rate limit:** ninguna conocida. [no verificado]
- **Términos / robots.txt:** no se pudo leer https://www.hidro.gob.ar/robots.txt (403 del proxy). [no verificado] Hay que leerlo desde el Action de sondeo. Licencia de redistribución: no declarada de forma clara; tratar los datos como "información pública con atribución", pedir autorización por mail al SHN si el juego se difunde.
- **Dificultad de parseo:** media a alta (HTML/imagen/PDF). Fuente frágil.
- *Agregado por el juez:* el **Centro de Prevención de Crecidas del SHN** emite avisos con alturas pronosticadas para el puerto de San Fernando durante sudestadas (p. ej. 3,10 m el 4/2/2024 a las 14:30; 2,90 m pronosticados en noviembre de 2025), y el SHN indica que las alturas de San Fernando se repiten aproximadamente una hora después en Tigre y en la Primera Sección del Delta. [confirmado (extractos): https://www.lanacion.com.ar/sociedad/no-pude-salir-de-mi-casa-las-imagenes-de-calles-del-conurbano-cubiertas-de-agua-por-la-crecida-del-nid04022024/ ; https://prensamercosur.org/2025/11/29/sudestada-en-el-rio-de-la-plata-alerta-por-crecida-de-casi-3-metros/]. Útil para calibrar el juego: crecidas de ~3 m en San Fernando ya inundan calles e islas. Tigre difunde los avisos por el bot de WhatsApp municipal "Tigris" (misma nota de La Nación).

**Búsqueda realizada:** https://es.windfinder.com y otros resultados de "San Fernando" mezclan San Fernando de Cádiz (España); no son fuentes válidas para el Delta (resultado de WebSearch).

### 1.2 INA - Sistema de Alerta Hidrológico (alerta.ina.gob.ar)
- **Qué ofrece:** niveles del Paraná, Delta, Río de la Plata y afluentes; boletines diarios y "Cuadro" semanales en PDF; series de observaciones y pronósticos numéricos de nivel/caudal; pronósticos del Delta del Paraná. Fuentes encontradas:
  - Reporte diario PDF: https://alerta.ina.gob.ar/ina/06-INFORMES/diario/pdf/reporte_diario_2025-11-07.pdf (patrón `reporte_diario_AAAA-MM-DD.pdf`) [según resultados de búsqueda]
  - Cuadro PDF: https://www.ina.gob.ar/archivos/alerta/Cuadro_2026sep09.pdf (patrón `Cuadro_AAAAmmmDD.pdf`) [según resultados de búsqueda]
  - Series y pronósticos: `alerta.ina.gob.ar/a5/secciones` y `ina.gob.ar/alerta/index.php?seccion=10` (Delta) [según boletines citados en la búsqueda]
  - Boletín complementario Delta medio e inferior (PDF): https://diarioelnorte.com.ar/wp-content/uploads/2023/12/03_dic_23_Boletin-Hidrologico-complementario-para-Delta-medio-e-Inferior.pdf
- **Dato útil (degradado por el juez):** el boletín del 20/08/2026 informaría San Fernando (brazo Luján) 1,22 m, alerta 3,00 m, evacuación 3,50 m (resultado de WebSearch de los autores sobre `hidraulica.gob.ar/informes_hidrologicos/reporte/ReporteSala_20260820.pdf`). **[no confirmado]**: el juez no logró que ninguna búsqueda devolviera ese documento ni esos umbrales para San Fernando (sí los de Corrientes 6,50/7,00 m y Rosario 5,00/5,30 m en un boletín de dic-2023); además el dominio `hidraulica.gob.ar` no coincide con el del INA. Usar 3,00/3,50 m solo como **parámetro de diseño** hasta leer un ReporteSala real; como contraste, ver las alturas de eventos SHN en 1.1.
- **API:** el INA tiene una plataforma "a5" (`alerta.ina.gob.ar/a5`) que, por mi conocimiento previo, expone endpoints JSON de series por estación (`/a5/obs/...`). **[no verificado]**: no encontré documentación y no pude probarla. Probar desde el Action. *Juez:* un estudio de caso del UK Centre for Ecology & Hydrology (HydroSOS) confirma que el INA tiene una API usada por terceros para mostrar caudales diarios, con la advertencia de que, al ser tiempo real, los datos no están consolidados ni validados [confirmado (extracto): https://eip.ceh.ac.uk/hydrology/HydroSOS/case-studies/ina.html]; no da rutas ni esquema. El juego debe mostrar esa advertencia.
- **Frecuencia:** diaria (boletines); pronósticos del Paraná medio martes/viernes (misma búsqueda). Las series puntuales se actualizan más seguido [no verificado].
- **Auth / robots / licencia:** no verificados. Los informes son de organismo público; citar "Fuente: INA - Sistema de Alerta Hidrológico".
- **Dificultad de parseo:** PDF = alta (texto tabular, requiere `pdftotext`); si existe JSON de series = baja.

### 1.3 Prefectura Naval Argentina (PNA)
- **Qué ofrece:** Prefectura publica alturas hidrométricas y boletines de navegación (avisos a los navegantes, restricciones); las "alturas hidrométricas" históricas aparecen como boletín de la Subsecretaría de Puertos y Vías Navegables en argentina.gob.ar (ej. https://www.argentina.gob.ar/sites/default/files/2019-03-15_con_alturas.pdf, hallado por WebSearch; contenido no inspeccionado). [no verificado]
- **Formato:** PDF/HTML. Sin API conocida. **Términos y robots:** no verificados.
- **Dificultad:** alta; poco valor frente al INA/SHN para altura.

### 1.4 Apps "Altura del Río" y "Mareas Argentinas"
- No pude ubicar documentación de sus fuentes (no se hicieron búsquedas dirigidas por falta de acceso). Por lo general consumen SHN (predicción) e INA/PNA (alturas observadas). **[no verificado]** No usarlas como fuente: no tienen API pública ni licencia de redistribución; son útiles solo para contrastar valores manualmente.

### 1.5 Mareógrafo San Fernando / Tigre
- El SHN opera mareógrafo en San Fernando; el INA reporta "San Fernando" (brazo Luján) con umbrales (ver 1.2). Coordenadas de San Fernando según un listado comercial: 34°25'58" S, 58°31'58" O (https://marine.meteoconsult.co.uk/marine-weather/tide-times/san-fernando-406/june-2027 aparece en resultados de WebSearch; es fuente comercial, no usar). [no verificado]

### 1.6 Alternativa global para marea/nivel (sin Argentina oficial)
- **Open-Meteo Marine API** (`marine-api.open-meteo.com/v1/marine`) ofrece oleaje y, según la documentación, `sea_level_height_msl` (incluye marea modelada, resolución gruesa, no resuelve bien el estuario interior) [según documentación; no verificado con curl]. Puede servir como **fallback** de tendencia, no como altura real del Delta.

---

## 2. Clima y viento

### 2.1 Open-Meteo
- **Endpoint:** `https://api.open-meteo.com/v1/forecast?latitude=-34.42&longitude=-58.58&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=...&timezone=America/Argentina/Buenos_Aires` [según documentación; no verificado con curl: 403 del proxy].
- **Formato:** JSON. **Auth:** sin clave en el plan gratuito (la clave es para el plan comercial). [según documentación; coherente con los términos oficiales; no probado con curl]
- **Límites (términos oficiales):** gratuito para uso **no comercial**, menos de 10.000 llamadas/día, 5.000/hora, 600/minuto; datos bajo CC BY 4.0; se reserva bloquear usos abusivos sin aviso. Fuente: https://open-meteo.com/en/terms [confirmado por el juez vía extracto de WebSearch de la página oficial]. "No comercial" según los términos: sitios/apps privados o sin fines de lucro **sin suscripciones ni publicidad**; comercial: apps con suscripción o avisos, o integración en productos comerciales. Algunas fuentes secundarias citan cifras distintas (p. ej. 300.000/mes); prevalece la página oficial.
- **Atribución:** CC BY 4.0 -> mostrar "Datos meteorológicos: Open-Meteo.com" (la página oficial sugiere "Weather data by Open-Meteo.com") con enlace a Open-Meteo y a la licencia, indicando si hubo cambios. 
- **Uso comercial:** requiere plan pago. Si el juego es gratuito y sin monetización, entra en no comercial; si lleva publicidad/ventas, pasar a plan comercial o cambiar de fuente.
- **Con un cron cada 1-3 h consultando 1-5 puntos, se consumen <100 llamadas/día:** muy por debajo de los límites.
- **Frecuencia de actualización:** los modelos se actualizan cada 1-6 h [según documentación].
- **Parseo:** trivial.

### 2.2 SMN Argentina
- **Qué ofrece:** pronóstico, estaciones, **alertas** (a muy corto plazo, vigencia hasta 3 h; y a 24/48/72 h), incluyendo tormentas, vientos y alertas por "sudestada"/ viento (https://www.ellitoral.com/area-metropolitana/alertas-tormentas-fuertes_0_9qfTw8gQIi.html y app oficial https://apps.apple.com/us/app/-/id6443508769, ambos hallados por WebSearch).
- **API:** la búsqueda **no encontró documentación oficial** de `ws.smn.gob.ar`. Existe una librería comunitaria que dice usar "la API del SMN" y los datos públicos de su web (https://pypi.org/project/py-smn/). Por conocimiento previo, `ws.smn.gob.ar` expone JSON usado por el sitio (p. ej. `/map_items/weather`, `/alerts/type/AL`, `/v1/forecast/location/{id}`), pero **ni la existencia ni el esquema pudieron verificarse** y es una API interna no documentada que puede cambiar o bloquear sin aviso. [no verificado]
- **Datos abiertos:** el SMN publica datasets en https://www.argentina.gob.ar/smn/datos-abiertos y en datos.gob.ar (observaciones TXT/CSV, pronóstico por localidad). Licencia: la política general de datos abiertos de Argentina suele ser Creative Commons Atribución 4.0; **no verificada para el SMN** (la búsqueda no devolvió los términos). [no verificado]
- **Alertas en formato estándar:** el SMN podría publicar CAP (Common Alerting Protocol) vía WMO; no lo pude confirmar. [no verificado] Ver registro WMO: https://codes.wmo.int/wis/topic-hierarchy/centre-id/ar-smn
- **Dificultad:** baja si el JSON existe; media si hay que raspar HTML/CAP.

### 2.3 Windy / Windguru
- Ambos tienen **API/uso comercial restringido**: Windy exige clave de API (Map Forecast/Point Forecast) con condiciones propias y marca visible; Windguru prohíbe scraping y ofrece widgets/API con licencia. Condiciones exactas: https://api.windy.com y https://www.windguru.cz (no accesibles desde aquí). [no verificado]
- **Recomendación:** no usar ni raspar. Open-Meteo cubre la necesidad.

### 2.4 Sudestada
- La sudestada es un evento de viento SE sostenido que sube el nivel del Río de la Plata y del Delta. No es un producto con API propio; se puede **derivar**: (a) alerta SMN por viento/ marejada, (b) viento Open-Meteo (dirección 90-180° y ráfagas > ~40-50 km/h sostenidas varias horas) combinado con (c) altura observada/pronosticada SHN/INA por encima de un umbral (3,00 m en San Fernando como parámetro de diseño; ver 1.2: no confirmado como umbral oficial). Los avisos reales del SHN suelen expresarse además como sobreelevación respecto de la tabla de marea (p. ej. +2,10 m en feb-2024). La regla es una heurística propia. [no verificado como criterio oficial]

---

## 3. Tráfico de embarcaciones (AIS)

- **aisstream.io:** servicio gratuito por WebSocket. Según un issue público, el cliente envía un JSON de suscripción con `ApiKey` y `BoundingBoxes` (ej.: caja global) a un endpoint wss (https://git.tdem.in/vi/websocat/issues/187, hallado por WebSearch). La clave se obtiene con login de GitHub (misma búsqueda). Documentación oficial (URL, límites, términos): https://aisstream.io/documentation, **no accesible**. [no verificado]
- **Problema arquitectónico:** es un *stream continuo*, no un endpoint de consulta. Un Action cron puede conectarse 30-60 s, recoger los mensajes de una caja geográfica del Delta/Río de la Plata y desconectarse; la clave debe guardarse como *secret* del repo, nunca en el sitio estático.
- **Cobertura:** AIS terrestre colaborativo; en la zona del Delta la cobertura es incierta. Se esperan buques de carga y remolcadores en el Paraná de las Palmas/Canal Emilio Mitre/Río de la Plata (Clase A). **Lanchas colectivas y embarcaciones recreativas (Clase B) rara vez transmiten AIS**, y las islas interiores prácticamente no tienen receptores. [no verificado; estimación]
- **Alternativas:** MarineTraffic, VesselFinder y similares prohíben scraping y cobran API. No recomendadas.
- **Recomendación:** tráfico "real" de AIS aporta poco al Delta interior; usarlo solo como adorno en el Río de la Plata/ canal principal, con baja prioridad. Para el tráfico de lanchas usar horarios (sección 4.3) y simulación.
- **Licencia/ToS:** revisar términos de aisstream antes de redistribuir posiciones en JSON público. [no verificado]

---

## 4. Reglas de navegación y restricciones

### 4.1 OpenStreetMap / Overpass
- **Qué ofrece:** cursos de agua (`waterway=river|stream|canal|...`), restricciones (`motorboat=no`, `boat=no|yes|designated`, `maxspeed`, `maxwidth`, `maxdraft`, `access`), muelles, puentes, esclusas. La cobertura de restricciones en el Delta es probablemente escasa; verificar con una consulta de prueba (taginfo/ overpass turbo).
- **Consulta modelo (Overpass QL)** [según documentación, no ejecutada]:
```
[out:json][timeout:60];
(
  way["waterway"]["motorboat"="no"](-34.55,-58.75,-34.05,-58.30);
  way["waterway"]["maxspeed"](-34.55,-58.75,-34.05,-58.30);
  way["waterway"]["boat"](-34.55,-58.75,-34.05,-58.30);
);
out geom;
```
- **Límites:** el manual de Overpass indica un máximo orientativo de ~10.000 consultas/día y <1 GB/día, con *load shedding* por IP; ante 429 esperar >=30 s; usar User-Agent identificable y no paralelizar (https://dev.overpass-api.de/overpass-doc/en/preface/commons.html, vía WebSearch) [según documentación].
- **Licencia:** ODbL. Obliga a atribuir "© colaboradores de OpenStreetMap" y a compartir bajo la misma licencia las bases derivadas; el JSON del repo con ways extraídos es base derivada: publicarlo con ODbL y aviso de atribución. https://www.openstreetmap.org/copyright [no verificado el texto, conocimiento general]
- **Frecuencia en nuestro caso:** las restricciones cambian poco; correr semanal o mensual y commitear. 1 consulta/semana es insignificante.
- **Dificultad:** baja (JSON), pero hay que simplificar geometría.

### 4.2 Prefectura / Municipio de Tigre
- Normativa de navegación (Ordenanza 1/..., REGINAVE, velocidad máxima y zonas de exclusión como tramos de ríos con límite de velocidad, balizamiento) se publica en PDF/HTML en prefecturanaval.gob.ar, boletín oficial y tigre.gob.ar. No pude acceder. **[no verificado]**
- **Recomendación:** no automatizar. Transcribir **a mano** las pocas reglas relevantes (límites de velocidad por tramo, zonas prohibidas) a un JSON versionado, con enlace a la norma. Es contenido estático y de bajo volumen; el scraping no aporta.
- ToS: documentos normativos oficiales son de acceso público; citar la fuente.

### 4.3 Lanchas colectivas (Interisleña, Líneas Delta, Jilguero)
- Son empresas privadas; publican recorridos y horarios en sus sitios o redes (HTML, imágenes, Facebook/Instagram). No encontré formato estructurado (GTFS) ni API. **[no verificado]**
- Sus términos de uso y robots.txt no se pudieron leer. Sin autorización expresa, **no se debe raspar ni redistribuir** horarios con fines que compitan con ellas; el contenido está protegido por derechos de autor de la empresa.
- **Recomendación:** contactarlas pidiendo permiso, o modelar un horario genérico plausible (frecuencia por franja horaria) claramente rotulado como "ficticio/inspirado en". Si se desea realismo, cargar manualmente los horarios con permiso.

---

## 5. Otras fuentes para realismo

- **Amanecer/atardecer:** se calculan localmente (algoritmo NOAA / librería SunCalc, sin red) con lat -34.42, lon -58.58. Sin dependencia externa. [conocimiento general]
- **Fase lunar y marea astronómica:** se pueden calcular armónicamente; con las constantes armónicas de San Fernando (SHN) se podría predecir sin red, pero no se encontraron las constantes publicadas. [no verificado] Como alternativa, usar la tabla anual del SHN cargada una vez por año.
- **Temperatura del agua:** no hay serie oficial pública fácil. Open-Meteo Marine ofrece `sea_surface_temperature` (modelo, baja resolución en el estuario) [según documentación; no verificado]. Alternativa: estacionalidad fija (aprox. 12 °C invierno, 26 °C verano; estimación propia, no verificado).
- **Storm surge del Río de la Plata:** el SHN y el SMN producen pronósticos de nivel con efecto de viento (modelo del SHN, ver 1.1); en INA existen pronósticos para el Delta (ver 1.2). Sin API verificada.
- **Mapa base:** teselas OSM tienen política de uso restrictiva; para un juego usar MapLibre con teselas de un proveedor autorizado o servidas por uno mismo.

---

## 6. Prácticas respetuosas para scraping/descarga

1. **Revisar robots.txt y términos** de cada host desde el Action de sondeo; respetar `Disallow` y `Crawl-delay`. Si no se puede leer, no raspar.
2. **Baja frecuencia:** altura/viento cada 30-60 min como máximo; restricciones semanal; PDFs diarios una vez por día.
3. **Cachear y condicionar:** usar `If-Modified-Since`/`ETag`; no volver a descargar si no cambió; no commitear si el JSON es idéntico (evita ruido en git).
4. **User-Agent** identificable con contacto.
5. **Backoff exponencial** ante 429/5xx; sin reintentos agresivos.
6. **Atribución visible** en el juego (créditos: SHN, INA, SMN, Open-Meteo CC BY 4.0, OSM ODbL).
7. **Evitar redistribuir crudo** contenido sin licencia clara; publicar solo valores derivados mínimos (números, no PDFs completos).
8. **Descargo:** el juego no es para navegar; datos con fines recreativos.

---

## 7. Propuesta

### 7.1 Arquitectura

```
GitHub Actions (cron)  ->  scripts (Node/Python)  ->  data/*.json (commit si cambió)  ->  GitHub Pages
        |                                                                      ^
        +-- fuentes: Open-Meteo, INA, SHN, SMN, OSM/Overpass                    |
                                                          el juego hace fetch('data/estado.json')
```

- Workflow `fetch-data.yml` con `on: schedule` (cron cada 30-60 min; los crons de GitHub pueden retrasarse y se pausan a los 60 días sin actividad en el repo) y `workflow_dispatch`. Permisos `contents: write`. Si hay cambios: `git commit` + push; el despliegue de Pages se dispara solo.
- Un workflow aparte `fetch-osm.yml` semanal para restricciones de vías navegables.
- Un workflow `probe.yml` manual para verificar endpoints y robots.txt (ver sección 0).
- Cada fuente se consulta en un `try/catch` independiente; si falla, se **conserva el último valor bueno** y se marca `estado: "stale"` con la antigüedad. Nunca se rompe el JSON completo.
- Secretos (clave de aisstream si se usa) en *GitHub Secrets*; jamás en el cliente.
- El juego, al cargar, lee `data/estado.json`; si el archivo falta o está viejo (>6 h), entra en **modo simulado** (marea astronómica calculada + viento sintético por estación).

### 7.2 Qué fuente para cada dato

| Dato | Primaria | Respaldo 1 | Respaldo 2 (siempre disponible) |
|---|---|---|---|
| Altura del río hoy y tendencia en San Fernando | INA (serie San Fernando; JSON si existe, si no PDF diario) | SHN (alturas en tiempo real / modelo) | Marea astronómica calculada/tabla SHN anual + Open-Meteo Marine `sea_level_height_msl` para tendencia |
| Viento y clima | Open-Meteo forecast (sin clave, CC BY 4.0, no comercial) | SMN (JSON no documentado / datos abiertos) | Climatología fija por mes con dirección dominante |
| Alerta de sudestada | Regla derivada: viento SE (90-180°) con ráfagas sostenidas + nivel por encima de umbral | Alertas SMN (si el feed es accesible) | Se asume sin alerta (valor `"desconocido"`) |
| Vías restringidas | OSM Overpass (semanal) | JSON manual versionado (`data/restricciones_manual.json`) con normativa de Prefectura/Municipio | El mismo JSON manual |
| Amanecer/atardecer | Cálculo local (SunCalc) | - | - |
| Tráfico | Simulación + horarios manuales con permiso | AIS opcional (aisstream) solo canal principal | Simulación |

### 7.3 Esquema JSON de ejemplo (`data/estado.json`)

```json
{
  "schema_version": 1,
  "generated_at": "2026-10-08T19:30:00Z",
  "attribution": [
    "Datos meteorologicos: Open-Meteo.com (CC BY 4.0)",
    "Alturas: INA - Sistema de Alerta Hidrologico",
    "Mapa/vias: © colaboradores de OpenStreetMap (ODbL)"
  ],
  "location": {"name": "San Fernando / Delta de Tigre", "lat": -34.42, "lon": -58.58},
  "river": {
    "status": "ok",
    "source": "ina",
    "observed_at": "2026-10-08T15:00:00-03:00",
    "height_m": 1.22,
    "trend": "rising",
    "trend_m_per_h": 0.04,
    "thresholds_m": {"alert": 3.00, "evacuation": 3.50},
    "forecast": [{"t": "2026-10-09T00:00:00-03:00", "height_m": 1.40}]
  },
  "tide": {
    "status": "fallback",
    "source": "astronomical_calc",
    "next_high": "2026-10-08T22:10:00-03:00",
    "next_low": "2026-10-09T04:05:00-03:00"
  },
  "weather": {
    "status": "ok",
    "source": "open-meteo",
    "observed_at": "2026-10-08T19:00:00Z",
    "temp_c": 19.4,
    "wind_kmh": 18,
    "wind_dir_deg": 135,
    "gust_kmh": 32,
    "hourly": [{"t": "2026-10-08T20:00:00Z", "wind_kmh": 20, "wind_dir_deg": 140, "gust_kmh": 35}]
  },
  "sudestada": {
    "level": "none",
    "reason": "derived: viento SE < umbral, nivel < alerta",
    "source": "derived"
  },
  "sun": {"sunrise": "06:22", "sunset": "19:01"},
  "restrictions": {
    "source": "osm+manual",
    "updated_at": "2026-10-05T00:00:00Z",
    "file": "data/restricciones.geojson"
  },
  "sources_health": {
    "ina": {"ok": true, "last_success": "2026-10-08T19:30:00Z"},
    "shn": {"ok": false, "last_success": "2026-10-06T10:00:00Z", "error": "HTTP 403"},
    "open_meteo": {"ok": true, "last_success": "2026-10-08T19:30:00Z"}
  }
}
```

(*Juez:* valores del ejemplo ilustrativos; `height_m` 1,22 y umbrales 3,00/3,50 no confirmados, ver 1.2. Amanecer/atardecer recalculados con el algoritmo NOAA para -34.42, -58.58, UTC-3, 8/10/2026.)

`status` admite `ok | stale | fallback | unavailable`. El juego debe mostrar siempre un indicador sutil cuando `status != ok` y nunca bloquearse.

### 7.4 Próximos pasos
1. Ejecutar el workflow de sondeo en GitHub y completar la tabla de endpoints (código HTTP, formato, robots.txt) reemplazando cada **[no verificado]** de este documento.
2. Confirmar si `alerta.ina.gob.ar/a5` y `ws.smn.gob.ar` devuelven JSON usable desde runners de GitHub.
3. Escribir al SHN (mareas) y al INA pidiendo confirmación de uso automatizado y redistribución con atribución.
4. Decidir si el juego es no comercial (Open-Meteo gratis) o comercial (plan pago o cambiar fuente).
5. Ejecutar la consulta Overpass de prueba para medir cuántas vías con restricciones existen realmente en el Delta.
