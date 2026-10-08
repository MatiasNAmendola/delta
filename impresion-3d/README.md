# Lancha para imprimir en 3D

Versión imprimible de la lancha colectiva del juego, pensada para una Bambu Lab P1S con boquilla de 0,4 mm y una eslora de 93 mm. Esto no forma parte del juego: el modelo del juego es `public/models/lancha-optimized.glb`.

## Carpetas

- `scripts/`: los scripts de Python que generan y revisan cada versión. Todos toman las rutas relativas a esta carpeta.
- `docs/`: un informe por versión (`*.md`), con sus validaciones (`*.json`) y vistas previas (`*.png`).
- `modelos/`: los `.stl` y `.3mf`, unos 62 MB. **No se versionan** (ver `.gitignore`). Ojo: no todos se regeneran. La cadena arranca de `lancha-optimized-print-ready-reinforced-93mm.stl` y de los `.3mf` `reinforced-v3`, que solo existen en esa carpeta. Hay que guardar una copia aparte, por ejemplo como asset de un Release de GitHub.

## Cómo correrlo

```
python3 -m pip install -r impresion-3d/scripts/boat-stl-requirements.txt
python3 impresion-3d/scripts/audit_boat_settings.py   # read-only, exit 0 = PASS
```

Para laminar desde la línea de comandos hace falta Bambu Studio en `/Applications/BambuStudio.app`. Ver `scripts/review_boat_3mf.py --slice`.

## Cadena de versiones

1. `fill_boat_roof.py`: techo macizo, sin mástil (`solid-roof.md`).
2. `solidify_boat.py`: casco macizo (`solid-body.md`).
3. `recess_boat_windows.py`: ventanas rehundidas (`recessed-windows.md`).
4. `brace_boat_awning.py`, `smooth_boat_roof.py` y `shorten_boat_awning.py`: toldo reforzado y techo liso.
5. `correct_boat_roof_supports.py`: soportes del techo (`lancha-clean-roof-support-fix.md`).
6. `close_boat_windscreen.py`: parabrisas cerrado.
7. `integrate_boat_fenders.py` y `round_boat_fenders.py`: defensas integradas y redondeadas.
8. `improve_boat_finish.py`: ajustes de acabado fino (`lancha-fine-finish.md`). La auditoría de esos ajustes está en `lancha-settings-audit.md`.

La impresión física salió bien. Las fotos y los ajustes usados están en `docs/lancha-printed-finish.md`.

## Pendiente

`modelos/bambu-result.json` guarda el último error de Bambu Studio: *«One of the plate is empty or has no object fully inside it»* (return code -50). Ese 3MF tiene una placa vacía, o un objeto que no entra entero en la placa.
