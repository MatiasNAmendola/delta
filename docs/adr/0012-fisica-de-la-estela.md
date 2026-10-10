# 0012 · Física de la estela

**Estado:** Implementada · **Fecha:** 2026-10-08

## Contexto
La estela anterior era decorativa y físicamente incorrecta:
- anillos que se expandían en círculo, que es lo que hace una piedra en el agua, no un barco;
- dos franjas de espuma en V con un ángulo fijo;
- bolas de partículas blancas.

En la realidad un barco deja dos cosas distintas:
- **olas**, el patrón de Kelvin;
- la **estela turbulenta**, el "hilo" blanco de la hélice y el casco.

Además, el patrón cambia mucho entre una lancha colectiva, una lancha que planea, una moto de agua y un kayak.

## Lo que dice la física
- **Kelvin (1887).** Un barco a velocidad constante en aguas profundas deja un patrón fijo respecto de él, dentro de una cuña de **19,47°** (arcsen 1/3) a cada lado.
  - Hay dos familias de olas: las **transversales**, perpendiculares al rumbo, y las **divergentes**, que salen en diagonal de los costados. Las dos se juntan en los bordes (**olas de cúspide**, las más altas).
  - Una ola que viaja con ángulo θ respecto del rumbo tiene número de onda k = k₀/cos²θ, con k₀ = g/U². Su longitud de onda es λ = 2πU²/g·cos²θ: así acompaña al barco. Las transversales son las más largas (2πU²/g).
- **Rabaud y Moisy (2013), Darmon, Benzaquen y Raphaël (2014).** Un casco de largo L no puede generar olas mucho más largas que él.
  - Por encima de Froude Fr = U/√(gL) ≈ 0,5, las transversales y las de cúspide se apagan.
  - Las olas más fuertes quedan en un ángulo que se cierra como **1/Fr**, aunque el borde exterior siga en 19,47°.
  - Por eso una lancha rápida o una moto de agua dejan una V angosta, y la colectiva la V abierta.
- **Lanchas de planeo.** La ola más grande se forma en la transición al planeo (el "escalón", Fr ≈ 0,5). Ya planeando la ola baja, y las transversales bajan con la velocidad (Tavakoli y otros, 2022, sobre ensayos en canal). Otras fuentes de la industria lo describen de manera anecdótica.
- **Estela turbulenta.**
  - Es espuma y burbujas de la hélice y el casco, del ancho de la manga al principio, y se ensancha lento, como t^0,4 (Kapustin y otros).
  - Dura minutos y deja una franja más lisa (los surfactantes que suben las burbujas amortiguan las olas cortas). Por eso las estelas se ven desde satélites.
  - Un kayak o un bote a remo no la tienen: dejan un remolino en cada palada.

## Decisión
- **`src/world/wakePhysics.ts`** (puro, con tests): elevación de Kelvin por fase estacionaria.
  - Calcula las dos ramas por punto, con el factor de cúspide (Airy, acotado), decaimiento 1/√r y un **filtro de casco**. El filtro corta las olas mucho más largas que el casco (pasa-altos, la explicación de Rabaud y Moisy) y las mucho más cortas que la manga (pasa-bajos).
  - Tiene además el crecimiento de la ola con el Froude según el tipo de casco y el ancho de la estela turbulenta.
  - Los tests verifican cinco cosas:
    - 19,47° para barcos lentos;
    - el ángulo de las olas más fuertes se cierra a la mitad cuando Fr se duplica;
    - λ transversal = 2πU²/g;
    - agua calma delante de la proa y fuera de la cuña;
    - la ola máxima de planeo en el escalón.
- **`src/world/WakeRibbon.ts`**: una cinta que sigue la trayectoria real de la proa, ancha como la cuña de Kelvin. Su shader evalúa la misma ecuación en cada píxel. A eso se suman:
  - la espuma de la hélice (que se ensancha y pasa a mancha lisa);
  - los "bigotes" de la ola de proa;
  - crestas que rompen en estelas grandes;
  - remolinos de pala (kayak, alternados) y de remos (a ambos lados).
  - Las olas que el píxel no puede mostrar se atenúan, para evitar el centelleo.
- **Velocidad real.** Cada embarcación tiene su velocidad real máxima (`realSpeed`: colectiva 5,1 m/s, kayak 2,2, lancha de paseo 15, moto 22) y su propulsión. En el juego los barcos van mucho más rápido que en la realidad, así que la longitud de onda, el Froude y la "edad" de la espuma se calculan con la velocidad real, no con la del juego.
- **Tráfico y balanceo.** Las lanchas del tráfico dibujan la misma estela, y te mueven con la misma función (`waterConditions.wakeHeight`).
- **Lo que se sacó:** los anillos, las franjas en V, el disco de proa y la espuma plana de partículas. Las partículas que quedan son chicas: el agitado de la hélice y el rocío de las lanchas de planeo.

## Resultado (Froude a la velocidad máxima)
| Embarcación | Fr | Estela |
|---|---|---|
| Kayak | 0,3 | V de Kelvin de 2–4 cm y remolinos de pala |
| Lancha colectiva | 0,4 | V de Kelvin completa, cúspides marcadas, espuma de hélice |
| Lancha de paseo, en el escalón | 0,8 | La ola más grande, V todavía abierta |
| Lancha de paseo, planeando | 2 | V angosta (~7°) y franja blanca |
| Moto de agua | 4 | V muy angosta (~3,5°) y la franja ancha del chorro |

