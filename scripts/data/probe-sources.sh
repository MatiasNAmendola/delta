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
  head -c 1500 "$out" | tr -d '\r' | sed 's/[^[:print:]\t]//g' | fold -w 200 | head -n 25
  echo
  echo "::endgroup::"
  printf '%-34s %s %-28s %8sB %ss  %s\n' "$name" "$code" "${type:0:28}" "$size" "$time" "$url" >> summary.txt
  rm -f "$out"
}
: > summary.txt
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
echo "================ RESUMEN ================"
cat summary.txt
