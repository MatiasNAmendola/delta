# Perfil de acabado conservador

Proyecto: `impresion-3d/modelos/lancha-rounded-fenders-fine-finish-p1s.3mf`.
Laminado: `impresion-3d/modelos/lancha-rounded-fenders-fine-finish-p1s-sliced.3mf`.

La geometría y el resto del proyecto son idénticos byte a byte a rounded-fenders. Se conservaron casco, neumáticos, parabrisas y techo: las fotos no justificaban una deformación adicional.

Cambios aplicados y confirmados en el G-code:

- Pared externa: 70 mm/s; aceleración 2000 mm/s². Busca trazos laterales más uniformes.
- Interfaz superior de soporte: tres capas y separación de 0,25 mm. Busca una base más continua para las zonas inferiores apoyadas.
- Separación vertical superior conservada en 0,2 mm. Se mantienen temperatura, ventilación, capa de 0,12 mm y demás ajustes.

Verificación read-only:

```sh
python3 impresion-3d/scripts/improve_boat_finish.py
```

Resultado **PASS, exit 0**; evidencia `lancha-fine-finish-validation.json`. Reconstrucción y laminado: `python3 impresion-3d/scripts/improve_boat_finish.py --write --slice`. BambuStudio usa estado temporal aislado; no envía ninguna impresión. Sólo se modifican cuatro claves del perfil.

Tiempo estimado **1 h 21 min 36 s**, frente a **1 h 15 min 5 s** anterior; masa **16,19 g**, frente a **16,20 g**. Valores del encabezado G-code conservados en el JSON; son estimaciones del laminador. La interfaz más densa puede dificultar algo la retirada. Estos ajustes no eliminan las facetas originales ni los escalones geométricos de una panza curva. El efecto sobre el acabado debe compararse en la siguiente impresión física.

Actualización de apertura nativa: el control posterior en GUI detectó que faltaban las declaraciones de override en la primera copia. El guardado desde Bambu Studio corrigió los cuatro valores y `different_settings_to_system`. El PASS CLI original no verificaba ese comportamiento. La auditoría vigente es `python3 impresion-3d/scripts/audit_boat_settings.py`; detalle en `lancha-settings-audit.md`. Conservar el archivo guardado nativamente; no regenerarlo como parte de una mera revisión.
