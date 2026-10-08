# 0007 · Clubes y edificios emblemáticos

**Estado:** Propuesta · **Fecha:** 2026-10-08

## Idea
Sumar de a poco los lugares que la gente reconoce en el Delta:
- los clubes de remo del Luján (Tigre Boat Club, Buenos Aires Rowing Club, Canottieri Italiani y otros),
- la Estación Fluvial,
- el Museo de Arte Tigre,
- el Puerto de Frutos.

Hoy los muelles y las casas son genéricos.

## Cómo se modela cada uno
De menos a más esfuerzo:

1. **Generación desde fotos con IA** (Tripo3D, Meshy, Rodin/Hyper3D, Luma Genie, CSM): con una o varias fotos sale un modelo con textura en minutos. Es lo más rápido, pero la geometría es aproximada y suele salir muy pesada: hay que simplificarla (`gltf-transform`), como se hizo con la lancha.
2. **Fotogrametría** (RealityScan, Polycam, Kiri Engine, Meshroom, que es libre): 50–200 fotos desde el río y la costa, o un video con dron. La forma queda fiel. Después se simplifica a menos de 30.000 triángulos y se hornean las texturas en un atlas.
3. **Gaussian splatting** de una pieza puntual (ver ADR 0005): fotorrealista, pero pesado y sin geometría para colisiones.
4. **Modelado procedural en Blender** por script (como el muelle): liviano y controlable, pero da menos parecido.

## Reglas para que entren en el juego
- Un GLB por edificio en `public/models/landmarks/`, ubicado en el World Doc con coordenadas reales (de OpenStreetMap) y su orientación.
- Presupuesto por pieza: menos de 30.000 triángulos, 1 o 2 materiales y texturas de 1024–2048 en KTX2. Además, una versión lejana o impostor (ADR 0003).
- Licencias:
  - Fotos propias o con permiso del club.
  - Respetar los términos de la herramienta: algunos planes gratuitos dan CC BY y exigen atribución.
  - Usar marcas y escudos de los clubes solo con permiso; si no, inventar uno.
- Créditos en `CREDITS.md`.

## Primer paso
Elegir 2 o 3 lugares y juntar fotos (propias o de la comunidad, con permiso). Probar una herramienta de IA contra fotogrametría con el mismo lugar.
