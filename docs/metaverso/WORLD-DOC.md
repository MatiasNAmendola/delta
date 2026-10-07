# World Doc (v0.1)

Formato declarativo del mundo. Es el punto de partida del World DSL del
[plan de MVP](./PLAN-MVP.md): todo lo que define un mundo vive en un documento JSON, y el runtime solo
lo interpreta. No depende del motor: si mañana se cambia Babylon por otro renderer, el documento sigue
sirviendo.

| Archivo | Qué es |
|---|---|
| `src/world/schema/world.schema.json` | Contrato público (JSON Schema 2020-12). Lo pueden usar editores, agentes de IA y validadores externos |
| `src/world/data/delta.world.json` | El mundo actual del juego: Delta de Tigre |
| `src/world/WorldDoc.ts` | Tipos TypeScript + validador en runtime, sin dependencias del motor |
| `src/world/loadWorld.ts` | Carga y valida el mundo al arrancar |
| `tests/world.test.ts` | El mundo cumple el esquema; el esquema y el validador coinciden; se rechazan documentos rotos |

## Qué contiene

- `world`: id, nombre, tamaño (mundo cuadrado, origen en el centro).
- `rules`: duración de la partida, capacidad de la lancha, radio de parada, puntajes.
- `spawn`: muelle de salida (por `id`) y desplazamiento.
- `rivers`: polilíneas `[x, z]` con ancho.
- `docks`: muelles con posición y rotación en grados.
- `scatter`: reglas de distribución procedural determinista (árboles, casas). Misma semilla = mismo mundo.

Además de lo que expresa el JSON Schema, el validador en runtime chequea referencias cruzadas: ids
únicos, que el muelle de salida exista y que todo quede dentro de los límites del mundo.

## Qué quedó fuera (a propósito)

Los parámetros del motor siguen en `src/utils/constants.ts`: física de la lancha, cámara, nivel del
agua y colores. No describen *qué* hay en el mundo sino *cómo* se ve y se siente; en la fase 1 se
decide cuáles pasan a componentes del documento.

## Cómo editar el mundo

1. Editá `src/world/data/delta.world.json` (VS Code autocompleta y valida gracias a `$schema`).
2. `npm test` valida el documento.
3. `npm run dev` para verlo.
