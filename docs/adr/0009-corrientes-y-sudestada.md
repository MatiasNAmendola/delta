# 0009 · Corrientes y sudestada

**Estado:** Implementada (salvo flechas en el mapa) · **Fecha:** 2026-10-08

## Contexto
En el Delta la corriente cambia de sentido con la marea: con la creciente el agua sube por el Luján y el Tigre, con la vaciante baja hacia el Río de la Plata, y siempre se suma el caudal del Paraná. A una lancha colectiva casi no le cambia nada; a un kayak o un bote de travesía sí, porque remar contra la corriente cansa y cruzar un río ancho te deriva. La **sudestada** (viento fuerte del sudeste) frena el desagote: el agua sube rápido, la corriente se invierte y el viento levanta olas.

## Decisión
- **Campo de corriente:** cada río tiene una dirección a lo largo de su cauce, que sale de su línea central en el World Doc. La corriente en un punto es esa dirección por una velocidad. La velocidad depende de la fase de la marea (creciente o vaciante), es mayor en el centro del cauce que cerca de la costa y mayor en ríos angostos.
- **Efecto sobre el barco:** la corriente arrastra cada barco según su `currentDrift`: la lancha colectiva muy poco, las lanchas particulares poco, el bote de travesía bastante y el kayak mucho. El viento suma deriva en botes y kayaks.
- **Sudestada:** un evento con viento del SE, nivel en subida, corriente río arriba, olas más altas en el shader del agua, cielo cubierto y aviso en el HUD. Ocurre al azar o con los datos reales (ADR 0008).
- **Visual:** la espuma y las ondas del agua se desplazan en el sentido de la corriente, y en el mapa se ven flechas que la indican.

## Cómo se prueba
Los tests verifican que la corriente sigue el cauce, cambia de sentido con la marea y es más débil cerca de la costa, y que un kayak se deriva más que una lancha.

## Cómo quedó (implementación)
- `src/world/waterConditions.ts` (puro, con tests): marea de 8 minutos de juego (±40 cm), corriente por río orientada aguas abajo hacia el SE que se invierte con la creciente y se apaga en la costa, olas de viento que crecen con el viento al cuadrado, estelas de Kelvin (cuña de 19,5°) de las lanchas que pasan, y la sudestada (sube el nivel ~80 cm, invierte la corriente, viento del SE, más niebla y agua picada).
- `src/boat/buoyancy.ts` (puro, con tests): la altura del agua se mide en proa, popa y ambas bandas; de ahí salen la altura, el cabeceo y el rolido, que el casco sigue con resortes amortiguados (los chicos reaccionan rápido, los grandes son pesados). Casco de desplazamiento: levanta apenas la proa y nunca "se clava" al acelerar (ese era el bug). Casco de planeo: sube la proa en el "escalón" (~35 % de la velocidad) y después planea, más alto y más plano; en las curvas se inclina hacia adentro.
- Todo lo que flota (agua, botes, remeros, tráfico, basura) sigue el nivel. La basura deriva con la corriente.
- `?clima=sudestada` la fuerza a los pocos segundos; `?clima=calma` la evita. Si no, 1 de cada 4 partidas tiene una.
