# Acabado de la impresión física

El usuario confirma que la impresión salió bien y mucho mejor. Las fotos conservadas son `lancha-printed-bottom.png` y `lancha-printed-side.png`. La iluminación, el color blanco y el enfoque limitan identificar defectos finos.

La panza muestra líneas que siguen la curvatura del casco, junto con rebabas localizadas. Son compatibles con escalonado de capas, perímetros en voladizo y restos/contactos de soporte. No todas las líneas son necesariamente fallos. El lateral muestra irregularidades en bordes y detalles pequeños; algunos reproducen la geometría facetada original. Se alisó el techo, no todo el casco, marcos o neumáticos. No se puede diagnosticar caudal, humedad, temperatura incorrecta o vibración a partir de estas fotos.

Ajustes guardados en el laminado rounded-fenders, obtenidos con **`python3 impresion-3d/scripts/review_boat_finish.py`** y conservados en `lancha-printed-finish-settings.json`:

- Capa 0,12 mm y dos paredes.
- Pared externa: límite 200 mm/s y aceleración 5000 mm/s²; interna 300 mm/s. No implican que cada trazo alcance esas velocidades.
- Reducción para voladizos ya activada; velocidades configuradas 50/30/10 mm/s según tramo. Ventilación de voladizos 100 % y ventilador auxiliar 70 %.
- Interfaz superior de soporte: dos capas, separación 0,5 mm, velocidad 80 mm/s; separación vertical superior 0,2 mm y lateral 0,35 mm.
- Costura alineada. Temperatura guardada 220 °C. Ironing desactivado.

Se trata de los ajustes del archivo, no de una confirmación independiente de la configuración exacta usada en la foto.

## Prueba conservadora propuesta, sin aplicar

1. Para los costados, probar pared externa a 60–80 mm/s y aceleración a 2000 mm/s². Puede mejorar uniformidad de trazos y cambios de dirección; aumenta tiempo y no elimina facetas ni marcas de soporte. Conservar inicialmente temperatura, caudal y ventiladores.
2. Para zonas inferiores que realmente descansan sobre soporte, probar tres capas de interfaz y separación de interfaz de 0,25 mm, manteniendo primero la separación Z de 0,2 mm. Forma una superficie de apoyo más continua, con más material/tiempo y posible retirada más difícil. No cambia las zonas que el laminador deja sin apoyo; revisar contactos antes de atribuir una mejora al ajuste.
3. Si predominan escalones regulares de la curva, una capa menor puede reducirlos, pero no elimina el problema geométrico de una panza que se ensancha desde una quilla estrecha. Un acabado inferior más fino puede exigir orientación distinta, más apoyo o una modificación localizada de forma. No alisar globalmente: podría borrar los neumáticos y marcos que se decidió conservar.

La costura alineada explica una línea concentrada de inicios/finales; ubicarla hacia popa puede esconderla, pero no corrige las bandas que recorren toda la panza. Ironing trata superficies superiores y no es solución para esta cara inferior. Las propuestas numéricas son puntos de partida para una prueba comparativa, no calibraciones demostradas de esta impresora. No se modificó malla, perfil ni G-code, y no se hizo otro laminado.
