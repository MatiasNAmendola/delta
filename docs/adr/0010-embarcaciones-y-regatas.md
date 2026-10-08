# 0010 · Lanchas particulares y regatas de remo

**Estado:** Implementada · **Fecha:** 2026-10-08

## Contexto
"Lancha open" no describía lo que se ve en el Delta: hay varios tipos de lanchas particulares, cada una con su casco, su motor y su forma de navegar. Además los clubes de remo del Luján y el Tigre corren regatas desde 1873 y eso no estaba en el juego.

## Decisión
**Familias en el menú.** Las embarcaciones se agrupan en cuatro solapas: Lancha colectiva, Remo de club, Kayak y Lancha particular. Las solapas con familia muestran chips para elegir la variante.

| Tipo | Casco | Motor | Cómo navega | Modo |
|---|---|---|---|---|
| Lancha de paseo (runabout, bowrider) | Fibra en V, de planeo | Fuera de borda | Rápida, sube al planeo, se inclina en las curvas | Contrarreloj |
| Bote de pesca | Aluminio, desplazamiento | Fuera de borda chico | Lenta, ágil, cala poco | Exploración de arroyos |
| Lancha clásica de madera (estilo Riva) | Caoba barnizada, de planeo | Dentro de borda | Pesada, gira abierto, ola grande | Contrarreloj |
| Semirrígido (gomón) | Tubos y fibra | Fuera de borda | Acelera y gira mejor que todas | Contrarreloj |
| Moto de agua | Planeo | Turbina | La más rápida; sin acelerar casi no dobla | Contrarreloj |
| Single de regata (1x) | Casco aguja | Remo | Muy rápido para remo, gira muy poco, se cansa | Regata |

`?boat=open` sigue funcionando y abre la lancha de paseo.

**Regatas.** `src/game/regattaCourse.ts` busca un tramo de 2000 m (o 1000 m si no hay lugar) en un río ancho, el Luján primero, poco curvo y con los cuatro andariveles de 13,5 m sobre agua. La regata se corre aguas abajo, como en el Luján desde 1924. El largador dice "¡Atención!" y después de un tiempo al azar "¡Ya!": remar antes es largada falsa (la segunda resta puntos). Hay tres rivales de clubes del Tigre, uno siempre bueno, con salida rápida, ritmo parejo y sprint final; también los arrastra la corriente. Salirse del andarivel resta puntos. Se gana por puesto: 500, 300, 180 y 100 puntos.

## Fuentes
- Licencias de Prefectura (Conductor Náutico hasta 7 m y 140 HP): argentina.gob.ar.
- Disposición PZDE RI.7 Nº 02/2015 (velocidad reducida en la 1ª Sección de Islas).
- Historia de las regatas del Luján: barcosmagazine.com, tigre.gob.ar/tigre/remo.
- Formato de regata (andariveles de 13,5 m, 2000 m, "Attention… Go"): reglamento de World Rowing.

Las medidas y velocidades de cada lancha son estimadas para el juego, no datos de fábrica.

## Próximo
- Modelos GLB de cada lancha (Tripo3D o Blender) que reemplacen a los procedurales.
- Regatas de botes de varios remeros (2x, 4x, 8+) y el Festival de Ochos nocturno.
- Lanchas almaceneras y catamaranes como tráfico.
