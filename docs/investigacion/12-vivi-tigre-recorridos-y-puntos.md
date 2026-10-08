# 12. Mapa «Viví Tigre»: recorridos de las colectivas y puntos de interés

Este documento transcribe a mano el mapa turístico oficial del Delta, para usarlo en el punto 1 de `docs/TRASPASO.md`. Los datos en bruto están en [`12-vivi-tigre-mapa.json`](12-vivi-tigre-mapa.json).

## Fuente

- **Autor:** Municipio de Tigre, Secretaría de Turismo («Viví Tigre»). Edición de agosto de 2026, consultada el 2026-10-08.
- **Página:** https://vivitigre.gob.ar/mapa-digital/ (sección «Delta de Tigre»).
- **Archivos:** las dos caras, de 2618×1892 px cada una.

| Cara | URL | SHA-256 |
|---|---|---|
| 1 (mapa) | `https://vivitigre.gob.ar/wp-content/uploads/2026/03/A3-MAPA-TURISMO-DELTA_EDIT-Agosto-2026-1.jpg` | `689295324f7d7639d216d02bee4dc43a570769250fdeb8f58c170158ed044a4f` |
| 2 (listado) | `https://vivitigre.gob.ar/wp-content/uploads/2026/03/A3-MAPA-TURISMO-DELTA_EDIT-Agosto-2026-2.jpg` | `8306bcc1601a9cdacaa9c963809d1b1cd32604e65334dec310863ae88ee71d4e` |

- **Uso:** las imágenes no se copian al repositorio (doc 07, A10). Lo que va en el juego son los datos transcriptos, con la atribución «Fuente: Municipio de Tigre – Viví Tigre».
- **Verificación:** para comprobar que el archivo publicado sigue siendo el mismo:

```bash
curl -s https://vivitigre.gob.ar/wp-content/uploads/2026/03/A3-MAPA-TURISMO-DELTA_EDIT-Agosto-2026-1.jpg | shasum -a 256
```

Si el hash cambia, el Municipio publicó una edición nueva y hay que repasar esta transcripción.

## Qué es y qué no es

- **Es un mapa esquemático.** Los recorridos dicen **por qué vías** pasa cada línea; no dan una geometría precisa. En el juego, la geometría sale de OSM (`world.rivers`) y este mapa decide qué vías usa cada línea.
- **Las coordenadas `px` del JSON** son el centro de cada marcador sobre la cara 1, con un margen de ±15 px, y no están georreferenciadas. Sirven para ubicar el punto en el tramo de río más cercano, no como lat/lon. Se verificaron 4 marcadores (1, 34, 57 y A) recortando el JPG original en esas coordenadas.
- **Los teléfonos no se transcribieron.** El juego no los necesita.

## Recorridos de las lanchas colectivas

Todas salen de la **Estación Fluvial de Tigre**. La boletería de cada línea es la que indica el mapa.

Confianza: **alta** = el trazo es continuo y la vía está rotulada en el mapa; **media** = la vía se deduce porque el trazo pasa cerca del rótulo; **[a confirmar]** = el trazo es ambiguo y hay que contrastarlo con la empresa o con OSM.

### Líneas Delta (violeta, boletería 1)

| Tramo | Confianza |
|---|---|
| Río Luján, desde la Estación Fluvial hacia el oeste (frente a Rincón de Milberg, Bahía Grande de Nordelta y Villa La Ñata / Dique Luján) | alta |
| Canal Gobernador Arias, del Río Luján al Paraná de las Palmas | alta |
| Paraná de las Palmas, desde el Canal Gobernador Arias hacia el este, hasta el Arroyo El Banco | alta |
| Ramal corto al Arroyo Cruz Colorada (entrada desde el Paraná) | media |
| Ramal al Arroyo La Horca | alta |
| Ramal al Arroyo El Banco | alta |

### Jilguero (magenta, boletería 2)

