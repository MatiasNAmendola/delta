# 11 · El ecosistema del Delta en fotos de referencia

**Fecha:** 2026-10-08. **Fuente:** cuatro fotos que mandó el usuario: aérea de un arroyo, costa con palafito, muelle con escalera y aérea del Luján en Tigre. Cada elemento lleva entre paréntesis el número de la foto. Debajo de cada tabla hay una sección que dice qué tiene hoy el juego y qué falta.

## Agua
| Elemento | Qué se ve | En el juego |
|---|---|---|
| Color del río | Marrón café con leche, opaco (sedimento del Paraná) (1, 2, 3, 4) | ✅ |
| **Reflejo de los árboles** | Con el agua quieta, los árboles se reflejan como en un espejo: casuarinas, casas y el cielo (2, 3) | ❌ Solo se refleja el cielo; cerca de la orilla se oscurece |
| Estelas en V | Las lanchas dejan la V de Kelvin y una franja blanca, bien visibles desde el aire (4) | ✅ (ADR 0012) |
| Agua calma en arroyos y ondulada en ríos anchos | Los arroyos chicos están casi quietos (1, 2, 3) | Parcial: viento uniforme |

## Costas
| Elemento | Qué se ve | En el juego |
|---|---|---|
| Barranca natural baja | Barro y pasto que bajan al agua, sin playa (2, 3) | ✅ Barranca |
| Juncos y pajonal en la orilla | Matas de juncos y hierbas altas al pie (2) | ✅ Juncos, pocos |
| **Troncos caídos en el agua** | Un tronco atravesado en la orilla (2) | ❌ |
| Pasto que llega al borde | Pasto verde intenso, con musgo (3) | ✅ |
| Árboles hasta el borde del agua | Copas que cuelgan sobre el agua; casi no hay costa sin árboles (1, 4) | ✅ En parte; habría que cerrar más la copa |

## Vegetación
| Especie / rasgo | Qué se ve | En el juego |
|---|---|---|
| **Casuarinas muy altas** | Troncos rectos de 20–30 m, mucho más altos que las casas, con follaje fino de agujas (2, 3) | ⚠️ Están, pero bajas para la escala real |
| Sauces y álamos | Copas mixtas (1, 4) | ✅ |
| **Colores de estación** | Amarillos, naranjas y rojizos de otoño (álamos, sauces, ciervos) y árboles pelados en invierno (1) | ❌ Siempre verde |
| **Flores** | Santa Rita (*Bougainvillea*) fucsia trepando en los jardines (3); en primavera, ceibos y jacarandás | ❌ |
| Palmeras | Una palmera en un jardín (3) | ❌ |
| Enredaderas sobre los troncos | Hiedra y trepadoras (3) | ❌ |

## Construcciones y uso humano
| Elemento | Qué se ve | En el juego |
|---|---|---|
| **Palafito con escalera** | Casa de madera sobre pilotes, con escalera de mano hasta el piso alto (2) | ✅ Palafito, sin la escalera de mano |
| **Muelle con escalera al agua y baranda pintada** | Deck de madera pintada de rojo, con escalones que bajan al agua (3) | ⚠️ Hay muelles, pero sin escalones al agua ni madera pintada |
| Muelles perpendiculares cortos | Uno por casa, muy cortos en arroyos angostos (1) | ✅ |
| **Botes amarrados en los muelles** | Lanchitas y botes al lado de cada muelle (1) | ❌ Solo hay yolas en los muelles públicos |
| Casas retiradas, con claro de pasto alrededor | Techos grises, blancos y azules; cada casa con su parque (1) | ⚠️ Casas sí, sin claro de pasto alrededor |
| **Guarderías y marinas** | Decenas de lanchas amarradas en hileras, en la costa de Tigre (4) | ❌ |
| **La ciudad en el horizonte** | Torres de Tigre y Nordelta al fondo, del lado continental (4) | ❌ |
| Campos y claros en las islas grandes | Potreros y pastizales (4) | Parcial: suelo con manchas |
| Canchas y techos rojos | Una cancha y techos de tejas (4) | ❌ |

## Tráfico
| Elemento | Qué se ve | En el juego |
|---|---|---|
| Lanchas colectivas y catamaranes en los ríos anchos | Blancas, con estela (4) | ✅ Colectivas; ❌ catamaranes |
| Botes chicos amarrados en arroyos | (1) | ❌ |

## Prioridades sugeridas (impacto visual por costo)
1. **Reflejo de árboles y casas en el agua.** Es lo que más se nota en las fotos 2 y 3. En el celular conviene simularlo en el shader del agua: oscurecer y teñir de verde según la distancia a la orilla y la altura de la copa, sin un segundo render.
2. **Botes amarrados en cada muelle particular** y **marinas** en la costa de Tigre.
3. **Casuarinas a escala real** (20–30 m) y **colores de estación** según la fecha real: octubre es primavera, con verdes nuevos y santa ritas; abril y mayo, otoño amarillo.
4. **Muelles con escalones al agua y baranda pintada**, **claro de pasto alrededor de las casas** y **escalera de mano** en los palafitos.
5. **Troncos caídos y más juncos** en la orilla.
6. **Horizonte de la ciudad** (Tigre y Nordelta) del lado del continente, como fondo lejano.

## Implementado (2026-10-08)
1. **Reflejo de árboles y casas:** en el shader del agua, sin un segundo render. Se estima dónde toca la orilla el rayo reflejado (con la distancia a la costa y su gradiente) y si a esa distancia todavía está debajo de las copas (casuarinas de 10–28 m). Para la imagen reflejada se usa una superficie apenas ondulada: tiembla pero no se rompe. Contra el agua marrón opaca se ve incluso mirando hacia abajo. Además, cerca de las orillas de los arroyos angostos el agua es más lisa.
2. **Embarcaciones amarradas:**
   - una lancha en el 50–85 % de los muelles particulares: casco de fibra, con consola y parabrisas o con cabina, que sube y baja con la marea;
   - **marinas** llenas de lanchas en filas, con pontones, dentro de los espejos de agua reales de OSM con nombre de marina, club náutico o guardería ("Marina Santa Monica", "Club Náutico Cinave").
3. **Casuarinas a escala real:** tronco de 9,5–12,5 m de diseño, unos 22–29 m con la copa.
   - **Estación según la fecha real del hemisferio sur** (`src/world/season.ts`, o `?estacion=`): primavera con verdes nuevos, verano, otoño con álamos, sauces y frondas amarillos y naranjas, invierno con álamos y frondas pelados.
   - **Santa ritas** fucsias, rosas o naranjas junto a la mitad de las casas en primavera y verano.
4. **Muelles:**
   - barandas pintadas de rojo, blanco, verde o azul en la mitad de los muelles;
   - escalones que bajan al agua al final del muelle simple y de la glorieta;
   - escalera de mano en los palafitos;
   - **parque de pasto sin árboles** alrededor de cada casa y hasta el río.
5. **Orilla:** el doble de juncos y **troncos caídos** de 6–13 m que salen de la barranca hacia el agua, medio hundidos.
6. **Horizonte:** Tigre, Nordelta, San Fernando, Escobar, Campana, Zárate y las torres de Buenos Aires en su posición geográfica real (`src/world/Skyline.ts`). Se dibujan con el tamaño angular que tienen desde donde estás y con bruma según la distancia; los árboles cercanos los tapan.