## Fuentes
- [Rabaud y Moisy, "Ship wakes: Kelvin or Mach angle?", PRL 110, 214503 (2013), arXiv:1304.2653](https://arxiv.org/pdf/1304.2653)
- [Darmon, Benzaquen y Raphaël, "Kelvin wake pattern at large Froude numbers", J. Fluid Mech. 738, R3 (2014)](https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/kelvin-wake-pattern-at-large-froude-numbers/6F9009238F6CA9E1221B0636B987361A)
- [Physics World: "Physicists rethink celebrated Kelvin wake pattern for ships"](https://physicsworld.com/a/physicists-rethink-celebrated-kelvin-wake-pattern-for-ships/)
- [WikiWaves: Ship Kelvin Wake (λ(θ) = 2πU²cos²θ/g)](https://wikiwaves.org/Ship_Kelvin_Wake)
- [Kelvin-Froude wake patterns of a traveling pressure disturbance (arXiv:1902.01884)](https://arxiv.org/pdf/1902.01884)
- [The Kelvin wake pattern (scipython)](https://scipython.com/blog/the-kelvin-wake-pattern/)
- [Wake waves of a planing boat: an experimental model (Aalto)](https://aaltodoc.aalto.fi/items/e14c17c5-8823-418e-8adc-a3182387cef8)
- [Wake shapes behind planing hull forms (Savitsky, TRB)](https://trid.trb.org/View/402408)
- [Kapustin y otros, ancho de la estela turbulenta ∝ t^0,4 (EGU 2010)](https://meetingorganizer.copernicus.org/EGU2010/EGU2010-387.pdf)
- [Structure and persistence of ship wakes (arXiv:1807.00441)](https://arxiv.org/pdf/1807.00441)

## Agregado (2026-10-08, v2): estela irregular y rebote en la costa
Base: [docs/investigacion/04-olas-estelas-y-costas.md](../investigacion/04-olas-estelas-y-costas.md), revisado por un juez.
- **Irregularidad:** las estelas reales no son un patrón perfecto.
  - Hay grupos de olas a lo largo del tren: 4 a 40 olas, de 6 a 40 s, con la mayor entre las primeras 1 a 3 (Bhowmik, USGS 92-S013).
  - El shader modula la amplitud por grupos (0,65–1,35), cada brazo de la V distinto, y deja que la fase varíe (±0,8 rad).
- **Rebote en la costa (método de la imagen):**
  - La ola reflejada es la estela evaluada en el punto espejado del otro lado de la orilla, multiplicada por el coeficiente de reflexión Kr de ese tramo.
  - **Tablestacado de madera:** Kr = 0,9 (rango 0,8–0,95; pared vertical ≈ 0,9 según Allsop).
  - **Barranca natural de barro con juncos:** Kr = 0,15 (estimado; dentro del rango 0,05–0,3).
  - La ola que llega más la que vuelve forman el clapotis frente a los tablestacados.
  - El mapa de Kr se pinta con los mismos tramos que dibuja `RiverBanks`, así que lo que ves es lo que refleja.
  - Se calcula hasta ~16 m de la orilla, que es el alcance de la textura de distancia a la costa.
- **El bote lo siente:** `waterConditions.height` suma la reflexión de las estelas del tráfico con la misma regla (función `wall` en `GameEngine.connectShoreReflections`).
- **Pendiente:** reflexiones múltiples en canales angostos (Kr^n) y rotura de la ola en la barranca (espuma).

## La V no se veía en el celular (2026-10-10)
- **Síntoma:** la dueña lo vio en el celular. Detrás de la lancha solo se veía la espuma; la V de Kelvin no aparecía.
- **Causa:** las olas tienen su altura física, unos 35 cm para la colectiva, y con esa altura inclinan el agua apenas unos grados. El shader ilumina cada cara según esa inclinación, así que desde la cámara de seguimiento de un celular las crestas y los valles quedaban casi del mismo color que el agua plana.
- **Lo que se descartó antes:**
  - los reflejos de árboles del agua: con el shader anterior tampoco se veía;
  - subir solo la transparencia: el ribbon seguía pintado con el color del agua.
- **Arreglo:** `WAKE_VISUAL_SLOPE_GAIN = 6` en `wakePhysics.ts`. Es solo visual: el shader de la estela ilumina las olas como si su pendiente fuera 6 veces mayor, y la transparencia sale de esa pendiente iluminada. Las alturas, el bamboleo de los barcos y la regla "sin ola" (0,25 m) siguen usando los valores físicos.
- **Estado:** verificado con una captura en un celular emulado de 844×390, con la colectiva al 100 %.
- **[sin fuente]:** el factor 6 se eligió a ojo.
- **Ajuste (2026-10-10): a toda máquina quedaba rara.** Con una lancha planeando, las pendientes ya son grandes, y multiplicadas por 6 se volvían bandas lisas y brillantes, como de plástico. El refuerzo ahora tiene un **límite suave**, `sv = s·g / (1 + s·g/0,36)`: las olas chicas reciben todo el refuerzo y las grandes se nivelan cerca de los 20° de inclinación. La transparencia sale de esa pendiente limitada, con un máximo de 0,7. Verificado con capturas en un celular emulado, con la colectiva y la lancha particular al 100 %.
