# 0003 · Árboles lejanos como planos cruzados

**Estado:** Aceptada · **Fecha:** 2026-10-08

## Contexto
Un árbol a más de 30 unidades ocupa unos pocos píxeles, pero su versión lejana todavía usa 120–280 triángulos. La guía de ARM para GPUs Mali recomienda que cada triángulo cubra más de 10 píxeles. La vista más cargada dibuja unos 770.000 triángulos, y el presupuesto es 300.000.

## Decisión
Más allá de cierta distancia, cada árbol se dibuja como dos planos cruzados (4 triángulos) con una textura de su especie generada al arrancar (o en el build), renderizando el árbol de costado. La transición se suaviza con un *dither* según la distancia, para que no se note el salto.

## Alternativas
- **Impostores octaédricos** (una imagen del árbol desde muchos ángulos): se ven mejor desde arriba, pero no hay implementación lista en Babylon. Quedan como fase 2, sobre todo para la vista de dron (ADR 0006).
- **Bajar la distancia de dibujo o subir la niebla:** es lo más simple, pero vacía el horizonte.

## Resultado esperado
Pasar de unos 770.000 a 250.000–350.000 triángulos en la vista más cargada. Es una estimación: se confirma midiendo.
