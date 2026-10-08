# Soportes sobre el techo: diagnóstico y propuesta

La vista por tipo de línea y el G-code del v3 confirman pequeños soportes junto al accesorio frontal elevado. Las ramas delante del parabrisas están sobre la cubierta exterior de proa, bajo el toldo. La sección a 17 mm no contiene soportes en la cabina central maciza. Los marcadores blancos corresponden a costuras en la vista de Bambu Studio. No hay evidencia de que todos los detalles visibles del techo sean soportes.

Se creó **una propuesta nueva**, `impresion-3d/modelos/lancha-short-smooth-clean-roof-p1s.3mf`, con STL del mismo nombre. Usa el toldo corto y techo alisado de la variante separada previa, y retira el accesorio frontal elevado siguiendo la superficie del techo. Conserva el casco, ventanas rehundidas y parabrisas. No modifica el v3 ni sus ajustes. Las miniaturas viejas se omiten para evitar mostrar la disposición anterior.

Validación reproducible:

```sh
python3 impresion-3d/scripts/review_boat_3mf.py --source impresion-3d/modelos/lancha-short-smooth-clean-roof-p1s.3mf --slice
python impresion-3d/scripts/correct_boat_roof_supports.py
```

El segundo comando requiere las dependencias de `impresion-3d/scripts/boat-stl-requirements.txt`. Añadir `--write --preview` reconstruye la propuesta y su imagen. El primero lamina con BambuStudio instalado, en un estado temporal aislado; exit 1 indica hallazgos de soportes, no error del laminador.

Para conservar el laminado y comprobar tipos de línea por altura:

```sh
mkdir -p /tmp/boat-clean-state /tmp/boat-clean-output
/Applications/BambuStudio.app/Contents/MacOS/BambuStudio --datadir /tmp/boat-clean-state --debug 2 --orient 0 --arrange 0 --slice 0 --export-3mf /tmp/boat-clean-output/sliced.3mf --mstpp 90 impresion-3d/modelos/lancha-short-smooth-clean-roof-p1s.3mf
python impresion-3d/scripts/check_boat_support_intersections.py --source impresion-3d/modelos/lancha-short-smooth-clean-roof-p1s.3mf --sliced /tmp/boat-clean-output/sliced.3mf
```

Resultado en `lancha-clean-roof-sliced.json` y `lancha-clean-roof-intersections.json`: los soportes normales terminan a 16,64 mm y la interfaz a 16,88 mm; el techo llega a 20,84 mm. Desaparecen las trayectorias de soporte sobre el techo, que en el v3 llegaban a 22,64 mm. Misma configuración: total 16,29 g y 1 h 15 min 31 s, aproximadamente 1,90 g de soporte. Estas medidas son del laminado, no de una impresión física.

El comprobador detecta proximidades/intersecciones locales bajo el casco que requieren una evaluación independiente antes de atribuir un defecto de malla; no certifica ausencia de autointersecciones. La conclusión del techo se basa en tipos de trayectoria, alturas máximas, sección central y verificación visual concordantes. La propuesta aún conserva soporte exterior necesario en defensas/salientes. No es una promesa de impresión completa sin soportes.
