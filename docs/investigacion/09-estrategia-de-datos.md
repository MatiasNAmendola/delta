# 09 - Estrategia de datos externos para el juego del Delta del Tigre

Fecha: 2026-10-08. Complementa `05-apis-y-scraping.md` (catálogo de fuentes) y `06-prueba-de-fuentes.md` (medición desde GitHub Actions).

## 0. Cómo leer este documento

- **[verificado]**: confirmado en esta sesión por una búsqueda web que devolvió un extracto de la fuente citada, o por la medición del doc 06 (que se hizo con curl desde runners de GitHub).
- **[no verificado]**: conocimiento previo o fuente secundaria que no se pudo contrastar con el texto oficial.
- Limitación de esta investigación: WebFetch no resuelve DNS en este entorno (`getaddrinfo ENOTFOUND` contra open-meteo.com, argentina.gob.ar, openstreetmap.org, docs.github.com y developers.cloudflare.com). Todo lo "verificado" viene de extractos de búsqueda, no de la lectura directa de los textos legales. Esto no es asesoramiento legal: antes del lanzamiento conviene una revisión de un abogado de propiedad intelectual y datos personales.

Estado medido (doc 06): INA a5 estación 52 (San Fernando) y Open-Meteo responden 200 con JSON y CORS `*`; las páginas del SHN responden HTML y no tienen robots.txt (404); SMN `ws` devuelve datos viejos (2019/2022); Prefectura, Municipio de Tigre e Interisleña no responden desde EE. UU.; Líneas Delta "en construcción"; Overpass dio 504; aisstream.io pide desafío Cloudflare.

---

## 1. API vs scraping vs curaduría manual vs aportes de la comunidad

### 1.1 Comparación general

| Criterio | API (JSON documentada o estable) | Scraping (HTML/PDF) | Curaduría manual (JSON versionado en el repo) | Aportes de la comunidad (PR/issues/formulario) |
|---|---|---|---|---|
| Frescura | Alta (minutos a horas) | Media a alta, pero frágil | Baja (días a años) | Variable; depende de que alguien lo haga |
| Robustez | Alta si es oficial y documentada; media si es "API interna" (INA a5, SMN ws) | Baja: cualquier cambio de maquetado la rompe | Muy alta (no depende de red) | Media; requiere revisión |
| Legal | Lo más claro: condiciones publicadas (Open-Meteo, OSM) | Zona gris: depende de términos, robots.txt y de qué se copie | Seguro si se transcriben hechos y se cita la norma; riesgo si se copia contenido creativo | Seguro si se pide licencia del aporte (CC0/CC BY) y no se aceptan datos personales |
| Costo | Cero a bajo | Cero, pero mano de obra | Horas de trabajo | Moderación |
| Mantenimiento | Bajo | Alto | Medio (revisión periódica) | Medio, distribuido |

### 1.2 Recomendación por tipo de dato

