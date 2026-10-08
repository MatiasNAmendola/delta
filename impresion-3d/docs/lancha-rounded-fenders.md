# Neumáticos con volumen conservado

Variante principal: `impresion-3d/modelos/lancha-rounded-fenders-p1s.3mf`; laminado: `impresion-3d/modelos/lancha-rounded-fenders-p1s-sliced.3mf`.

Se parte de la versión anterior al bajo relieve rechazado. El acercamiento al casco se limita al 15 % del saliente local, conservando aro volumétrico y agujero central. Ventanas y techo permanecen idénticos. No se añadieron aletas.

Evidencia reproducible:

```sh
python impresion-3d/scripts/round_boat_fenders.py
python3 impresion-3d/scripts/review_boat_3mf.py --source impresion-3d/modelos/lancha-rounded-fenders-p1s.3mf --sliced impresion-3d/modelos/lancha-rounded-fenders-p1s-sliced.3mf
```

El primero requiere `impresion-3d/scripts/boat-stl-requirements.txt`; `--write --preview` reconstruye propuesta y vistas. Sustituir `--sliced ruta` por `--slice` para relaminar con estado aislado. Exit 1 del revisor significa que hay soportes, no error de laminado.

Mismos ajustes de impresión:

| Variante | Soporte estimado | Masa total | Tiempo total |
|---|---:|---:|---:|
| Anterior con neumáticos originales | 1,9024 g | 16,30 g | 1 h 15 min 44 s |
| Redondos actuales | 1,8426 g | 16,20 g | 1 h 15 min 5 s |
| Bajo relieve rechazado | 1,1806 g | 15,41 g | 1 h 7 min 6 s |

Valores producidos por `impresion-3d/scripts/review_boat_3mf.py` con los correspondientes 3MF laminados; JSON de esta variante: `lancha-rounded-fenders-sliced.json`. La reducción actual de soporte es aproximadamente 3,1 %. Se priorizó reconocer los neumáticos; siguen necesitando apoyos exteriores. Validado por laminado, no mediante impresión física.