| Tramo | Confianza |
|---|---|
| Río Luján, de la Estación Fluvial a la boca del Río Carapachay | alta |
| Río Carapachay completo, del Luján al Paraná de las Palmas: pasa frente al Arroyo Angostura, el Arroyo Esperita, el Canal Ortiz y el Arroyo Caraguatá, y sale entre el Arroyo de los Nogales y el Arroyo Cruz Colorada | alta |
| Ramal por el Arroyo Angostura, con una entrada corta al Arroyo Esperita | [a confirmar] |

Coincide con lo que dice el doc 10 sobre el recorrido del Carapachay.

### Interisleña (verde, boleterías 3 y 4)

Es la red más grande. Va por el centro y el este de la Primera Sección.

| Tramo | Confianza |
|---|---|
| Río Sarmiento, de la Estación Fluvial al norte (pasa frente al Museo Sarmiento, A) | alta |
| Arroyo Abra Vieja y su salida al Río Luján, frente al hostel 7 | media |
| Río San Antonio, del Sarmiento al este, hasta el punto 34 | alta |
| Arroyo Dorado (punto 12) | media |
| Río Urión, del San Antonio al Canal Honda | media |
| Canal Honda, hasta el Paraná de las Palmas (punto 17) | alta |
| Canal del Este, desde el cruce con el Canal Honda (punto 1) hasta cerca del Arroyo Desaguadero | media |
| Ramal corto al Arroyo Sábalos | [a confirmar] |
| Ramal al Arroyo 25 de Noviembre, desde el Paraná de las Palmas | [a confirmar] |
| Arroyo Capitán / Arroyo Viejo, hasta el Destacamento Policía de Islas | alta |
| Río Capitán, hacia el Paraná de las Palmas (puntos 30 y 16) | media |
| Arroyo Antequera, hasta el Paraná de las Palmas (puntos 3 y 15) | alta |
| Arroyo Toro: dos tramos, el oeste y el que va al Río Capitán | media |
| Arroyo Espera, desde el Arroyo Cruz Colorada hasta el Arroyo Espera Grande (punto 10) y de ahí al Río Sarmiento | media |

**Para el juego:** el Arroyo Espera conecta con el ramal Cruz Colorada de Líneas Delta. Es el único lugar del mapa donde se tocan dos líneas fuera del Luján.

## Puntos de interés

El listado completo, con categoría y `px`, está en el JSON: 57 lugares numerados, 4 museos (A–D) y 5 servicios. Las categorías son las del folleto:

| Categoría | Números |
|---|---|
| Alojamiento | 1–7 |
| Complejos de cabañas | 8–12 |
| Restaurantes | 13–35 |
| Recreos y campings | 36–42 |
| Actividades (kayak, remo, paseos) | 43–51 |
| Atracciones en tierra firme (Nordelta, Benavídez, Dique Luján) | 52–57 |
| Museos | A Sarmiento · B Haroldo Conti · C Xul Solar · D Museo de Arte en el Delta Argentino |
| Servicios | Policía de Islas · SET (2 marcadores) · Información turística · Estación Fluvial |

**Sin marcador en la cara 1:** el 36 (Recreo Banco Provincia), el 52 (Ainda Mais Delta Tour) y la D (Museo de Arte en el Delta Argentino) figuran en el listado, pero no los encontré en el mapa. En el JSON quedan con `px: null`.

El folleto avisa que los lugares son «prestadores habilitados por el Municipio de Tigre». La lista cambia con cada edición, así que en el juego conviene mostrar el nombre con la fecha de la fuente.

## Pendiente para el juego

1. **Pasar cada tramo a ids de río del mundo** (`world.rivers`), usando los nombres de OSM y `scripts/osm/name-fixes.json`. Los tramos [a confirmar] no entran hasta tener una segunda fuente (regla de dos fuentes): la web de la empresa o un horario publicado.
2. **Ubicar cada punto de interés** en la orilla del río más cercano a su `px`, proyectado a mano sobre el tramo correspondiente.
3. **Las paradas reales** de cada línea no figuran en el mapa. Hay que sacarlas de los horarios de Líneas Delta (4749-0537), Jilguero (4749-0987) e Interisleña (4749-0900). Son los teléfonos públicos del folleto.
