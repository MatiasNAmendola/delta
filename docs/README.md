# Documentación de Delta

Todo lo que investigamos y decidimos queda acá, para calibrar el juego sin volver a investigar cada vez.

| Carpeta | Qué hay |
|---|---|
| [producto/](producto/PRD.md) | Visión, público y requisitos del producto (PRD) |
| [investigacion/](investigacion/README.md) | Investigaciones con fuentes y datos: embarcaciones de Tigre, maniobra y controles, reglas de navegación, olas y costas, APIs. Cada una revisada por un "juez" independiente |
| [adr/](adr/README.md) | Decisiones de arquitectura y de física del juego, con mediciones |

**Cómo se trabaja:**
1. Cada tema nuevo se investiga con fuentes. Cada dato lleva una marca: `[confirmado: url]`, `[estimado]` o `[no verificado]`.
2. Un segundo modelo, el juez, revisa la investigación, corrige y deja asentado qué validó.
3. La implementación cita el documento y el valor que usa, como constante ajustable.
4. Si un dato cambia, se actualiza el documento y la constante. El código y la documentación no se contradicen.
