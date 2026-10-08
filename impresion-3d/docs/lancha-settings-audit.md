# Auditoría de configuración y apertura nativa

Archivo revisado: `impresion-3d/modelos/lancha-rounded-fenders-fine-finish-p1s.3mf`, después del guardado nativo en Bambu Studio. Comando read-only **`python3 impresion-3d/scripts/audit_boat_settings.py`**, resultado **PASS, exit 0**. Valores completos y hash: `lancha-settings-audit.json`. Añadir `--sliced ruta.3mf` comprueba por separado los cuatro ajustes efectivos del G-code; no lamina.

## Incidencia corregida en la app

La primera copia tenía los cuatro valores numéricos correctos y el CLI los usaba, pero `different_settings_to_system[0]` no declaraba esos ajustes. Al abrir en la GUI se restauraban valores del preset base: 200 mm/s, 5000 mm/s², dos capas y 0,5 mm. El guardado nativo añadió `outer_wall_speed`, `outer_wall_acceleration`, `support_interface_top_layers` y `support_interface_spacing` a esa lista, además de conservar los valores deseados. Se comprobó la diferencia antes/después y la UI; la validación CLI previa era insuficiente para asegurar la apertura editable correcta.

El verificador actual controla valores activos y declaraciones de override. El constructor `improve_boat_finish.py` también se corrigió para declarar esas claves y conservar las entradas no activas de arrays. No se volvió a escribir el proyecto durante esta auditoría.

## Valores revisados

| Área | Configuración vigente | Evaluación |
|---|---|---|
| Impresora | P1S, boquilla 0,4 mm, Bambu PLA Basic P1S | Compatible con la máquina confirmada |
| Calidad | Capa 0,12 mm; inicial 0,20 mm; ancho exterior 0,42 mm; resolución 0,012 mm | Mantener para comparar el cambio de acabado |
| Costuras | Alineadas, scarf desactivado | Pueden dejar una línea localizada; no explican todas las bandas del casco |
| Paredes | Dos; generador clásico; interior antes que exterior | No aumentar como remedio automático a marcas de soporte |
| Relleno | 15 %, grid | La malla define un cuerpo cerrado; la impresión interna NO es 100 % maciza |
| Capas sólidas | Techo cinco capas con espesor mínimo 1 mm; fondo tres capas | El mínimo superior manda si cinco capas no alcanzan; no equivale simplemente a cinco veces 0,12 |
| Exterior | 70 mm/s, aceleración 2000 mm/s² | Corrección aplicada y confirmada en GUI |
| Otras velocidades | Interior 300; relleno 270; sólido interno 250; superficie superior 200; puentes 50 mm/s | Límites configurados, no velocidades físicas constantes; no se tocaron para aislar la prueba |
| Perímetros pequeños | 50 %, umbral guardado 0 | No asumir que todos los detalles pequeños se imprimen automáticamente a la mitad sin revisar trayectorias |
| Voladizos | Reducción activada; tramos 50/30/10 mm/s | Ya existe control; no estaba desactivado |
| Soportes | Tree auto, umbral 30°, regiones críticas, también sobre pieza | Necesarios en salientes restantes; no desactivar globalmente |
| Interfaz | Superior tres capas, separación 0,25 mm; inferior dos capas y 0,5 mm | Más continua arriba; puede costar algo más retirarla |
| Distancias soporte | Z superior/inferior 0,2 mm; XY 0,35 mm | Mantener en la primera comparación física |
| Adhesión | Brim automático 5 mm | Conservar salvo evidencia de problema de adhesión |
| Material | Boquilla 220 °C; placa texturada 55 °C; caudal máximo 21 mm³/s | No hay evidencia para cambiar temperatura o flow |
| Refrigeración | Principal mínimo/máximo 100 %, auxiliar 70 %, voladizos 100 %, enfriamiento por capa activado | Ya hay ventilación elevada; no aumentarla a ciegas |

El nombre heredado `0.20mm Standard @BBL X1C` identifica el preset de proceso base. Los campos vigentes y la UI confirman P1S de 0,4 mm con altura modificada a 0,12 mm. El nombre no impone por sí solo una capa de 0,20 mm ni cambia la impresora a X1C; lo crítico es conservar correctamente los overrides al abrir.

La siguiente prueba física debe comparar el perfil ya corregido nativamente, manteniendo geometría y material. Si el fondo aún muestra cordones sin apoyo, revisar contactos de soporte/orientación antes de sumar paredes o alterar caudal. No se modificó geometría, ni se imprimió, ni se realizó otro laminado CLI durante esta auditoría. La sesión principal verificó y laminó el proyecto en la GUI.

**Archivo canónico para continuar:** abrir el editable `lancha-rounded-fenders-fine-finish-p1s.3mf` guardado nativamente. El archivo `-sliced.3mf` anterior procede del CLI previo a la corrección de metadatos: su G-code contiene los ajustes, pero abrirlo como proyecto editable podría reconstruir los defaults. No se regeneró en esta auditoría y no debe usarse como proyecto canónico.
