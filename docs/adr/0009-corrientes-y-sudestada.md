# 0009 · Corrientes y sudestada

**Estado:** Aceptada · **Fecha:** 2026-10-08

## Contexto
En el Delta la corriente cambia de sentido con la marea: con la creciente el agua sube por el Luján y el Tigre, con la vaciante baja hacia el Río de la Plata, y siempre se suma el caudal del Paraná. A una lancha colectiva casi no le cambia nada; a un kayak o un bote de travesía sí, porque remar contra la corriente cansa y cruzar un río ancho te deriva. La **sudestada** (viento fuerte del sudeste) frena el desagote: el agua sube rápido, la corriente se invierte y el viento levanta olas.

## Decisión
- **Campo de corriente:** cada río tiene una dirección a lo largo de su cauce, que sale de su línea central en el World Doc. La corriente en un punto es esa dirección por una velocidad. La velocidad depende de la fase de la marea (creciente o vaciante), es mayor en el centro del cauce que cerca de la costa y mayor en ríos angostos.
- **Efecto sobre el barco:** la corriente arrastra cada barco según su "agarre" (`currentGrip`): la lancha colectiva muy poco, la lancha open poco, el bote de travesía bastante y el kayak mucho. El viento suma deriva en botes y kayaks.
- **Sudestada:** un evento con viento del SE, nivel en subida, corriente río arriba, olas más altas en el shader del agua, cielo cubierto y aviso en el HUD. Ocurre al azar o con los datos reales (ADR 0008).
- **Visual:** la espuma y las ondas del agua se desplazan en el sentido de la corriente, y en el mapa se ven flechas que la indican.

## Cómo se prueba
Los tests verifican que la corriente sigue el cauce, cambia de sentido con la marea y es más débil cerca de la costa, y que un kayak se deriva más que una lancha.
