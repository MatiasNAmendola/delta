#!/usr/bin/env bash
# Probes the public data sources the game could use (ADR 0008, docs/investigacion/05):
# HTTP status, content type, size, robots.txt and a sample of each response.
# Runs on GitHub Actions (open internet); prints a report to the log.
set -uo pipefail
UA="DeltaGame-probe/1.0 (+https://github.com/MatiasNAmendola/delta)"
probe() {
  local name="$1" url="$2"
  local out code type size time
  out="$(mktemp)"
  read -r code type size time < <(curl -sS -L -A "$UA" --max-time 30 -o "$out" -w '%{http_code} %{content_type} %{size_download} %{time_total}\n' "$url" 2>/dev/null || echo "000 - 0 0")
  echo "::group::$name  [$code]  $type  ${size}B  ${time}s"
  echo "URL: $url"
  head -c "${LIMIT:-1500}" "$out" | tr -d '\r' | sed 's/[^[:print:]\t]//g' | fold -w 200 | head -n 25
  echo
  echo "::endgroup::"
  printf '%-34s %s %-28s %8sB %ss  %s\n' "$name" "$code" "${type:0:28}" "$size" "$time" "$url" >> summary.txt
  rm -f "$out"
}
: > summary.txt
# Can a browser read it directly? (CORS)
cors() {
  echo "::group::CORS $1"
  curl -sS -I -A "$UA" -H "Origin: https://matiasnamendola.github.io" --max-time 20 "$2" | grep -i -E "^(HTTP|access-control|content-type)" || true
  echo "::endgroup::"
}
cors "open-meteo" "https://api.open-meteo.com/v1/forecast?latitude=-34.42&longitude=-58.58&current=wind_speed_10m"
cors "ina a5" "https://alerta.ina.gob.ar/a5/obs/puntual/series?var_id=2&estacion_id=52&format=json"
# INA a5: San Fernando (Río Luján) heights, observed and forecast
FROM="$(date -u -d '-2 days' +%Y-%m-%dT%H:00:00Z)"
TO="$(date -u -d '+4 days' +%Y-%m-%dT%H:00:00Z)"
LIMIT=7000 probe "ina a5 serie completa" "https://alerta.ina.gob.ar/a5/obs/puntual/series?var_id=2&estacion_id=52&format=json"
LIMIT=2500 probe "ina a5 obs (series/52)" "https://alerta.ina.gob.ar/a5/obs/puntual/series/52/observaciones?timestart=$FROM&timeend=$TO&format=json"
LIMIT=2500 probe "ina a5 obs (query)" "https://alerta.ina.gob.ar/a5/obs/puntual/observaciones?series_id=52&timestart=$FROM&timeend=$TO&format=json"
LIMIT=2500 probe "ina a5 sim last" "https://alerta.ina.gob.ar/a5/sim/calibrados/432/corridas/last?series_id=26202&format=json"
LIMIT=2500 probe "ina a5 sim corridas" "https://alerta.ina.gob.ar/a5/sim/calibrados/432/corridas?series_id=26202&format=json&limit=1"
LIMIT=2500 probe "ina a5 pronostico serie" "https://alerta.ina.gob.ar/a5/sim/series/26202?format=json"
LIMIT=3000 probe "open-meteo tigre hoy" "https://api.open-meteo.com/v1/forecast?latitude=-34.42&longitude=-58.58&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover&forecast_days=2&timezone=America/Argentina/Buenos_Aires"
LIMIT=6000 probe "shn alturas (cuerpo)" "https://www.hidro.gob.ar/oceanografia/alturashorarias.asp"
if [ -n "${FULL:-}" ]; then
# Weather and wind
probe "open-meteo forecast" "https://api.open-meteo.com/v1/forecast?latitude=-34.42&longitude=-58.58&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=America/Argentina/Buenos_Aires"
probe "open-meteo marine (nivel)" "https://marine-api.open-meteo.com/v1/marine?latitude=-34.45&longitude=-58.45&hourly=sea_level_height_msl&forecast_days=1"
probe "smn robots" "https://www.smn.gob.ar/robots.txt"
probe "smn ws weather" "https://ws.smn.gob.ar/map_items/weather"
probe "smn ws alerts" "https://ws.smn.gob.ar/alerts/type/AL"
probe "smn ws forecast" "https://ws.smn.gob.ar/map_items/forecast/1"
# River height and tides
probe "shn robots" "https://www.hidro.gob.ar/robots.txt"
probe "shn alturas horarias" "https://www.hidro.gob.ar/oceanografia/alturashorarias.asp"
probe "shn pronostico mareas" "https://www.hidro.gob.ar/oceanografia/pronostico.asp"
probe "shn tablas de marea" "https://www.hidro.gob.ar/oceanografia/Tmareas/Form_Tmareas.asp"
probe "ina robots" "https://alerta.ina.gob.ar/robots.txt"
probe "ina alerta delta" "https://www.ina.gob.ar/delta/"
probe "ina a5 api" "https://alerta.ina.gob.ar/a5/obs/puntual/series?var_id=2&estacion_id=52&format=json"
probe "prefectura robots" "https://www.prefecturanaval.gob.ar/robots.txt"
probe "prefectura alturas" "https://contenidosweb.prefecturanaval.gob.ar/alturas/"
# Map data: waterways with navigation tags around the Delta
probe "overpass tags vias" "https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A60%5D%3Bway%5B%22waterway%22%5D%5B~%22%5E(motorboat%7Cboat%7Cmaxspeed%7Cmaxwidth%7Cmaxlength%7Caccess%7Cmotor_vehicle)%24%22~%22.%22%5D(-34.5%2C-58.8%2C-34.1%2C-58.3)%3Bout%20tags%3B"
# Traffic, transport
probe "aisstream docs" "https://aisstream.io/documentation"
probe "interislena" "https://www.interislena.com.ar/"
probe "lineas delta" "https://www.lineasdelta.com.ar/"
probe "tigre municipio" "https://www.tigre.gob.ar/"
fi
echo "================ RESUMEN ================"
cat summary.txt
