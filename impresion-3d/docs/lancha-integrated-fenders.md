# Defensas integradas

Entrega: `impresion-3d/modelos/lancha-integrated-fenders-p1s.3mf`; laminado durable: `impresion-3d/modelos/lancha-integrated-fenders-p1s-sliced.3mf`.

Las defensas laterales pasan a ser aros de bajo relieve unidos a la pared del casco. Se comprime su saliente exterior respecto de la pared local, sin añadir aletas hacia la quilla. La geometría situada por encima de 13 mm permanece idéntica: ventanas corregidas y techo conservados. Los archivos anteriores no se modifican.

Validación/reconstrucción con dependencias de `impresion-3d/scripts/boat-stl-requirements.txt`:

```sh
python impresion-3d/scripts/integrate_boat_fenders.py
# Reconstruir la variante y sus vistas:
python impresion-3d/scripts/integrate_boat_fenders.py --write --preview
```

Comparación real con los mismos ajustes guardados de P1S/PLA:

```sh
python3 impresion-3d/scripts/review_boat_3mf.py --source impresion-3d/modelos/lancha-closed-windscreen-final-p1s.3mf --sliced impresion-3d/modelos/lancha-closed-windscreen-final-p1s-sliced.3mf
python3 impresion-3d/scripts/review_boat_3mf.py --source impresion-3d/modelos/lancha-integrated-fenders-p1s.3mf --sliced impresion-3d/modelos/lancha-integrated-fenders-p1s-sliced.3mf
```

Soporte estimado por extrusión del G-code: **1,9024 g → 1,1806 g**, reducción aproximada del **38 %**. Tiempo total: **1 h 15 min 44 s → 1 h 7 min 6 s**. Masa total: **16,30 g → 15,41 g**. El comando sale 1 porque aún encuentra soportes; 2 indica error. Para volver a laminar, sustituir `--sliced ruta` por `--slice`.

Evidencia: `lancha-integrated-fenders-validation.json` y `lancha-integrated-fenders-sliced.json`. Vistas frontal y lateral: `lancha-integrated-fenders-front.png` y `lancha-integrated-fenders-side.png`.

Quedan soportes en otros salientes exteriores; no se desactivaron para producir la reducción. Resultado validado por laminado, todavía no por impresión física. La entrega es 3MF para mantener la geometría por índices y el perfil.
