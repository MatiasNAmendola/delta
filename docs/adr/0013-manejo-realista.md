# 0013 · Manejo realista (optativo)

**Estado:** Implementada (primera versión) · **Fecha:** 2026-10-08

## Contexto
Los controles clásicos (palanca que queda, timón progresivo) son buenos para empezar. Pero cada embarcación del Delta se maneja distinto, y quien sabe navegar lo nota. El pedido fue sumar modos realistas sin sacar los clásicos. La base es [docs/investigacion/02-maniobra-y-controles.md](../investigacion/02-maniobra-y-controles.md), revisado por un juez.

## Decisión
Un selector **Manejo: Clásico / Realista** en el menú. Se guarda entre visitas, y también se puede pasar como `?manejo=realista`. En Realista, `src/boat/handling.ts` (puro, con tests) reemplaza la física simple:

| Embarcación | Mando | Física |
|---|---|---|
| Colectiva, lancha clásica (intraborda) | Rueda de timón: gira de a poco, ~3 s de tope a tope, y queda donde la dejás. Palanca de mando con 5 posiciones: Atrás toda, Atrás, Neutro, Avante, Avante toda | Pausa en neutro al invertir (1,6 s, dentro del rango estimado de 1–3 s). Diésel que acelera lento. Timón que solo gobierna con agua corriendo (arrancada o chorro de la hélice). Efecto evolutivo de la hélice en marcha atrás: popa a babor, proa a estribor, con hélice de paso derecho |
| Lancha de paseo, semirrígido (fuera de borda) | Volante y palanca única con tramo de ralentí | El motor gobierna con su empuje; pausa de neutro corta |
| Bote de pesca | **Caña del timón invertida**: caña a babor, proa a estribor | Muy ágil |
| Moto de agua | Gatillo de gas y freno/reversa mantenidos, manubrio | Sin gas casi no dobla, con un gobierno mínimo sin acelerador (OTAS) |
| Kayak | Palada por lado (Q/E o ◀ ▶), palada atrás (A/D) | Impulso por palada y deriva. Alternar va derecho; el mismo lado gira hacia el otro (~18° desde quieto, ~8° andando). Cadencia de crucero ~60/min |
| Single | Palada con ritmo, presión en un remo para girar, ciar | Palada apurada = palada débil (recuperación mínima a 36 paladas/min). Mucho deslizamiento |
| Bote de travesía (4+) | Sos el timonel: ritmo de boga (W/S) y timón | La tripulación rema sola a 16–30 paladas/min; abajo de cero, "¡ciar!". El timón solo gobierna andando |

- **Controles:** en el celular quedan los mismos 4 botones, con otro rótulo según la embarcación. En el teclado no se usan combinaciones con Ctrl ni Alt, porque cierran pestañas (observación del juez).
- **Pantalla:** el indicador muestra la posición del telégrafo, "Neutro…" durante la pausa, el porcentaje de la palanca o las paladas por minuto.

## Pendiente
- Indicador visual de la rueda o la caña.
- Viento lateral sobre la obra muerta.
- Modo "asistido" intermedio con el timón que vuelve al centro.
- Un multiplicador global de inercia, como sugiere el juez.
- Calibrar con lancheros y remeros (pendientes del doc 02).

## Agregado: esquemas de control (2026-10-08)
En **Ajustes** del menú, separado del manejo y guardado entre visitas:
- **Botones:** ▲▼ mueven la palanca un punto y ◀▶ el timón (lo que había).
- **Flechas:** el clásico de juego; mantenés ▲ para avanzar y al soltar frena.
- **Palanca y timón:** en pantalla, una **palanca de mando** vertical que se arrastra (arriba avante, abajo atrás, con tope en neutro; queda donde la dejás y muestra velocidad y límite) y una **rueda de timón** que se gira con el dedo. Con el manejo realista de la colectiva o la clásica, la palanca se encastra en las 5 posiciones del telégrafo y la rueda queda donde la dejás. Kayak y single siguen con botones, porque se reman.
- **Ruedita:** un joystick en pantalla, abajo a la izquierda, para manejar con un solo pulgar (base de unos 130 px, pomo que no sale del círculo, zona muerta de 0,12). El eje vertical fija el acelerador (arriba avante, abajo atrás) y el horizontal es el timón, "girar mientras empujás". Al soltar, **el timón vuelve a cero pero el acelerador queda donde estaba**: es la misma convención de la palanca del juego, que queda donde la dejás, y así no hace falta mantener el dedo apretado para navegar. Un anillo fino marca la posición actual del acelerador, mueva quien lo mueva (el joystick, el teclado o PARADA, que lo lleva a neutro). Con el manejo realista de la colectiva, al soltar el acelerador se acomoda en una de las 5 posiciones del telégrafo. Kayak y single siguen con botones. La lógica (zona muerta, recorte, telégrafo, soltar) es pura y está en `src/controls/joystick.ts`, con tests. En pantallas táctiles el esquema se elige en la pantalla de inicio, antes de «Zarpar»; en escritorio sigue en Ajustes.
- **Nombres técnicos:**
  - **palanca de mando**: en inglés *single lever control* / *throttle and shift*; en las lanchas grandes, *telégrafo de máquinas*;
  - **marcha avante / punto muerto (neutro) / marcha atrás**;
  - **rueda de timón** o **caña del timón**.

