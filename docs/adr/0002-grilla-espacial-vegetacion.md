# 0002 · Árboles y pasto en una grilla espacial

**Estado:** Aceptada · **Fecha:** 2026-10-08

## Contexto
Los árboles se dibujan con *thin instances*: una malla por especie, variante y nivel de detalle, con miles de copias. Babylon decide si dibujar una malla de thin instances como un bloque (el equipo de Babylon lo confirma en su foro): si una sola copia está a la vista, se dibujan todas, incluso las que quedan detrás de la cámara. Hoy se mitiga cargando solo los árboles cercanos a la cámara, pero los que están detrás igual se dibujan.

## Decisión
Partir el mundo en celdas de unas 64 unidades. Cada celda tiene su propia malla por especie y nivel de detalle, con su caja envolvente ajustada (`thinInstanceRefreshBoundingInfo`), así Babylon descarta las celdas fuera de cuadro. El pasto usa el mismo esquema.

## Alternativas
- **Descartar por copia en la CPU** (subir solo los árboles en cuadro): es exacto, pero hay que volver a subir los buffers cada vez que gira la cámara.
- **Occlusion culling:** el Delta es plano y casi nada tapa a nada; no compensa su costo en celulares.

## Cómo se mide
Triángulos y llamadas de dibujo con `?perf=1` en la vista de la estación de Tigre, mirando hacia el río y hacia la isla. Hay que ajustar el tamaño de celda: celdas chicas descartan mejor, pero suman llamadas de dibujo.
