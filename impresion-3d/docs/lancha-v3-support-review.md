# Revisión de soportes del proyecto v3

Fuente: `impresion-3d/modelos/lancha-optimized-reinforced-v3-p1s.3mf`, conservada sin cambios.
Evidencia: `python3 impresion-3d/scripts/review_boat_3mf.py --slice` (BambuStudio instalado; estado temporal aislado). Sale 1 porque encuentra soportes y miniatura desactualizada; 2 indica error. El JSON adjunto registra hash, configuración y medición. No se envía ninguna impresión.

El build real contiene una lancha `braced-awning-no-mast`, anterior a las variantes `smooth-roof` y `short-awning`. La metadata de la miniatura enumera dos lanchas de una disposición anterior; no es el build vigente.

El laminado real con BambuStudio 02.08.02.61 estima **17,07 g y 1 h 22 min 39 s**. Las trayectorias de soporte e interfaz suman aproximadamente **2,24 g**, **13,2 %** del filamento depositado por funciones de impresión. El tiempo es total, no tiempo exclusivo de soporte. Medido por el comando anterior; detalle en `lancha-v3-support-review.json`.

Ajustes efectivos: P1S, PLA, capa 0,12 mm, `tree(auto)`, umbral 30°, `support_on_build_plate_only=0`, `bridge_no_support=0`, `support_critical_regions_only=1`. El nombre guardado del perfil menciona 0,20 mm, pero la altura efectiva es 0,12 mm. `bridge_no_support=0` significa que no se excluyen puentes del soporte.

La extrusión de interfaz se distribuye aproximadamente 13 % bajo 6 mm, 68 % entre 6 y 14 mm, y 19 % entre 14 y 19 mm. Son alturas de interfaz, no una identificación unívoca del contacto ni del motivo de cada árbol. Concuerdan con varias zonas problemáticas visibles: casco que se ensancha desde una quilla estrecha, cara inferior de defensas redondas y salientes de proa/popa, además del toldo. Los troncos altos o bajos por sí solos no identifican la pieza sostenida.

Acortar el toldo no resuelve las defensas y la parte inferior del casco. Para una sola pieza, la propuesta concreta es una base inferior discreta con apoyo plano y transiciones inferiores biseladas en defensas/salientes. Cambia la cara inferior y requiere aprobar esa forma antes de producir otra variante. Para conservar mejor el exterior completo, dos mitades longitudinales apoyadas por su corte son otra opción, con montaje posterior.

Como prueba limitada de configuración, se puede comparar una copia con «No soportar puentes» activado y revisar las trayectorias de los puentes antes de imprimir: omitir su soporte no garantiza un puente imprimible. «Solo en la placa» limita dónde nacen los soportes, puede desplazar o eliminar apoyos interiores y no garantiza menos árboles. No se cambió ninguno de estos ajustes ni se ensayó una impresión física.
