# Parabrisas con respaldo continuo

Entrega principal: `impresion-3d/modelos/lancha-closed-windscreen-final-p1s.3mf`. Laminado durable: `impresion-3d/modelos/lancha-closed-windscreen-final-p1s-sliced.3mf`.

La separación estaba entre los marcos originales y el núcleo rehundido: a x=-3 mm, z=18 mm existía un canal de aproximadamente 0,75 mm. Se añadió un respaldo inclinado que une marcos y núcleo conservando el rebaje visible. Las secciones a z=14,16,18 mm pasan de dos segmentos separados a un segmento continuo. Se rellenó localmente el rebaje central bajo el techo; quedan pequeñas aristas superficiales del modelo. Evidencia en `lancha-closed-windscreen-validation.json`, reproducible con:

```sh
python impresion-3d/scripts/close_boat_windscreen.py
```

Requiere dependencias de `impresion-3d/scripts/boat-stl-requirements.txt`. `--write --preview` reconstruye una nueva salida desde el 3MF clean-roof conservado. El 3MF principal mantiene los ajustes del proyecto byte a byte. Se laminó correctamente con BambuStudio:

```sh
mkdir -p /tmp/boat-windscreen-state
/Applications/BambuStudio.app/Contents/MacOS/BambuStudio --datadir /tmp/boat-windscreen-state --debug 2 --orient 0 --arrange 0 --slice 0 --export-3mf "$PWD/impresion-3d/modelos/lancha-closed-windscreen-final-p1s-sliced.3mf" --mstpp 90 "$PWD/impresion-3d/modelos/lancha-closed-windscreen-final-p1s.3mf"
```

El casco conserva su forma. Los apoyos exteriores de las defensas siguen siendo necesarios con esa geometría. La variante experimental `supported-fenders` añade aletas visibles y NO es la entrega principal; no se recomienda como sustitución estética automática.

La entrega recomendada es el 3MF laminado: el STL compañero presenta coincidencias microscópicas heredadas al fusionar coordenadas float32, por lo que no se certifica como malla cerrada. La validación de volumen por índices corresponde a la geometría del 3MF; el laminado es la comprobación efectiva para Bambu Studio.
