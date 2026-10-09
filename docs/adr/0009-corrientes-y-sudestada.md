# 0009 · Corrientes y sudestada

**Estado:** Implementada (salvo flechas en el mapa) · **Fecha:** 2026-10-08

## Contexto
En el Delta la corriente cambia de sentido con la marea: con la creciente el agua sube por el Luján y el Tigre, con la vaciante baja hacia el Río de la Plata, y siempre se suma el caudal del Paraná. A una lancha colectiva casi no le cambia nada; a un kayak o un bote de travesía sí, porque remar contra la corriente cansa y cruzar un río ancho te deriva. La **sudestada** (viento fuerte del sudeste) frena el desagote: el agua sube rápido, la corriente se invierte y el viento levanta olas.

## Decisión
- **Campo de corriente:** cada río tiene una dirección a lo largo de su cauce, que sale de su línea central en el World Doc. La corriente en un punto es esa dirección por una velocidad. La velocidad depende de la fase de la marea (creciente o vaciante), es mayor en el centro del cauce que cerca de la costa y mayor en ríos angostos.
- **Efecto sobre el barco (revisado 2026-10-09, `src/boat/coasting.ts`):**
  - **La corriente mueve a todos los barcos.** La velocidad de cada barco respecto del suelo es su marcha en el agua más el movimiento del agua. Así, en punto muerto y hasta parado, el barco se va con la marea que sube o baja, como en la realidad.
  - **El peso pone la demora:** un casco pesado tarda en tomar la corriente, durante su `coastTime` (constante de tiempo). Esto reemplaza al `currentDrift` anterior, que arrastraba a la colectiva al 15 % y nunca la dejaba ir del todo con el agua.
  - **Inercia en neutro o al aflojar:** el barco conserva su arrancada, hacia adelante o hacia atrás. La resistencia del casco crece con la velocidad, así que la constante de tiempo es `coastTime · (0,15 + 0,85 · (1 − v/vmáx))`: a toda máquina pierde la mayor parte en un par de segundos y después sigue deslizándose despacio.
  - **Frenado fuerte:** solo cuando la palanca va contra la arrancada.
  - **Valores de juego `coastTime` (s):** colectiva 4 · bote de travesía 3,5 · single 4,5 · kayak 3 · lancha deportiva 2 · pesca 2,6 · clásica 2,8 · semirrígido 1,8 · moto de agua 1,2. Con eso, la colectiva a toda máquina se desliza unas 23 unidades (unos 180 m) y unos 20 s. **[sin fuente]:** son valores elegidos para que se jueguen bien, no medidos.
- **Picado corto que siente el casco (2026-10-09):** además de las olas largas del viento, la altura del agua tiene dos trenes cortos, de unos 8 m de largo. Uno va con el viento y el otro lo cruza para que el casco también rolee. Miden unos 4 cm con calma, 10 a 15 cm con brisa y 30 cm o más con viento fuerte. Así el barco cabecea, rolea y sube y baja aunque esté parado. El amortiguamiento del rolido subió de 0,45 a 0,7 para evitar la resonancia con ese picado.
  - **Ángulos medidos con la simulación:** con brisa, la colectiva rolea unos 4° y la lancha y el kayak unos 6°. Con viento fuerte, unos 9° y 14°.
  - **[sin fuente]:** son valores de juego, elegidos a ojo.
- **Sudestada:** un evento con viento del SE, nivel en subida, corriente río arriba, olas más altas en el shader del agua, cielo cubierto y aviso en el HUD. Ocurre al azar o con los datos reales (ADR 0008).
- **Visual:** la espuma y las ondas del agua se desplazan en el sentido de la corriente, y en el mapa se ven flechas que la indican.

## Cómo se prueba
Los tests verifican que la corriente sigue el cauce, cambia de sentido con la marea y es más débil cerca de la costa, y que un kayak se deriva más que una lancha.

## Cómo quedó (implementación)
- `src/world/waterConditions.ts` (puro, con tests): marea de 8 minutos de juego (±40 cm), corriente por río orientada aguas abajo hacia el SE que se invierte con la creciente y se apaga en la costa, olas de viento que crecen con el viento al cuadrado, estelas de Kelvin (cuña de 19,5°) de las lanchas que pasan, y la sudestada (sube el nivel ~80 cm, invierte la corriente, viento del SE, más niebla y agua picada).
- `src/boat/buoyancy.ts` (puro, con tests): la altura del agua se mide en proa, popa y ambas bandas; de ahí salen la altura, el cabeceo y el rolido, que el casco sigue con resortes amortiguados (los chicos reaccionan rápido, los grandes son pesados). Casco de desplazamiento: levanta apenas la proa y nunca "se clava" al acelerar (ese era el bug). Casco de planeo: sube la proa en el "escalón" (~35 % de la velocidad) y después planea, más alto y más plano; en las curvas se inclina hacia adentro.
- Todo lo que flota (agua, botes, remeros, tráfico, basura) sigue el nivel. La basura deriva con la corriente.
- `?clima=sudestada` la fuerza a los pocos segundos; `?clima=calma` la evita. Si no, 1 de cada 4 partidas tiene una.
