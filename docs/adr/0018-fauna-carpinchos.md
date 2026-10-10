# 0018 · Familias de carpinchos que cruzan los arroyos

**Estado:** Implementada · **Fecha:** 2026-10-09

## Contexto
La dueña pidió lugares del río donde crucen carpinchos: una familia que cruza nadando y el jugador que tiene que frenar. Respetar la naturaleza da puntos. La idea va con la visión del juego: que chicos y turistas aprendan a cuidar el río. Lo investigado, con sus fuentes, está en `docs/investigacion/12-carpinchos.md`.

## Decisión
- **Zonas de cruce** (`src/game/capybaraZones.ts`, puro y con tests). Salen del mapa, no se ponen a mano:
  - tramos de arroyo de 12 a 48 m de ancho;
  - las dos costas naturales (reflectividad < 0,4), nunca tablestacado;
  - lejos de los muelles;
  - como mucho 2 por sector de 350 unidades y a 60 unidades entre sí;
  - siempre las mismas para cada zona del mapa (semilla).
- **Familia** (`src/game/capybaraFamily.ts`):
  - 2 adultos y de 2 a 5 crías;
  - pastan en la costa, cruzan nadando en fila a 1,2 m/s, que es un valor de juego (`[sin fuente]` en el doc 12), y suben a la otra orilla;
  - cuando se asustan, se zambullen 5 s y reaparecen.
  - Solo existen cerca del jugador: hasta 3 familias a la vez, que aparecen y desaparecen con fundido.
- **Regla** (`src/game/capybaraRespect.ts`, dentro de `RuleBook`):
  - a 80 m de una familia que cruza aparece el aviso «Carpinchos cruzando — frená»;
  - quien espera a menos de 40 m, a paso de hombre (≤ 1,5 m/s), hasta que terminan de cruzar, suma `100 + 25 × crías` puntos («¡Respetaste a los carpinchos! +N»);
  - quien pasa rápido o los alcanza con su ola (≥ 8 cm a menos de 60 m) pierde 60 puntos, con un mensaje que enseña;
  - nunca se los atropella: si hay choque, se zambullen;
  - vale para todos los botes y en los dos manejos. El kayak casi no hace ola, así que puede pasar despacio.
- **Aspecto: provisorio, para cambiar** (`src/world/capybaraModel.ts`). Hasta que haya un modelo GLB de carpincho, como el que tiene la lancha colectiva, son bolitas marrones: cuerpo, cabeza y orejas, con las crías más chicas y más claras. Ese archivo es el único punto que hay que cambiar para usar el GLB (`public/models/carpincho.glb`). Se dibujan como instancias en 2 draw calls (adultos y crías).
- **Prueba rápida:** `?carpinchos=cerca` arranca el barco cerca del cruce más próximo.

## Alternativas descartadas
- **Carpinchos en todo el mapa a la vez:** costaría rendimiento y no sumaría al juego.
- **Zonas a mano:** no escalan a las cuatro zonas del mapa, y no hay fuentes por arroyo.
- **Modelo detallado hecho con primitivas:** se descartó por pedido de la dueña. Primero bolitas, después un GLB.

## Pendiente
- El modelo GLB del carpincho.
- Que el horario influya: son crepusculares según el doc 12, y hoy aparecen a cualquier hora.
- Una pauta oficial de navegación frente a la fauna (Prefectura o Municipio), que no se encontró.
