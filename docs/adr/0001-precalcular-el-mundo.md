# 0001 · Precalcular el mundo en el build

**Estado:** Implementada · **Fecha:** 2026-10-08

## Contexto
En cada arranque el celular recalculaba, a partir del World Doc, la grilla de agua navegable, las costas (marching squares, suavizado, irregularidad), las triangulaciones del agua y de las islas, el índice exacto de la costa, dos texturas de distancia a la costa y el splatmap del suelo. Nada de eso cambia entre partidas. En el entorno de pruebas (solo CPU) sumaba unos 2,6 s de una carga de 5,4 s; en un celular de gama media se estimaban 3–8 s.

## Decisión
- El cálculo vive en código puro, sin Babylon (`src/world/layout/worldLayout.ts`), que corre igual en Node y en el navegador.
- `npm run bake` (`scripts/bake/bakeWorlds.ts`) lo ejecuta para cada mundo y escribe `public/worlds/<id>.layout.bin` comprimido con gzip. Lo corren `npm run build` y `npm run dev`, así que el deploy siempre lo regenera; no se versiona en git.
- El juego lo descarga y lo descomprime con `DecompressionStream`, sin librerías. Valida `LAYOUT_VERSION` y un hash del World Doc: si no coinciden, o si el archivo falta, lo calcula en un **Web Worker** para no trabar la pantalla de carga. `?bake=0` fuerza ese camino.
- **Formato:** un solo arreglo de puntos de costa, cuantizados a 1/256 de unidad (3 cm) y guardados como diferencias; el agua y las islas solo guardan índices a esos puntos (también como diferencias); las texturas son R8. Los puntos se cuantizan *antes* de construir todo, así el resultado es idéntico bit a bit precalculado o no (hay un test que lo verifica).

## Alternativas
- **glTF + meshopt / KTX2:** estándar y con buen soporte, pero agrega dependencias y un paso de conversión para datos que no son modelos. Se puede adoptar más adelante si el tamaño lo pide.
- **Solo Web Worker:** no traba la pantalla, pero el celular sigue pagando el cálculo completo en cada arranque.
- **Dividir el mundo en tiles cargados por zona:** innecesario hoy, porque 2800² unidades entran en memoria; se reconsidera si crece el mapa.

## Resultado
- Archivo del Delta real: 1,72 MB con gzip (4,85 MB con floats sin cuantizar).
- Carga en el entorno de pruebas: 5,4 s → 2,8 s. El mundo pasó de 2,6 s a 120 ms.
- **Pendiente:** las barrancas (0,8 s) y la ubicación de casas y árboles todavía se calculan en el celular. Se precalculan en una segunda etapa.

## Riesgos
Que el algoritmo cambie y no se suba `LAYOUT_VERSION`: el hash del World Doc no lo detecta. Se mitiga con el test de ida y vuelta y la regla de subir la versión al tocar `worldLayout.ts`.
