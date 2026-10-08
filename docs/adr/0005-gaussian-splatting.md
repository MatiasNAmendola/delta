# 0005 · Gaussian splatting para el mundo

**Estado:** Descartada para el mundo · posible para piezas puntuales · **Fecha:** 2026-10-08

## Contexto
Se propuso reemplazar los polígonos por *Gaussian splatting* (3DGS): la escena se representa con millones de "manchas" 3D capturadas de fotos o video, y se ve fotorrealista. Babylon.js lo soporta (`GaussianSplattingMesh`).

## Por qué no para el mundo
- **De dónde sale:** un splat se *captura* filmando un lugar real (por ejemplo con un dron) y procesándolo. Nuestro mundo son 22 km de Delta generados desde OpenStreetMap. Habría que filmar todo el recorrido, o generar splats sintéticos, que es un problema de investigación.
- **Tamaño:** una escena de unos cientos de metros pesa entre decenas y cientos de MB, incluso comprimida. Hoy todo el mundo pesa 1,7 MB.
- **Rendimiento en celulares:** hay que ordenar millones de splats por distancia en cada cuadro y dibujarlos con transparencia. Es justo lo que peor rinde en GPUs de celular: mucho sobredibujado, sin descarte temprano de lo que queda tapado.
- **Juego:** los splats no tienen superficie. Las colisiones, el agua animada, la estela, la iluminación del día y la vegetación al viento necesitan geometría o shaders aparte igual.
- **Edición:** no se pueden cambiar con código, mientras que nuestro mundo se regenera cuando cambia el mapa.

## Dónde sí puede servir
Como **pieza puntual capturada**, mezclada con el mundo poligonal:
- la Estación Fluvial de Tigre,
- un muelle emblemático,
- el Museo de Arte Tigre visto desde el río,
- una pantalla de inicio fotorrealista.

Habría que filmar el lugar, entrenar el splat (por ejemplo con Postshot, Luma o Polycam) y cargarlo con `GaussianSplattingMesh`, limitado a unos 300.000–500.000 splats, solo cuando estás cerca, y probándolo antes en celulares.

## Revisar si
WebGPU se generaliza en celulares (permite ordenar los splats en la GPU) y aparecen formatos comprimidos maduros (como SPZ) con soporte en Babylon.
