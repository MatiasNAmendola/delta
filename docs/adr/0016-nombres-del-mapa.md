# 0016 · Nombres y precisión del mapa

**Estado:** En curso · **Fecha:** 2026-10-08

## Contexto
El mapa sale solo de OpenStreetMap. El usuario detectó nombres mal y poca definición. La investigación [07](../investigacion/07-fuentes-del-mapa.md) relevó 44 fuentes y encontró lo siguiente:
- Solo el 43 % de las vías de agua de la Primera Sección tiene nombre en OSM.
- No figura el río Carapachay.
- Hay erratas claras: "Río URíon", "Panatanosito", "Arroyo Sin Nombre" como nombre.
- Hay grafías dudosas: Gelves/Gelvez, Felicaria/Felicarias, Arias/Arana, Estudiante/Estudiantes.

## Decisión
1. **Ya hecho:** `scripts/osm/name-fixes.json`, aplicado por el importador. Corrige solo erratas claras, con su fuente: Río Unión, Arroyo Pantanosito, Arroyo Paycarabí. Saca los nombres de relleno. Las grafías dudosas quedan como en OSM hasta que una fuente oficial decida.
2. **Siguiente:** una Action que cruza fuentes con licencia compatible:
   - "Cursos de agua" de la Provincia de Buenos Aires (CC BY 4.0);
   - IGN (licencia a confirmar por escrito);
   - GeoNames;
   - Wikidata.
   Los nombres se deciden por voto ponderado, con prioridad para las fuentes oficiales. Las demás fuentes votan pero no definen.
3. **Geometría y anchos:** máscara de agua de Sentinel-2 (NDWI, 10 m), filtrada por la altura del río ese día (INA), con transectos cada 50 m para medir el ancho real de cada arroyo. Eso activa la regla "no entra" de ADR 0015.
4. **Fuentes que no se pueden usar como datos:** Google, Bing, HERE, Apple y Navionics, por sus términos. Esri solo sirve para validar a ojo.
5. **Devolver a OSM:** cada corrección se reporta también al mapa abierto, con su fuente.
