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
