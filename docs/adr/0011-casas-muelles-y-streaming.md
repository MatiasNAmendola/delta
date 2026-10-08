# 0011 · Casas, muelles particulares y dibujar solo lo cercano

**Estado:** Implementada · **Fecha:** 2026-10-08

## Contexto
El Delta está habitado: casi todas las islas tienen casas mirando al río, cada una con su muelle. El juego tenía pocas cajas sueltas como casas, y el mapa de la Primera Sección solo tenía 16 muelles. Sumar miles de casas con la forma de dibujar de entonces era imposible: todo lo que había en el mapa (agua, suelo, barrancas, juncos, camalotes y muelles) se dibujaba siempre, aunque estuviera a 20 km, y eso sumaba 1,7 millones de triángulos por cuadro.

## Decisión
**Casas y muelles (`src/world/settlement/`).**
- `lots.ts` es puro y tiene tests. Recorre la costa y arma lotes cada 35–90 m, en tramos poblados y tramos agrestes según un ruido de gran escala. Cada lote cumple estas condiciones:
  - la casa y su jardín quedan sobre tierra firme, con isla detrás;
  - no queda frente a un muelle público ni cerca del borde del mundo;
  - el muelle nunca ocupa más de un cuarto del cauce;
  - en arroyos de menos de 24 m solo hay una escalera.
- Tipos de casa: palafito de madera sobre pilotes con galería y techo de chapa a dos aguas, casa isleña chica, casa de material sobre zócalo con techo de tejas, y alpina (techo en A hasta el piso, con el frente vidriado).
- Tipos de muelle: simple con escalera, con glorieta (el quincho sobre el agua), en T con bitas, pontón flotante con pasarela (sube y baja con la marea) y bajada de escalones.
- Resultado: unas 2800 casas en la Primera Sección y entre 1700 y 2000 en las otras zonas.

**Dibujar solo lo cercano.**
- `StreamedBatch` divide las instancias en celdas de 32 unidades y sube a la GPU solo las que están cerca de la cámara. Se actualiza cada 6 unidades que la cámara se mueve. Las casas usan dos distancias: 230 unidades para las paredes y los techos, y 75 unidades para los detalles (pilotes, barandas, ventanas).
- Las casas usan 5 llamadas de dibujo en todo el Delta. Los juncos y camalotes también se cargan solo cerca, y los muelles públicos de Blender solo dentro de 260 unidades.
- **Parcelas:** el agua y el suelo se cortan en parcelas de 2 km durante el build (`layout/chunking.ts`, ADR 0001). Cada triángulo se recorta con la grilla, porque earcut deja triángulos larguísimos que harían que cada parcela ocupe medio mapa. Las barrancas también van en parcelas. La cámara las descarta por el plano lejano, que se acercó de 800 a 420 unidades porque la niebla ya oculta todo pasado ~350.
- **Archivo del mundo:** las parcelas guardan referencias a los puntos de la costa en lugar de copiarlos. Solo los vértices de los cortes se guardan como coordenadas, y los triángulos van en planos de 16 bits. El archivo pasó de 2,17 MB a 2,51 MB con gzip (Primera Sección); a cambio el celular no recorta nada.
- **Espacios ocupados:** una grilla responde "¿hay algo acá?" para árboles, pasto, juncos y barrancas, en lugar de recorrer listas de casas y muelles.

## Mediciones (Primera Sección, misma vista)
| | Antes | Después |
|---|---|---|
| Triángulos | 1,7 M | ~0,55 M (con 2779 casas) |
| Barranca / suelo / agua | 417 k / 225 k / 225 k | ~10 k / ~6 k / ~5 k |
| Juncos + camalotes | 405 k | solo los cercanos |
| Llamadas de dibujo | 62 | 75–96 |
| Carga (entorno de prueba sin GPU) | 3,7 s | 3,6 s |

## Próximo
- Precalcular también las barrancas y los juncos en el build (hoy ~1 s de la carga).
- Árboles lejanos como planos cruzados (ADR 0003): los árboles son ahora la mayor parte de los triángulos.
- Muelles sólidos para las colisiones, lanchas amarradas en los muelles particulares, y clubes y recreos (ADR 0007).
- Ubicar las casas con los edificios reales de OpenStreetMap donde estén cargados.

## Agregado: fundido en vez de aparición brusca (2026-10-08)
`src/world/distanceFade.ts` es un plugin de material (Standard y PBR). Cerca del borde del radio de cada objeto que se carga por cercanía, descarta una parte creciente de sus píxeles con un tramado fino de pantalla (*interleaved gradient noise*). Así los objetos se disuelven en la niebla en lugar de aparecer o desaparecer de golpe.
- **Árboles:** se disuelven entre el 70 % del radio (170) y el radio menos un paso de recarga. Además, el árbol detallado y el simple se funden entre sí alrededor de 30 unidades: cada uno toma exactamente los píxeles que deja el otro.
- **Casas, detalles, juncos, camalotes y muelles públicos:** el mismo fundido en su radio.
- **Pasto:** ya se hundía suavemente.
