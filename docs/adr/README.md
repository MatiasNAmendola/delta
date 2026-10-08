# Decisiones de arquitectura (ADR)

Cada ADR registra una decisión: el contexto, qué decidimos, qué otras opciones hubo y cómo sabemos si funcionó. Estados: **Propuesta**, **Aceptada**, **Implementada**, **Descartada**, **Reemplazada**.

| # | Decisión | Estado |
|---|---|---|
| [0001](0001-precalcular-el-mundo.md) | Precalcular el mundo en el build | Implementada |
| [0002](0002-grilla-espacial-vegetacion.md) | Árboles y pasto en una grilla espacial | Implementada en parte (ver 0011) |
| [0003](0003-impostores-arboles-lejanos.md) | Árboles lejanos como planos cruzados | Aceptada |
| [0004](0004-ajustes-render-mobile.md) | Ajustes de render para celulares | Aceptada |
| [0005](0005-gaussian-splatting.md) | Gaussian splatting para el mundo | Descartada (posible para piezas puntuales) |
| [0006](0006-vista-dron.md) | Vista de dron | Propuesta |
| [0007](0007-clubes-emblematicos.md) | Clubes y edificios emblemáticos (IA, fotogrametría) | Propuesta |
| [0008](0008-rio-y-clima-reales.md) | Altura del río y clima del día real | Propuesta |
| [0009](0009-corrientes-y-sudestada.md) | Corrientes, marea, olas y sudestada; flotabilidad | Implementada |
| [0010](0010-embarcaciones-y-regatas.md) | Lanchas particulares y regatas de remo | Implementada |
| [0011](0011-casas-muelles-y-streaming.md) | Casas, muelles particulares y dibujar solo lo cercano | Implementada |
| [0012](0012-fisica-de-la-estela.md) | Física de la estela (Kelvin, Froude, estela turbulenta) | Implementada |

## Cómo medimos

Todas las decisiones de rendimiento se miden con el panel `?perf=1` (FPS, p95 del tiempo de cuadro, triángulos, llamadas de dibujo, escala de render y el desglose de la carga), en 2–3 celulares reales: un Android con GPU Mali, uno con Adreno y un iPhone.

**Presupuesto** para un celular de gama media: menos de 2 s hasta poder jugar, p95 menor a 33 ms, menos de 300.000 triángulos, menos de 120 llamadas de dibujo.
