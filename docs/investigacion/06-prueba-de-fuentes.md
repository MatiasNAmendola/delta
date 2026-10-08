# 06 · Prueba de fuentes de datos (medida)

**Fecha:** 2026-10-08. **Cómo se midió:** workflow `.github/workflows/probe-sources.yml`, que ejecuta `scripts/data/probe-sources.sh` en los servidores de GitHub Actions (red abierta). El entorno de desarrollo no llega a estos sitios por su proxy.

| Fuente | Resultado | Formato | Uso en el juego |
|---|---|---|---|
| Open-Meteo forecast (Tigre) | 200, 0,9 s | JSON | Viento y clima del día. Licencia CC BY 4.0; gratis para uso no comercial, con límite de 10.000 llamadas por día |
| Open-Meteo marine (`sea_level_height_msl`) | 200 | JSON | Nivel del Río de la Plata (modelo); sirve de respaldo |
| SMN `ws.smn.gob.ar/map_items/weather` y `forecast/1` | 200 | JSON | **No usar:** las marcas `updated` son de 2019 y 2022, datos sin actualizar. `alerts/type/AL` da 404 |
| SHN alturas horarias, pronóstico y tablas de marea | 200 | HTML | Se pueden leer (scraping) si hiciera falta. No hay robots.txt (404) |
| **INA a5** `alerta.ina.gob.ar/a5/obs/puntual/series?var_id=2&estacion_id=52&format=json` | 200, 1,2 s | JSON | **Altura del río en San Fernando (río Luján)**, medida por la Prefectura (red "escalas Prefectura Nacional"), cada 15 min, con datos desde 2006 hasta hoy (129.035 registros) y un pronóstico asociado (series_id 26202, cal_id 432) |
| Prefectura (`prefecturanaval.gob.ar`, `contenidosweb…/alturas`) | Sin respuesta en 30 s | — | No llega desde servidores de EE. UU. |
| Interisleña, Municipio de Tigre | Sin respuesta | — | Idem |
| Líneas Delta | 200: "Página en construcción" | — | Sin datos |
| Overpass (etiquetas de navegación en vías) | 504, servidor saturado | — | Reintentar |
| aisstream.io | 403, desafío de Cloudflare | — | Requiere navegador o clave |

## Datos confirmados en la fuente primaria (INA a5, estación San Fernando)
- **Umbrales de San Fernando:** nivel de alerta **3,00 m**, nivel de evacuación **3,50 m**, nivel de aguas bajas **0,33 m**, cero IGN −0,53. Esto confirma el dato que el juez del doc 05 había dejado como "no confirmado".
- Ubicación: −58,55, −34,433; propietario PNA; datos públicos.

## Próximos pasos
- Leer las observaciones de las últimas 48 h y el pronóstico. Las rutas candidatas ya están en el probe v2; falta mirar el resultado.
- Al construir el deploy, generar `live/conditions.json` con la altura y la tendencia (INA) y el viento (Open-Meteo). El juego lo usa si es reciente; si no, simula.
