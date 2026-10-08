# 0017 · Origen del modelo de la lancha y qué se hace con `lancha.zip`

**Estado:** Aceptada · **Fecha:** 2026-10-08

## Contexto
El repo es público, tiene licencia Apache 2.0 y acepta contribuciones. Por eso tiene que quedar escrito de dónde sale el modelo 3D de la lancha colectiva, quién tiene los derechos y cómo se llegó a cada versión.

## Origen
1. **Modelo original.** Lo generó quien es titular del proyecto con [Tripo3D](https://www.tripo3d.ai/), pagando con créditos de la plataforma. Lo subió el 2026-04-08 en el commit `a1143ae` («Add files via upload», autoría de Matias Nahuel Améndola), como `public/models/lancha.zip`. El zip pesaba 13 MB y tenía un solo archivo, `lancha.glb`, de 34 MB.
2. **Derechos.** Según la ayuda de Tripo, quien paga tiene todos los derechos sobre los modelos que genera: usarlos, modificarlos, distribuirlos y explotarlos comercialmente ([can-i-use-models-commercially](https://www.tripo3d.ai/help/privacy-policy/can-i-use-models-commercially), consultado el 2026-10-08). Con el plan gratis, en cambio, los derechos se los queda Tripo. Que la generación fue paga lo declaró su titular el 2026-10-08. Lo que no está confirmado es si comprar créditos sueltos cuenta igual que una suscripción paga: para cerrarlo hay que leer los términos vigentes en https://www.tripo3d.ai/terms o el recibo de la compra.
3. **Todo lo que se hizo después lo hicieron agentes de IA**, por encargo y con revisión de su titular:
   - **Modelo del juego:** un agente de IA (Claude, sesión `session_01Aun4QtL47M7ToLZ6wU5LDW`, commit `28eea56`, 2026-04-09) lo simplificó con `gltf-transform`, de 1,4 M caras y 33 MB a unas 42 mil caras y 1,1 MB. El resultado es `public/models/lancha-optimized.glb`. En el mismo commit borró el zip. Después hubo una prueba con un modelo hecho en Blender (`6446bb6`), que se revirtió al de Tripo (`3bdb823`).
   - **Versión para imprimir en 3D:** agentes de IA la iteraron en `impresion-3d/`: techo y casco macizos, ventanas rehundidas, toldo reforzado, parabrisas cerrado, defensas y ajustes de laminado para la Bambu Lab P1S. Cada paso tiene su script en `impresion-3d/scripts/` y su informe en `impresion-3d/docs/`. La impresión física la validó su titular (`impresion-3d/docs/lancha-printed-finish.md`).

En resumen, la base es un modelo generado con IA y pagado por su titular, y todas las versiones derivadas son trabajo de agentes de IA. Ninguna parte del modelo la modeló a mano un tercero.

## Decisión sobre `lancha.zip`
**No se purga del historial.** Hoy el archivo no está en el repo, pero sigue en el historial (blob `8b31f6a`, 13 MB): cada `git clone` lo descarga.
- Purgarlo exige reescribir la historia y forzar el push de la rama publicada, y deja desfasados todos los clones: el de la nube, el de los agentes y los forks.
- Lo que se gana es poco: no es un secreto, el modelo es de su titular y no afecta al sitio publicado.

## Consecuencias
- `CREDITS.md` atribuye el modelo a Tripo3D, generado con créditos pagos por su titular, y remite a este ADR.
- Para reproducir el modelo original sin el zip: `git show 8b31f6a8f4c53116949a9f3a7194775a3d990d0c > lancha.zip`.
- Un modelo nuevo que alguien aporte tiene que traer su origen y su licencia (ver `CONTRIBUTING.md`).