**Altura del río y mareas.**
- Primaria: **API** INA a5 (serie 52, San Fernando, cada 15 min, desde 2006, 129.035 registros según doc 06 [verificado por medición]). Es una API usada por terceros (el caso HydroSOS del UKCEH la integra), con la advertencia oficial de que los datos en tiempo real "no están consolidados ni validados" [verificado: https://eip.ceh.ac.uk/hydrology/HydroSOS/case-studies/ina.html]. No hay documentación pública de endpoints [verificado por búsqueda: no apareció], así que es una API no documentada: puede cambiar sin aviso.
- Respaldo: **scraping liviano** de las páginas HTML del SHN (alturas horarias, pronóstico), que respondieron 200 y no tienen robots.txt. Es frágil pero de bajo volumen (una página, cada 30-60 min).
- Último respaldo: marea astronómica calculada/tabla anual del SHN cargada a mano una vez por año (curaduría) y `sea_level_height_msl` de Open-Meteo Marine (modelo grueso, solo tendencia).
- Comunidad: poco útil acá.

**Clima y viento.** **API** Open-Meteo. Sin clave, CORS habilitado [verificado: README del proyecto vía búsqueda]. Alternativa descartada: SMN `ws` (datos de 2019/2022) y Windy/Windguru (condiciones restrictivas).

**Alertas de sudestada.** No existe producto API. Se **deriva** (viento SE sostenido de Open-Meteo + altura INA/SHN contra umbral). El umbral de alerta 3,00 m y evacuación 3,50 m de San Fernando está **confirmado** en la fuente primaria (INA a5, doc 06). Complemento opcional: alertas oficiales del SMN (feed todavía no accesible: `alerts/type/AL` dio 404). Para el aviso oficial real del SHN/Centro de Prevención de Crecidas, curaduría manual: un campo `aviso_oficial` que un mantenedor puede completar durante eventos grandes (ver 3.5).

**Reglas y restricciones de navegación.** **Curaduría manual** como fuente de verdad (pocas reglas, estáticas, de alto riesgo si están mal: límites de velocidad, zonas vedadas, REGINAVE). OSM/Overpass como capa complementaria semanal. No automatizar la lectura de normas de Prefectura/Municipio: no responden desde EE. UU. y transcribir a mano con enlace a la norma es más seguro.

**Lanchas colectivas (horarios y recorridos).** **Curaduría manual + comunidad.** No hay GTFS ni API pública ni datos abiertos del municipio [verificado por búsqueda: no se encontró ningún portal de datos abiertos de Tigre ni dataset de lanchas]. Las empresas (Interisleña, Líneas Delta, Río Tur) son privadas [verificado: https://www.frommers.com/destinations/tigre/planning-a-trip/ , guía posiblemente desactualizada]. Los horarios se transcriben de lo publicado, con permiso expreso si es posible; si no, modelo genérico rotulado "inspirado en". Los aportes de la comunidad (vecinos isleños, usuarios frecuentes) entran por PR con fuente y fecha, y se marcan como "no oficial".

**Puntos de interés.** **OSM** (Overpass semanal o extracto Geofabrik) + curaduría manual para los nombres/descripciones propios del juego + comunidad (PR). Atribución ODbL.

**Datos de mapa.** **OSM** como fuente de geometría (ver licencia en 2.5). Para el mapa visual no usar las teselas de tile.openstreetmap.org en producción: su política restringe el uso intensivo [no verificado en esta sesión: https://operations.osmfoundation.org/policies/tiles/]; usar teselas vectoriales de un proveedor con plan gratuito que lo permita, o geometría propia renderizada en canvas/MapLibre desde un GeoJSON recortado (preferido: sin dependencia en tiempo de ejecución).

---

## 2. Marco legal y ético en Argentina

Resumen práctico: **hechos (alturas, velocidades de viento, horarios, coordenadas) no son obra protegida; la compilación original y el texto creativo sí pueden serlo; los datos personales tienen régimen propio; los términos de uso y robots.txt son una cuestión de buena fe y de contrato más que de ley penal**.

### 2.1 Ley 27.275 (acceso a la información pública)
- El art. 2 reconoce el derecho a "buscar, acceder, solicitar, recibir, copiar, analizar, reprocesar, reutilizar y redistribuir libremente" la información en custodia de los sujetos obligados, con las únicas limitaciones de la propia ley [verificado: extracto del Boletín Oficial, https://www.boletinoficial.gob.ar/detalleAviso/primera/151503/20160929 ; texto: https://argentina.gob.ar/sites/default/files/ley27275.pdf].
- Plazo de respuesta: 15 días hábiles, prorrogables por otros 15 (art. 11) [no verificado: la búsqueda solo confirmó que el plazo está en el art. 11; hay un proyecto para reducirlo a 7 días, que no es norma vigente].
- Implica: lo que el INA, el SHN, el SMN y la Prefectura (organismos nacionales) publican es información pública y se puede reutilizar y redistribuir. Eso respalda el uso con atribución, pero **no obliga a un organismo a mantener un endpoint ni a no bloquear IPs**.
- Alcance: obliga a sujetos del sector público nacional. Las **empresas privadas de lanchas no son sujetos obligados** (salvo que reciban fondos públicos, art. 7, cosa que no se verificó).
- Cabe aclarar que el Municipio de Tigre se rige por la normativa bonaerense (Ley 12.475 de acceso a documentos administrativos) y la ordenanza local que corresponda [no verificado].

### 2.2 Decreto 117/2016 (Plan de Apertura de Datos)
- Instruyó a ministerios y organismos descentralizados del Poder Ejecutivo Nacional a elaborar un Plan de Apertura de Datos con su cronograma de publicación en datos.gob.ar [verificado: https://www.datos.gob.ar/acerca/seccion/marco-legal ; https://www.consejosalta.org.ar/2016/03/decreto-1172016-mm-datos-publicos-apertura-difusion-se-instruye-a-los-ministerios-secretarias-y-organismos-desconcentrados-y-descentralizados-dependientes-del-poder-ejecutivo-nacional-a-elabor/].
- La búsqueda **no confirmó** que el decreto fije una licencia (se suele citar CC BY 4.0 [no verificado]). El dataset del SMN "Estado del tiempo presente" en datos.gob.ar aparece con "No se especificó la licencia" [verificado: https://datos.gob.ar/zh_CN/dataset/smn-estado-tiempo-presente], y otro dataset climatológico del SMN en un repositorio académico figura como **CC BY-NC 4.0** [verificado: https://sedici.unlp.edu.ar/handle/10915/78367]. Moraleja: **la licencia se lee dataset por dataset**; no asumir CC BY.
- Los datos hidrométricos del INA/SHN/PNA no se confirmaron como datasets de datos.gob.ar. Mejor camino: pedir confirmación escrita (ver 2.8).

### 2.3 Ley 25.326 (datos personales)
- Regula bancos de datos públicos y privados; la autoridad de aplicación es la AAIP. Que un dato sea accesible no lo saca del alcance de la ley [verificado: extracto de https://www2.hcdn.gob.ar/export/hcdn/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf y AAIP https://www.argentina.gob.ar/aaip/politica-de-privacidad-de-la-aaip ]. La ley sigue vigente en 2026 sin reforma sancionada [verificado parcialmente: https://www.diariojudicial.com/news-103126-proteccion-de-datos-personales-sigue-siendo-suficiente-la-ley-25326-en-2026 ; fuente de mayo de 2026 coincidente, ambas secundarias].
- **Para este proyecto**: las fuentes de datos listadas son ambientales y no contienen datos personales. El riesgo aparece si: (a) se aceptan aportes de la comunidad con nombres/teléfonos/fotos de personas (casas, isleños, lancheros); (b) se usa AIS (identifica buques y a veces personas) [aisstream: no verificado]; (c) el juego guarda ubicación o identifica jugadores. Reglas: no pedir ni mostrar datos personales; los aportes comunitarios solo sobre lugares y horarios, no personas; sin analítica que identifique; si un día hay cuentas o ranking, política de privacidad y evaluar inscripción en la AAIP.

### 2.4 Ley 11.723 (propiedad intelectual)
- Protege obras originales; la reforma de la Ley 25.036 incluyó "compilaciones de datos y otros materiales" [verificado: extracto de jurisprudencia, https://www.diariojudicial.com/news-14168-procesado-por-copiar-una-base-de-datos ; WIPO Lex https://www.wipo.int/wipolex/es/legislation/details/85]. Una guía comparada indica que Argentina **no tiene derecho sui generis sobre bases de datos**, no tiene excepción de uso justo ni de minería de textos, y protege compilaciones solo por originalidad [verificado: extracto de https://thunderbit.com/es/blog/is-web-scraping-legal , fuente comercial, poca fuerza] ; hay antecedentes penales por copiar una base paga (caso Nosis) [verificado: diariojudicial].
- Consecuencias: tomar **valores puntuales** (una altura, un viento) es seguro; **no copiar PDFs, tablas completas, textos, mapas ni imágenes** de los organismos o de las empresas de lanchas; los horarios de una empresa se tratan como hechos, pero su folleto/diseño no. Publicar el mínimo derivado y citar la fuente.
- Art. 153 bis del Código Penal (acceso indebido a sistemas de acceso restringido): páginas públicas sin login no se consideran acceso restringido [no verificado: lectura secundaria; no hay jurisprudencia argentina localizada sobre scraping].

### 2.5 OpenStreetMap (ODbL)
- Atribución: "© colaboradores de OpenStreetMap" o "Map data from OpenStreetMap", con enlace a la licencia; para obras producidas (mapas mostrados al público) la atribución se exige cuando se usan públicamente y debe verse sin tener que interactuar y estar cerca del mapa [verificado: https://wiki.openstreetmap.org/wiki/Attribution_guidelines ; https://osmfoundation.org/wiki/Attribution].
- Share-alike: aplica a **bases de datos derivadas**. Un GeoJSON de vías extraído de OSM y publicado en el repo es una base derivada: debe publicarse bajo ODbL (tipo `data/osm/LICENSE` aparte) y mantenerse separado de las demás capas; un mapa renderizado es "obra producida" y no obliga a compartir el mapa [verificado en lo general; matiz de "base colectiva" no verificado: usar la regla segura de mantener el archivo OSM separado].
- Si se mezcla OSM con datos propios en el mismo archivo, ese archivo entero puede quedar bajo ODbL. Mantener capas separadas.
- Overpass: máx. orientativo ~10.000 consultas/día y ~1 GB/día; ante 429 esperar al menos 30 s; un cliente en paralelo [verificado: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html]. Para volumen, un extracto de Geofabrik evita Overpass (el nombre del archivo de Argentina es inferido del patrón: https://download.geofabrik.de/south-america/argentina-latest.osm.pbf [no verificado]). El 504 de doc 06 se arregla con reintentos con backoff y un espejo (p. ej. overpass.kumi.systems [no verificado]).

### 2.6 Open-Meteo: ¿un juego gratuito sin publicidad es "no comercial"? ¿y con auspicio de lancheras?
- Términos: API gratuita para uso open source y no comercial, "no restringimos el acceso pero pedimos uso justo"; más de 10.000 llamadas/día o uso comercial requieren contacto o plan pago; datos CC BY 4.0 [verificado: extractos de https://open-meteo.com/en/terms y https://open-meteo.com/en/about vía búsqueda; el doc 05 ya cita 10.000/día, 5.000/hora, 600/min].
- Definición operativa: el doc 05 cita que "no comercial" excluye suscripciones y publicidad; un directorio de terceros dice "sitios sin fines de lucro sin publicidad" y que el uso comercial está prohibido en el tier gratuito [verificado: extracto de https://apis.io/plans/open-meteo/open-meteo-plans-pricing/ ; fuente secundaria].
- **Juego gratuito, open source, sin publicidad, sin cobro**: encaja claramente en "no comercial" y "open source".
- **Donaciones voluntarias (GitHub Sponsors, Cafecito)**: la búsqueda no encontró nada sobre cómo trata Open-Meteo las donaciones [no verificado]. Riesgo bajo si es un proyecto personal sin contraprestación, pero no está garantizado.
- **Auspicio de empresas de lanchas** (logo, mención, banner, dinero a cambio de visibilidad): es publicidad/relación comercial → **dejaría de ser claramente no comercial**. Opciones: (1) escribir a Open-Meteo antes (info@open-meteo.com, dirección citada vía búsqueda [verificado: extracto]) describiendo el caso y pidiendo respuesta por escrito; (2) mover las llamadas a un plan de pago (el costo es bajo para este volumen [no verificado: precio]); (3) separar: el auspicio no financia el juego sino un contenido aparte; (4) cambiar la fuente de clima a una con licencia que lo permita (p. ej. datos abiertos del SMN si se confirma la licencia, o el modelo GFS/ICON descargado directamente de NOAA/DWD, que son de dominio público/abiertos [no verificado]). Recomendación: si hay auspicios, **asumir que es comercial**.
- Atribución CC BY 4.0: "Weather data by Open-Meteo.com" con enlace a https://open-meteo.com/ y a la licencia [doc 05, confirmado].
- Cuota: cada visitante consulta desde su propia IP, así que el límite por IP casi nunca se alcanza; el problema sería un único origen (un cron). Con un cron cada hora son 24 llamadas/día [cálculo propio].

### 2.7 Términos de cada sitio y robots.txt
| Sitio | Términos / robots.txt | Postura |
|---|---|---|
| INA (alerta.ina.gob.ar / ina.gob.ar) | Sin documentación de la API; aviso de datos no validados [verificado: HydroSOS]. robots.txt no verificado | Uso con atribución "Fuente: INA - Sistema de Alerta Hidrológico", mostrar la advertencia; pedir confirmación |
| SHN (hidro.gob.ar) | robots.txt 404 → no hay restricción declarada [verificado: doc 06]; términos de uso no verificados | Scraping liviano, baja frecuencia, User-Agent identificable, atribución; pedir autorización por escrito |
| SMN | `ws.smn.gob.ar` es API interna no documentada y con datos viejos [doc 06]; licencia varía por dataset (ver 2.2) | No usar `ws`; si se usa, datos abiertos con licencia leída por dataset |
| Prefectura | La página de alturas (contenidosweb.prefecturanaval.gob.ar/alturas) la citan portales provinciales; no hay API [verificado: https://www.santafe.gov.ar/idesf/geoportal/paginas/situacion-hidrica]; PDFs de "alturas hidrométricas" en argentina.gob.ar (ej. https://www.argentina.gob.ar/sites/default/files/2018/05/2023-08-07.pdf) con otros puertos, no el Delta. No responde desde EE. UU. | No depender; el dato de San Fernando llega vía INA (la red de escalas es de la Prefectura) |
| Municipio de Tigre | Sin respuesta desde EE. UU.; sin portal de datos abiertos hallado [verificado: búsqueda] | Curaduría manual; pedir datos al municipio |
| Lanchas (Interisleña, etc.) | Sin datos estructurados | Pedir permiso; si no, modelo genérico |

- **robots.txt**: es un estándar de cortesía, no una norma legal en Argentina; igualmente, respetarlo es la buena práctica. Regla del proyecto: si hay robots.txt, respetar `Disallow` y `Crawl-delay`; si es 404, se entiende que no hay restricción pero se mantiene baja frecuencia; si no se puede leer (timeout), no hacer scraping automático de ese host.
- Buenas prácticas ya listadas en doc 05, sección 6 (User-Agent con contacto, backoff, `If-Modified-Since`, no commitear si no cambió, publicar solo valores derivados).
- Un fallo estadounidense (Meta v. Bright Data, 2024) concluyó que los términos de servicio no prohíben extraer datos públicos sin sesión iniciada; es derecho estadounidense, no vincula a tribunales argentinos [verificado: extracto de https://thunderbit.com/es/blog/web-scraping-legal-implications , secundaria].

### 2.8 Cómo pedir acceso a los datos
1. **Primero un correo cordial** (más rápido que un trámite formal), con: qué es el proyecto (gratuito, open source, sin publicidad), qué dato se necesita, frecuencia estimada (p. ej. 1 consulta/30 min), cómo se atribuirá, un User-Agent de contacto, y qué se pide: (a) confirmar si el endpoint es de uso público y estable, (b) licencia/condiciones de reutilización, (c) un aviso de cambios. Destinos: INA (Sistema de Alerta Hidrológico, a través de ina.gob.ar), SHN (sección mareas; el correo citado en el doc 05, `mareas@hidro.gov.ar`, tiene un dominio dudoso, verificar `hidro.gob.ar`), SMN (sección datos abiertos/descarga de datos), Prefectura (departamento de comunicaciones/hidrografía), Municipio de Tigre (Secretaría de Turismo o de Modernización).
2. **Si no responden o niegan sin motivo**: solicitud formal por la Ley 27.275 (trámite a distancia, plataforma "Acceso a la Información Pública" de argentina.gob.ar [no verificado el enlace exacto]), indicando el formato deseado (JSON/CSV). Plazo 15 días hábiles prorrogables [no verificado en esta sesión]. Es un derecho de cualquier persona, sin necesidad de acreditar interés (art. 4) [no verificado].
3. Si se pide un favor extra (feed JSON en vez de PDF) hacerlo explícito; la ley obliga a entregar la información que existe, no a producir nueva (art. 5) [no verificado].
4. Guardar las respuestas en `docs/` (o un issue) como respaldo de la autorización.
5. Referencias comparadas: otros servicios hidrográficos atienden pedidos por formulario y carta de compromiso (SHOA Chile) o por correo (UKHO, AHO) [verificado: búsqueda]; la búsqueda no halló un procedimiento específico publicado del SHN argentino.

---

## 3. Arquitecturas posibles

### 3.1 Opción A: fetch directo desde el navegador (CORS)
- Funciona hoy para INA a5 y Open-Meteo (CORS `*`) [doc 06 + README de Open-Meteo].
- Pros: cero infraestructura, siempre fresco, cada visitante usa su IP (cuotas repartidas), sin cron que se pause.
- Contras: depende de la disponibilidad de la fuente en el momento; el INA ve tráfico proporcional a los visitantes (con éxito podría ser un problema ético/técnico y generar un bloqueo); sin cache compartida; expone el origen del juego a cambios de CORS; no sirve para fuentes sin CORS (SHN HTML) o que bloquean EE. UU.
- Mitigación: cache en el cliente (localStorage con try/catch, TTL 10-15 min), pedir solo lo necesario (últimas 48 h, no 129.000 registros), `AbortController` con timeout de 5 s, caída a simulación.

### 3.2 Opción B: GitHub Action con cron que commitea JSON (`live/conditions.json`)
- Pros: el INA y Open-Meteo ven una sola consulta cada N minutos; el juego lee un archivo estático del mismo origen (sin CORS ni claves); permite scraping del SHN y normalización; historial en git.
- Contras y notas verificadas:
  - **Los workflows `schedule` solo corren en la rama predeterminada** [no verificado en esta sesión: no se pudo abrir docs.github.com; es comportamiento documentado de GitHub, y el enunciado del encargo lo señala]. Si Pages se publica desde `main`, está bien; los PR/ramas de prueba no ejecutan el cron.
  - **En repos públicos, los workflows programados se desactivan tras 60 días sin actividad en el repo** [verificado: extractos de https://github.com/efrecon/gh-action-keepalive y https://dev.to/gautamkrishnar/how-to-prevent-github-from-suspending-your-cronjob-based-triggers-knf ; la actividad se mide por commits]. Como el propio cron commitea datos, hay que verificar si esos commits del `GITHUB_TOKEN` cuentan (en la práctica la gente usa un commit de "keepalive" o `gh workflow enable`) [no verificado]; incluir un paso que, si pasaron más de 45 días sin commits humanos, haga un commit de heartbeat, o reactivarlo manualmente.
  - El cron puede demorarse (picos de carga) y el mínimo es 5 minutos; planificar con 30-60 min y asumir retrasos [no verificado].
  - Cada commit dispara un despliegue de Pages y llena el historial; mitigar commiteando solo si cambió el valor, o publicando en una rama `data` / usando el artefacto de Pages en vez de commits.
  - Los runners están en EE. UU./Azure: Prefectura, Municipio e Interisleña no responden [doc 06].

### 3.3 Opción C: proxy/edge function (Cloudflare Workers, plan gratuito)
- Cuándo: fuentes sin CORS, o que bloquean EE. UU., o para unificar y cachear.
- Límites del plan gratuito (varían según fuente; contrastar con la página oficial): **100.000 solicitudes/día**; CPU de **10 ms** por solicitud según una guía y **30 ms** según otras [verificado: extractos de https://markaicode.com/benchmarks/cloudflare-workers-scalability-benchmark/ y https://eastondev.com/blog/en/posts/dev/20260526-cloudflare-free-limits/ ; discrepan]; KV gratuito: 100.000 lecturas/día y 1.000 escrituras/día [verificado: espejo https://cloudflare-docs.justalittlebyte.ovh/kv/platform/limits/]. Contrastar con https://developers.cloudflare.com/workers/platform/limits/ [no verificado, no se pudo abrir].
- Un Worker que solo hace `fetch` y reenvía con `Cache-Control` (caché del edge o `caches.default`) cabe holgadamente en CPU; el tiempo de espera de red no cuenta como CPU [no verificado].
- Caveat: **un Worker se ejecuta en el punto de presencia más cercano al visitante** y sale a internet desde ahí, así que podría llegar a hosts argentinos si el visitante está en Argentina (Cloudflare tiene presencia en Buenos Aires [no verificado]) pero no hay garantía; las fuentes que bloquean por ASN de datacenter pueden bloquear a Cloudflare igual [no verificado]. Probar antes con un Worker de prueba.
- Contras: una cuenta externa, un secreto, riesgo de abuso del proxy (limitar por `Origin` y a una lista blanca de URL fija, nunca un proxy abierto); sale del modelo "todo en GitHub".
- Alternativa para fuentes bloqueadas desde EE. UU.: un **runner autoalojado** de un voluntario en Argentina (o una Raspberry Pi) que ejecuta el mismo script y sube el JSON; mantener el proyecto sin servidores propios pagos. Mismo riesgo operativo (persona). [no verificado en factibilidad]

### 3.4 Capas de cache y respaldos (todas las opciones)
1. **Navegador**: leer primero `live/conditions.json` (mismo origen); si tiene menos de 2-3 h, usarlo. Si no, intentar directo INA/Open-Meteo con timeout. Si falla, **modo simulado** (marea calculada + viento sintético). Nunca bloquear el juego.
2. Cada dato lleva `observed_at`, `source`, `status` (`ok|stale|fallback|unavailable`) como en el esquema del doc 05, y el juego muestra un indicador sutil cuando no es `ok`.
3. Servidor (Action/Worker): `try/catch` por fuente; conservar el último valor bueno; no reemplazar un valor con un error; backoff exponencial ante 429/5xx; condicional (`ETag`/`If-Modified-Since`).
4. Validación de rangos antes de publicar (p. ej. altura entre −1 y 5 m en San Fernando; descartar saltos imposibles de más de 1 m por hora [cálculo propio]) para no propagar un dato roto.
5. Para eventos graves, el juego debe decir **claramente que es un juego y no una herramienta de navegación ni de alerta**; descargo visible, y enlace a las fuentes oficiales (SHN Centro de Prevención de Crecidas, SMN, Defensa Civil).

### 3.5 Atribución en la interfaz
- Pie fijo "Créditos y datos" accesible en 1 toque, con: "Alturas: INA - Sistema de Alerta Hidrológico (datos no validados)"; "Clima: Weather data by Open-Meteo.com (CC BY 4.0)"; "Mareas/pronóstico: Servicio de Hidrografía Naval"; "Mapa: © colaboradores de OpenStreetMap (ODbL)"; "Normas: Prefectura Naval Argentina / Municipio de Tigre (transcripción manual, fecha y enlace)"; "Horarios: [operador] (información no oficial)".
- La atribución del mapa debe estar cerca del mapa y visible sin interacción [verificado: OSMF].
- Mostrar la antigüedad del dato ("hace 20 min") y una marca si es simulado.
- Una página `/datos` con la tabla de fuentes, licencias y fecha de la última verificación.

---

## 4. Tabla de recomendación

| Dato | Fuente | Método | Frecuencia | Respaldo | Licencia / atribución |
|---|---|---|---|---|---|
| Altura del río en San Fernando y tendencia | INA a5 `alerta.ina.gob.ar/a5/obs/puntual/series?var_id=2&estacion_id=52&format=json` [verificado doc 06] | Action cron (JSON normalizado) + fetch directo desde el navegador como segunda vía | Cron 30 min; cliente con cache 10-15 min | SHN HTML (scraping liviano) → marea astronómica/Open-Meteo Marine → simulación | Sin licencia declarada; información pública (Ley 27.275 art. 2). Atribuir "INA - Sistema de Alerta Hidrológico"; aviso de datos no validados |
| Pronóstico de altura | INA a5 (series asociadas, series_id 26202, doc 06) y SHN modelo | Action cron | 1-3 h | Marea calculada | Ídem; SHN: pedir autorización |
| Marea astronómica | Tabla anual SHN cargada a mano + cálculo local | Curaduría manual anual | Anual | Open-Meteo Marine `sea_level_height_msl` (solo tendencia) | SHN: atribución; pedir permiso por escrito |
| Viento y clima | Open-Meteo `api.open-meteo.com/v1/forecast` | Navegador directo (CORS) o Action cron | Cron 1 h; cliente 15-30 min | Climatología por mes | CC BY 4.0 "Weather data by Open-Meteo.com"; gratis solo no comercial (ver 2.6) |
| Sudestada | Derivado (viento SE + altura vs 3,00/3,50 m) | Cálculo en cliente/Action | Con cada actualización | Campo manual `aviso_oficial` del SHN/SMN en eventos; "desconocido" | Heurística propia; rotular "no oficial"; enlazar SHN/SMN |
| Restricciones de navegación (velocidad, zonas vedadas) | Normas de Prefectura/Municipio | Curaduría manual en `data/restricciones_manual.json` con enlace a la norma y fecha | Revisión trimestral | Ídem | Normas públicas; citar la norma |
| Restricciones OSM (`motorboat`, `maxspeed`, `boat`) | OSM Overpass (o Geofabrik) | Action semanal | Semanal | Archivo previo; el manual | ODbL: "© colaboradores de OpenStreetMap"; archivo separado bajo ODbL |
| Lanchas colectivas (horarios y recorridos) | Operadores; sin API | Curaduría manual con permiso + PR de la comunidad | Revisión mensual/estacional | Horario genérico rotulado "inspirado en" | Pedir permiso; mostrar "no oficial, verificar con la empresa"; no copiar folletos |
| Puntos de interés | OSM + lista propia | Action semanal + curaduría + PR | Mensual | JSON previo | ODbL para lo de OSM; CC BY o CC0 para aportes propios |
| Mapa base | Geometría propia derivada de OSM (GeoJSON recortado) o teselas de proveedor autorizado | Build estático | Con cada release | Ídem | ODbL; atribución visible junto al mapa |
| Amanecer/atardecer, luna | Cálculo local (SunCalc) | Cliente | — | — | Sin dependencia externa |
| Tráfico fluvial | Simulación + horarios; AIS opcional | — | — | — | AIS: aisstream, términos no verificados; baja prioridad |

---

## 5. Próximos pasos priorizados
1. Mantener lo que ya anda (INA a5 + Open-Meteo directo) y **sumar `live/conditions.json` vía Action** para no depender del navegador ni multiplicar llamadas al INA.
2. **Enviar los correos de 2.8 al INA y al SHN** (y a Open-Meteo si habrá auspicios). Guardar las respuestas.
3. Decidir **política de auspicios** antes de aceptar cualquiera: si hay lancheras, tratar el juego como comercial para Open-Meteo.
4. Armar `data/restricciones_manual.json` y `data/lanchas.json` con esquema que incluya `fuente`, `url`, `fecha_verificacion`, `oficial: true|false`; plantilla de PR para la comunidad con licencia del aporte y prohibición de datos personales.
5. Agregar a `probe-sources.yml` la lectura de robots.txt de cada host y una prueba de Overpass con reintentos; agregar un Worker de prueba para ver si llega a Prefectura/Tigre.
6. Agregar el paso de heartbeat contra la desactivación de los 60 días.
7. Revisión legal breve antes del lanzamiento público.

---

## 6. Fuentes consultadas (≥ 15)
1. Open-Meteo, términos y about (vía búsqueda): https://open-meteo.com/en/terms , https://open-meteo.com/en/about [verificado: extracto]
2. Resumen de planes de Open-Meteo (terceros): https://apis.io/plans/open-meteo/open-meteo-plans-pricing/ [verificado: secundaria]
3. Ley 27.275, Boletín Oficial: https://www.boletinoficial.gob.ar/detalleAviso/primera/151503/20160929 [verificado: extracto]
4. Ley 27.275, texto: https://argentina.gob.ar/sites/default/files/ley27275.pdf [no verificado: no abierto]
5. Datos.gob.ar, marco legal (Decreto 117/2016): https://www.datos.gob.ar/acerca/seccion/marco-legal [verificado: extracto]
6. Resumen del Decreto 117/2016: https://www.consejosalta.org.ar/?p=87398 [verificado: extracto]
7. Ley 25.326, texto: https://www2.hcdn.gob.ar/export/hcdn/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf [verificado: extracto]
8. AAIP, política de privacidad: https://www.argentina.gob.ar/aaip/politica-de-privacidad-de-la-aaip [verificado: extracto]
9. Diario Judicial, vigencia de la Ley 25.326 en 2026: https://www.diariojudicial.com/news-103126-proteccion-de-datos-personales-sigue-siendo-suficiente-la-ley-25326-en-2026 [verificado: secundaria]
10. Diario Judicial, copia de base de datos (Ley 11.723): https://www.diariojudicial.com/news-14168-procesado-por-copiar-una-base-de-datos [verificado: extracto]
11. WIPO Lex, Ley 11.723: https://www.wipo.int/wipolex/es/legislation/details/85 [no verificado: no abierto]
12. Guía de scraping y derecho: https://thunderbit.com/es/blog/is-web-scraping-legal [verificado: comercial]
13. OSM, directrices de atribución: https://wiki.openstreetmap.org/wiki/Attribution_guidelines y https://osmfoundation.org/wiki/Attribution [verificado: extracto]
14. Overpass, manual de uso: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html [verificado: extracto]
15. Política de teselas OSM: https://operations.osmfoundation.org/policies/tiles/ [no verificado: no abierto]
16. Datos.gob.ar, SMN estado del tiempo presente (licencia no especificada): https://datos.gob.ar/zh_CN/dataset/smn-estado-tiempo-presente [verificado]
17. SEDICI, dataset SMN con CC BY-NC 4.0: https://sedici.unlp.edu.ar/handle/10915/78367 [verificado]
18. HydroSOS/UKCEH, API del INA: https://eip.ceh.ac.uk/hydrology/HydroSOS/case-studies/ina.html [verificado]
19. GitHub Actions, desactivación a los 60 días: https://github.com/efrecon/gh-action-keepalive , https://dev.to/gautamkrishnar/how-to-prevent-github-from-suspending-your-cronjob-based-triggers-knf [verificado: secundarias]
20. Cloudflare Workers/KV, límites: https://markaicode.com/benchmarks/cloudflare-workers-scalability-benchmark/ , https://eastondev.com/blog/en/posts/dev/20260526-cloudflare-free-limits/ , https://cloudflare-docs.justalittlebyte.ovh/kv/platform/limits/ [verificado: secundarias que discrepan]; oficial https://developers.cloudflare.com/workers/platform/limits/ [no verificado]
21. Santa Fe IDESF, referencia a la página de alturas de Prefectura: https://www.santafe.gov.ar/idesf/geoportal/paginas/situacion-hidrica [verificado]
22. Boletines "Alturas hidrométricas" en argentina.gob.ar: https://www.argentina.gob.ar/sites/default/files/2018/05/2023-08-07.pdf [verificado: extracto]
23. Tigre y operadoras de lanchas: https://www.frommers.com/destinations/tigre/planning-a-trip/ , https://es-academic.com/dic.nsf/eswiki/612645 [verificado: antiguas]
24. SHOA Chile, solicitud de datos: https://chileatiende.gob.cl/fichas/2953-solicitar-datos-hidrograficos-y-oceanograficos-para-fines-cientificos-y-o-academicos [verificado: referencia comparada]
25. Docs 05 y 06 del proyecto (medición desde GitHub Actions).

---

## 7. Resumen corto
- **Hoy conviene**: INA a5 y Open-Meteo por API, SHN como respaldo (scraping liviano), todo normalizado por un Action en `live/conditions.json` con el navegador como segunda vía y simulación como último recurso.
- **Curaduría manual** para restricciones, normativa y lanchas; la comunidad aporta por PR, con fuente y sin datos personales.
- **Riesgo legal principal**: Open-Meteo (gratis solo no comercial) si hay auspicios de lancheras; copiar contenidos de empresas o PDFs enteros (Ley 11.723); mezclar datos OSM con propios (ODbL).
- **Riesgo técnico principal**: API INA no documentada; cron que se desactiva a los 60 días; hosts argentinos que no responden desde EE. UU. (probar Worker de Cloudflare o runner autoalojado).
- **Acción**: mandar pedidos formales al INA y SHN (y a Open-Meteo) y guardar las respuestas; la Ley 27.275 queda como segunda vía.
