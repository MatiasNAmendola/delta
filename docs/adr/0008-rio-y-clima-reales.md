# 0008 · Altura del río y clima del día real

**Estado:** Propuesta · **Fecha:** 2026-10-08

## Idea
Que el Delta del juego tenga la altura del río y el clima de hoy: marea, crecida o bajante, nubes, lluvia y viento. Apps como "Altura del río" o "Mareas Argentinas" toman esos datos de fuentes oficiales.

## Fuentes
Ninguna se pudo probar desde el entorno de desarrollo, que bloquea esos dominios: hay que confirmarlas desde una máquina normal.

- **SHN** (Servicio de Hidrografía Naval, hidro.gov.ar): alturas observadas cada pocos minutos en el mareógrafo de San Fernando (hay un CSV de los últimos 10 días), pronóstico de pleamares y bajamares corregido por viento, y avisos de crecida y bajante. Son páginas HTML: hay que rasparlas. CORS probablemente no.
- **INA** (Instituto Nacional del Agua), API a5 (alerta.ina.gob.ar/a5): series observadas y pronosticadas en JSON o CSV, con el modelo del Delta actualizado cada 6 h. Probablemente sin CORS.
- **Prefectura**, "Registro del estado de los ríos": una lectura diaria por puerto (Tigre, San Fernando, Campana, Zárate...) con la tendencia y los niveles de alerta. Cada hidrómetro tiene su propio cero, así que no se pueden comparar crudos.
- **Open-Meteo**: clima actual y pronóstico, sin clave y con CORS. Gratis solo para uso no comercial, con atribución CC BY 4.0.

## Arquitectura propuesta (sitio estático, sin servidor)
1. **GitHub Action programada** (cada 30–60 min): un script raspa el SHN (y Prefectura una vez por día; el INA es opcional), valida los rangos y publica `live/conditions.json` junto con el sitio. Si una fuente falla, mantiene el último dato bueno y lo marca como viejo (`stale`).
2. **El clima** se pide directo desde el navegador a Open-Meteo y se guarda 15–30 min.
3. **Respaldo:** el último JSON de menos de 6 h; si no hay, una marea sintética con período de 12,42 h ajustada al último pronóstico de pleamares; si tampoco, valores típicos de la estación del año.
4. **Llevar la lectura de San Fernando a cada río:** `nivel = SF(t − retraso) × amplitud + ajuste`. En el Luján y el Tigre, alrededor de 1 h de retraso con la misma amplitud. Hacia el Paraná de las Palmas, más retraso y menos amplitud. Estos valores son estimaciones y hay que calibrarlos.

## Rangos (San Fernando, metros sobre el cero del SHN)
- **Normal:** 0,5–1,6 m. La marea astronómica sube y baja menos de 1 m en unas 12,4 h.
- **Crecida o sudestada:** aviso desde unos 2,3 m; alerta y evacuación en Tigre en 3,30 y 3,80 m; hubo picos de más de 3,4 m.
- **Bajante** (viento del norte o noroeste): llegó a −0,40 m. Una sudestada puede mover el agua 2 m en horas.

## En el juego
- **El plano del agua sube o baja.** Con agua baja aparecen bancos de barro y pilotes a la vista, los arroyos angostos se vuelven innavegables y se puede varar. Con agua alta los muelles se inundan y el agua entra a los jardines; arriba de 3 m se suspende la navegación.
- **El clima del día:** cielo, niebla, lluvia y viento (olas del shader).
- **Bajante extrema o caminos anegados** (lo pidió el usuario): el juego lo avisa y cambia el modo. Por ejemplo, entregas con dron a las islas aisladas (ADR 0006), o solo kayak por los canales que todavía tienen agua.

## Riesgos
- Los scrapers se rompen cuando cambia el formato de las páginas: hacen falta tests y alertas.
- Los sitios oficiales a veces se caen.
- El cron de GitHub se atrasa y se apaga después de 60 días sin actividad.
- La licencia de las series del SHN no está explícita: citar la fuente y preguntarle al SHN.
- Open-Meteo no es gratis para uso comercial.