## Agregado: tres esquemas y controles de remo en pantalla (2026-10-10)
Pedido de la dueña: menos opciones para las lanchas, una Ruedita más linda y que el kayak y el single **se remen** con el dedo, no con botones.

**Tres esquemas para las lanchas** (chips de «Controles» en la pantalla de inicio en el celular; en escritorio, en Ajustes):
- **Flechas:** se unen los viejos «Botones» y «Flechas» en uno, con el comportamiento de Botones: ▲▼ mueven la palanca un punto por toque o suave si los mantenés, y queda donde la dejás; ◀▶ el timón. Se sacó el "mantené para avanzar", que contradecía la palanca que queda. Los valores guardados `botones` y `flechas` de `delta.controles` se leen como `flechas` (`parseScheme` en `src/controls/controlScheme.ts`, con test).
- **Ruedita:** la misma lógica (`joystick.ts`, incluida la compuerta que solo toma el acelerador con un movimiento claro arriba/abajo), con otro aspecto: base oscura translúcida con un aro cian que brilla, pomo grande verde agua translúcido (45 % del diámetro) con borde cian que sigue al pulgar, y el anillo fino ámbar que marca el acelerador. Base de 140 px (118 px con alto ≤ 420 px). Se lee bien sobre el río marrón y las orillas verdes porque el contraste lo da el brillo, no el color de fondo.
- **Timón:** lo que era «Palanca y timón» (rueda de timón y palanca de mando). El id interno sigue siendo `palanca` para no migrar nada.

**Remo en pantalla (táctil), automático para el kayak y el single**, sea cual sea el chip (la fila de Controles dice «Kayak: pala» o «Remo: remos y carro»). El bote de travesía sigue con sus controles de timonel.
- **Pala (kayak):** una pala doble dibujada a lo ancho, abajo. Bajar la punta izquierda es una palada a la izquierda; la derecha, a la derecha; subir una punta es una palada atrás de ese lado (frena, va para atrás y gira). La pala se inclina siguiendo los dedos. Alternando vas derecho; del mismo lado girás.
- **Remos y carro (single):** un mango de remo por pulgar en las esquinas de abajo. Una palada es llevar los dos hacia vos (abajo); si tirás más de uno, girás (el izquierdo más fuerte lleva la proa a estribor, como en el kayak); los dos para arriba es ciar; uno rema y el otro cía, gira en el lugar. Entre los dos, el **carro** (asiento corredizo) va hacia la proa durante la palada y vuelve en la recuperación, en el tiempo que deja un buen ritmo; si arrancás la palada antes de que vuelva, se pone ámbar («¡apurado!») y el modelo la hace débil, como ya hacía.
- **Fuerza:** largo × velocidad del arrastre (recortado a 0..1); menos de 0,18 del recorrido no es palada. Se puede remar sin levantar el dedo: volver para atrás termina la palada (recuperación) y volver a bajar empieza otra.
- **Cómo llega al modelo:** la lógica es pura (`src/controls/rowingGestures.ts`, con tests) y produce las mismas órdenes que el teclado (`strokeLeft/Right`, `backLeft/Right`, `pressure`) más un campo nuevo `strength` en `HandlingInput` (por defecto 1, así el teclado no cambia). Las paladas esperan al barco por cantidad (como mucho 2 pendientes), no por tiempo, para que un cuadro lento no se coma una palada.
- **Por qué el kayak y el single usan el modelo de paladas también en Clásico (en el celular):** la pala y los remos son paladas, y el modelo clásico es un acelerador. Traducir paladas a impulsos del acelerador clásico habría sido inventar una segunda física del remo. Lo más limpio fue crear el `Handling` de esos dos barcos cuando hay pantalla táctil; las reglas siguen siendo las del modo elegido (`strict` solo en Realista). En escritorio nada cambia: Clásico sigue con el acelerador y Realista con las teclas de siempre, que también suman en el celular.
- **Arreglo de paso:** el single en reposo, antes de su primera palada, ahora tiene esfuerzo 0. Antes valía 0,2 y la regata lo tomaba como largada falsa apenas se usaba el modelo de paladas.
- **Widgets:** `src/controls/rowingWidgets.ts` (SVG; cada punta o mango tiene su zona de toque, así funcionan dos pulgares a la vez y el centro de la pantalla queda para mover la cámara). Con el remo se ocultan PARADA y el giroscopio, que no aplican.
- Evidencia: `encargos/evidencia/04-*.png`.
