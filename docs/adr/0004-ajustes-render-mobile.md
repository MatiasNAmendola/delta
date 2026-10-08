# 0004 · Ajustes de render para celulares

**Estado:** Aceptada · **Fecha:** 2026-10-08

## Decisión
- **Congelar lo estático:** `freezeWorldMatrix()` y `material.freeze()` en el agua, el suelo, las barrancas, los muelles y las casas. Además, `scene.skipPointerMovePicking = true`, porque no usamos picking con el mouse.
- **Prioridad de rendimiento `Intermediate`:** `Aggressive` no, porque rompe las mallas que se actualizan, como los árboles que se cargan alrededor de la cámara.
- **`mediump`** en los shaders del agua y del pasto, salvo en las cuentas con coordenadas grandes del mundo, que necesitan `highp`.
- **Resolución adaptativa** con piso (escala mínima 0,5) e histéresis.
- **Modo 30 fps** opcional, para ahorrar batería y temperatura.

## Por qué
Son cambios chicos y de bajo riesgo. Lo de `mediump` y la resolución ayuda en GPUs que limitan por píxeles, el caso típico de celulares con pantallas densas.

## Cómo se mide
FPS y p95 con `?perf=1`, y además el FPS después de 15 minutos de juego, para ver el efecto del calor.
