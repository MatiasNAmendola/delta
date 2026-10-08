# 02 - Maniobra y controles de las embarcaciones del Delta

> Revisión del juez (2026-10-08): se revisaron todas las afirmaciones y números con búsquedas propias (WebSearch; WebFetch sigue bloqueado para la mayoría de los dominios) y con conocimiento estándar de maniobra y arquitectura naval. **Validado:** fórmula de velocidad de casco (1,34·√LWL en pies → nudos) y su ejemplo; punto de pivote (~1/3 desde proa avante, migra a popa al ciar); efecto evolutivo (hélice dextrógira → popa a babor en marcha atrás); caña invertida; seguro de neutro Yamaha y zona de ralentí de ~35°; jet ski sin gobierno sin empuje; iBR; mecánica de remadas de kayak; gobierno del single por presión; cadencias de Concept2 (son de ergómetro, no de bote); tiempos de referencia de remo (mejor marca mundial 1x: 6:30.74, R. Manson 2017). **Corregido:** distancia/tiempo de parada de la colectiva (eran físicamente incompatibles), pausa de neutro inconsistente entre 0.4 y 1.3, radio de giro del 4+ (los metros no correspondían a 3-5 esloras), velocidad del bote de travesía (3-5 m/s es de regata, no de travesía), terminología "de punta" vs "de par" en el single (error: el single es de par/scull), cuándo y cómo aparecieron OPAS/OTAS (no son "modelos nuevos": OPAS 2002, OTAS desde ~2009), freno de emergencia en remo (se cuadran las palas en forma progresiva), remada timón (sentido según empujar o traer la pala), "chine walk" en RIB, velocidad de sprint de kayak, cantidad de clubes de remo, conjugación de "ciar" y URL de Wikipedia mal escrita. **Sin verificar:** todo lo técnico de las colectivas del Tigre (eslora, motor, rueda vs. caña, tipo de comando); solo se confirmó que son de madera (caoba) con motores diésel antiguos. También quedan sin verificar las órdenes de remo argentinas, si el bote de travesía de los clubes es de punta o de par, y todas las distancias de frenado y radios de giro (siguen como [estimado]). La propuesta de juego tenía conflictos de teclas (Ctrl+Q/W/E en navegador, A/D duplicado en el single); ver "Observaciones del juez" en la sección 5. Confiabilidad global tras la revisión: **media** (física general alta; datos específicos del Tigre, baja).

Investigación para el modo opcional de "controles realistas" (junto al modo arcade adelante/atrás/izquierda/derecha).
Fecha de la investigación: 2026-10-08.

## Convenciones y advertencia de calidad de fuentes

- `[confirmado: URL]` = el dato aparece en la fuente citada (vista en resultados de búsqueda; ver limitaciones).
- `[estimado]` = valor razonable propio, de conocimiento general o derivado; hay que calibrarlo jugando. No es un dato medido.
- Limitaciones honestas: WebFetch falló por DNS en todos los dominios probados (Wikipedia, sea-doo.brp.com), así que se trabajó solo con resultados de WebSearch. Muchas fuentes son foros o blogs náuticos, no manuales oficiales. No se encontró ninguna fuente primaria (Prefectura Naval Argentina, Yamaha, Mercury, Volvo Penta, RYA, World Rowing) con cifras de maniobra, distancias de frenado ni radios de giro. Esos números quedan como `[estimado]` y conviene validarlos con un lanchero o con las fichas técnicas de los fabricantes.
- No se halló ninguna fuente sobre eslora, motor o sistema de gobierno de las lanchas colectivas del Tigre. Todo lo de la sección 1 sobre su equipamiento es `[estimado]` salvo lo indicado.

---

## 0. Física común de las embarcaciones a motor

### 0.1 Timón y flujo de agua
- Un timón o un jet solo gobierna si hay agua fluyendo; el agua que pasa por el timón es lo que permite gobernar. Por eso conviene mantener algo de arrancada en vez de detenerse y reiniciar durante una maniobra. [confirmado: https://powerboating-blog.nauticed.org/experiencing-prop-walk/ y https://sailing-blog.nauticed.org/prop-walk-on-a-sailboat/ (resumen de búsqueda)]
- En marcha atrás el timón es mucho menos efectivo y el efecto de la hélice se nota más. [confirmado: https://riggingdoctor.com/life-aboard/2016/8/23/prop-walk (resumen de búsqueda)]
- En barcos con el timón detrás de la hélice, el chorro de la hélice sobre el timón da algo de gobierno incluso con poca velocidad del casco (golpe de hélice con timón a la banda). [estimado: práctica estándar; la fuente citada describe la maniobra "ráfaga adelante con timón a la banda": https://riggingdoctor.com/life-aboard/2016/8/23/prop-walk]

### 0.2 Efecto evolutivo de la hélice (prop walk / asymmetric blade thrust)
- Causa: eje no paralelo a la superficie del agua; las palas que bajan y suben generan empuje asimétrico. [confirmado: https://riggingdoctor.com/life-aboard/2016/8/23/prop-walk, https://en.wikipedia.org/wiki/Propeller_walk (resumen de búsqueda)]. *Nota del juez:* además de la asimetría de las palas influye el efecto "rueda de paletas" (las palas inferiores trabajan en agua más densa/menos perturbada) y la interacción del chorro con el casco; para el juego alcanza con un único momento lateral. En español se lo llama "efecto evolutivo de la hélice" (término usado en manuales de patrón; la búsqueda del juez solo encontró la expresión en https://www.giornaledellavela.com/2023/01/24/video-propeller/?lang=en y en patentes de la OEPM, sin texto legible).
- Hélice de paso a derecha: en marcha atrás la popa tiende a ir a babor; hélice a izquierda, a estribor. [confirmado: https://riggingdoctor.com/life-aboard/2016/8/23/prop-walk]
- En marcha adelante el efecto es leve y se compensa con timón; en marcha atrás es mucho más fuerte y de signo opuesto. Es mayor a baja velocidad y a muchas RPM; más palas o más paso aumentan el efecto. [confirmado: https://riggingdoctor.com/life-aboard/2016/8/24/how-bad-will-my-prop-walk-be y https://sailmagazine.com/cruising/walking-the-prop/ (resumen de búsqueda)]
- Maniobra de giro en el lugar de un monomotor: ráfaga corta adelante con timón a la banda, luego ráfaga corta atrás; la popa se va hacia el lado del efecto. [confirmado: https://riggingdoctor.com/life-aboard/2016/8/23/prop-walk]
- Para el juego: valor de efecto en marcha atrás [estimado]: aplicar un momento lateral de popa proporcional a (RPM x (1 - velocidad/vel_max)), con signo según el lado de la hélice; en adelante usar ~15-25 % de ese valor [estimado].

### 0.3 Punto de pivote
- Un barco a motor con gobierno a popa pivota a aproximadamente un tercio de la eslora desde la proa; la popa barre hacia afuera del giro. En marcha atrás el pivote se desplaza hacia popa. [confirmado: https://www.boatblurb.com/post/quicktips-understanding-the-pivot-point-in-your-steering (resumen de búsqueda)]. *Nota del juez:* coincide con la bibliografía de maniobra (pivote entre 1/4 y 1/3 de la eslora desde proa avante; en marcha atrás, ~1/4 desde popa). Con el barco quieto el pivote está cerca del centro.
- Un giro en U a ralentí adelante requiere al menos unas 2,5 esloras de espacio. [confirmado como opinión de una fuente: https://www.vesseloperations.org/class-blog/2017/10/5/pivot-points (resumen de búsqueda); tomar como orden de magnitud]

### 0.4 Cambio adelante/atrás y pausa en punto muerto (protección de la transmisión)
- Los controles remotos Yamaha tienen un gatillo de seguridad de punto muerto que hay que accionar para salir de neutro; fuerza una pausa deliberada. [confirmado: https://manualslib.mx/manual/83843/Yamaha-60F.html?page=34 (resumen de búsqueda)]
- En controles de palanca única el motor se mantiene en ralentí hasta mover la palanca unos 35 grados desde neutro: primero se engrana, luego acelera. [confirmado: https://manuals.buster.fi/content/GUID-5B400DEC-AFB4-48A2-AC25-7333D4E3AA25/1.0.0.2026-06-09T090445Z/en/GUID-8423FFE3-D3C2-4E6B-81F3-A6735B4ACFEF.html (resumen de búsqueda; ese manual es de Buster, no Yamaha)]
- Al pasar a marcha atrás hay un retardo hasta que se genera empuje: mantener el acelerador firme y esperar antes de subir; no invertir a alta velocidad por riesgo de daño. [confirmado: https://manuals.buster.fi/content/GUID-EEC4236A-B2FA-44ED-A43B-FD03BD3B68D8/1.0.0.2026-en/en/GUID-2690A476-DD32-4271-BC41-4FF86DBA6A55.html (resumen de búsqueda)]
- Duración de la pausa en neutro: no se encontró cifra en fuentes. [estimado]: 0,5-1 s mínimo en fuera de borda/lancha chica; 1-3 s en inversor diésel de lancha pesada, con régimen bajado a ralentí antes de invertir (valor unificado por el juez con la sección 1.3, que decía 2-3 s).
- Procedimiento de frenado de práctica: sacar a neutro, dejar pasar la estela propia, luego aplicar marcha atrás gradual. [confirmado: https://powerboating-blog.nauticed.org/the-art-of-stopping-a-boat/ (resumen de búsqueda)]

### 0.5 Casco de desplazamiento vs. planeo
- Un casco de desplazamiento está limitado por la eslora: velocidad en nudos ≈ 1,34 x raíz cuadrada de la eslora en flotación (en pies). [confirmado: https://www.boatdesign.net/ y https://boatblurb.com/post/wake-up-the-science-behind-creating-a-wake-and-why-size-matters (resumen de búsqueda; fórmula clásica)]. Ejemplo [estimado, calculado]: lancha de 15 m de eslora total (~49 pies; en flotación aprox. 46 pies) da 1,34·√46 ≈ 9,1 nudos (~17 km/h). *Verificado por el juez:* la fórmula es correcta con LWL en pies y resultado en nudos; en unidades SI equivale a v [m/s] ≈ 1,25·√(LWL [m]) (≈ 0,40·√(g·LWL)). Es un umbral "blando": con mucha potencia un casco de desplazamiento puede superarlo levemente a costa de una ola enorme; un casco semiplaneador lo supera con más facilidad.
- Un casco planeador no tiene velocidad de casco; al planear la resistencia cae. [confirmado: mismas fuentes]. En planeo hay mucho menos agarre lateral (la lancha "derrapa" en curva y se inclina hacia adentro o afuera) y el frenado es largo. [estimado]
- Distancias de frenado y radios de giro: no hay cifras en fuentes. [estimado]:
  - Desplazamiento pesado (colectiva), de 15 km/h a parada con inversor: 3-5 esloras (~45-75 m), es decir ~20-35 s (a 4,2 m/s con desaceleración aproximadamente uniforme, t ≈ 2·d/v; comprobación del juez). Radio de giro con timón a la banda a velocidad de crucero: 2-3 esloras.
  - Planeo (runabout de 5-6 m) cortando acelerador desde 40 km/h: ~3-6 esloras hasta caer a desplazamiento; radio de giro en planeo 4-8 esloras, en desplazamiento ~1,5-2 esloras.

### 0.6 Viento y corriente
- Tomar el viento y la corriente al elegir el lado de aproximación; la corriente actúa sobre todo el casco (deriva) y el viento sobre la obra muerta. [estimado: práctica general]. No se obtuvo fuente con cifras.
- Delta del Tigre: hay corrientes de marea/ríos (Luján, Paraná de las Palmas, San Antonio) y efecto de sudestada; valores a definir en el documento de entorno. [estimado]
- Para el juego: deriva = vector corriente (0,2-1,0 m/s [estimado]) sumado a la velocidad sobre el fondo; viento = fuerza proporcional al área expuesta (alta en colectivas con cabina, baja en kayaks salvo viento fuerte) [estimado].

---

## 1. Lancha colectiva (madera, ~15-18 m, diésel intraborda)

Lo que se sabe de la fuente: las colectivas son el transporte público fluvial del Delta (salen de la Estación Fluvial de Tigre, con horarios fijos) y conviven con lanchas taxi y almaceneras. [confirmado: https://www.lanacion.com.ar/salud/salidas-en-catamaran-entre-canales-y-vegetacion-frondosa-para-internarse-en-otro-mundo-nid01032025/ (resumen de búsqueda)]. No se encontró fuente con eslora, motor o capacidad.
- *Agregado del juez:* son barcos de pasajeros tradicionales construidos en madera de caoba y propulsados por antiguos motores diésel. [confirmado: https://www.interempresas.net/Nautica/536932-Torqeedo-participa-en-la-iniciativa-EcoLancha.html (resumen de búsqueda)]. Como referencia de tamaño, un prototipo eléctrico que imita la estética de la colectiva lleva 22 pasajeros y se planeaba uno de 64. [confirmado como contexto: https://www.iprofesional.com/negocios/389390-asi-es-la-primera-lancha-ecologica-fabricada-en-la-argentina (resumen de búsqueda)]. La eslora de 15-18 m del título sigue siendo [estimado].

### 1.1 Gobierno
- Rueda de timón desde la timonera: [estimado]. Es lo habitual en barcos de esa clase, con transmisión mecánica (cable/barra) o hidráulica al timón de popa. No verificado para las colectivas del Tigre; a confirmar con un lanchero o fotos.
- Giro de la rueda: en una rueda, girar a la derecha lleva la proa a estribor (la rueda actúa "como un volante de auto"). [estimado: convención general]. Cantidad de vueltas de tope a tope: típico 3-5 vueltas en transmisión mecánica; ~2-4 en hidráulica. [estimado]
- Ángulo máximo de pala: 35 grados por banda (valor estándar de diseño). [estimado]

### 1.2 Control de motor
- Terminología en español: "palanca de mando" / "comando" / "mando único" (monopalanca) que gobierna a la vez inversor y acelerador; posiciones "marcha avante" (o "adelante"), "punto muerto" (o "neutro") y "marcha atrás" (o "atrás"/"ciar"). El "inversor" (reversor) es la caja que invierte el sentido de giro del eje o lo deja en neutro. [confirmado como terminología técnica: patentes españolas ES 0156815 A3 (https://consultas2.oepm.es/pdf/ES/0000/000/00/15/68/ES-0156815_A3.pdf) e IT1011894B (https://patents.google.com/patent/IT1011894B/en:Method) (resumen de búsqueda)]. *Nota del juez:* las patentes son una fuente débil para el uso real del habla náutica rioplatense. Los términos "marcha avante", "punto muerto", "marcha atrás", "inversor" y "palanca de mando" son los de uso corriente en manuales de patrón y de motores; la patente ES 0191093 A3 describe un "mando único" (https://consultas2.oepm.es/pdf/ES/0000/000/00/19/10/ES-0191093_A3.pdf) y en el habla de guarderías se oye "monocomando" [estimado: uso coloquial, sin fuente]. "Ciar" significa en sentido estricto remar hacia atrás (verbo del remo); aplicado a un motor se entiende, pero lo habitual es "dar atrás"/"marcha atrás". Para la interfaz conviene usar "Avante / Neutro / Atrás".
- Mando con guía en Y: en las posiciones extremas la palanca queda libre; en las intermedias acciona el acelerador o el descompresor. [confirmado: patente en resumen de búsqueda, ver arriba]. *Nota del juez:* es el mecanismo de una patente concreta (con descompresor, propio de motores chicos antiguos); no describe un comando típico y no debe usarse como modelo de la colectiva.
- Equivalentes en inglés: single lever control (SLC) / engine control head; ahead / neutral / astern; "gearbox" o "marine gearbox/transmission"; "reverse gear". [estimado/terminología estándar]
- Telégrafo de máquinas: se usa en buques con sala de máquinas separada, para comunicar órdenes del puente (Avante muy despacio, Avante despacio, Avante media, Avante toda; Atrás igual; Alto/Paren máquinas). En una lancha de 15-18 m con motorista y timonel en la misma timonera es probable que no exista, o que el capitán controle directamente. [estimado]
- Diésel pesado: la aceleración es lenta (el régimen sube en 3-6 s [estimado]) y el casco tiene mucha inercia.

### 1.3 Números de maniobra (todos [estimado])
- Velocidad de servicio: 10-15 km/h en el Delta (zonas de velocidad limitada); máxima ~17-20 km/h. *Nota del juez:* 20 km/h supera la velocidad de casco calculada en 0.5 para 46 pies de flotación (~17 km/h); solo es posible si el casco es semidesplazamiento o la flotación es mayor. Usar ~17 km/h como tope "duro" del modelo de desplazamiento, con resistencia que se dispara por encima.
- Aceleración a velocidad de servicio: 15-25 s. Parada con inversor desde 12 km/h (3,3 m/s): ~25-50 m / ~15-30 s. *Corrección del juez:* el original decía "~30-60 m / 8-15 s", lo cual es imposible (recorrer 30-60 m en 8-15 s exige una velocidad media de 3,75-4 m/s, mayor que la inicial). Con desaceleración aproximadamente uniforme, t ≈ 2·d/v.
- Radio de giro a velocidad de servicio: 2-3 esloras (~30-54 m para 15-18 m); desde parado, con un golpe de máquina avante y el timón a la banda, gira prácticamente sobre su eslora (círculo de ~1-1,5 esloras). *Redacción aclarada por el juez.*
- Pausa de cambio avante a atrás: 1-3 s en neutro con régimen bajo (unificado con 0.4), más 1-2 s de retardo hasta que se genera empuje atrás. [estimado]
- Marcha atrás: gobierno muy pobre; efecto evolutivo marcado; pivote cerca de popa.
- Atraque: la colectiva suele arrimarse a un muelle contra la corriente, apoyando la proa (o con un cabo de proa/"spring") y dando golpes de máquina avante con el timón a la banda para pegar la popa. [estimado: maniobra estándar de monohélice; no verificado para las colectivas]

---

## 2. Lanchas particulares

### 2.1 Runabout con fuera de borda: volante + caja de comando remoto
- Gobierno: volante con timonería hidráulica o por cable al motor; el motor entero gira, así que hay gobierno por empuje (vectorial) y no solo por pala. [estimado: diseño estándar]
- Control remoto de palanca única: neutro en el centro; adelante = empuja la palanca hacia proa; atrás = hacia popa; el motor queda en ralentí hasta unos 35 grados, desde donde empieza a acelerar. [confirmado: https://manuals.buster.fi/content/GUID-5B400DEC-AFB4-48A2-AC25-7333D4E3AA25/1.0.0.2026-06-09T090445Z/en/GUID-8423FFE3-D3C2-4E6B-81F3-A6735B4ACFEF.html]
- Hay un seguro de neutro (gatillo que se levanta para salir de punto muerto). [confirmado: https://manualslib.mx/manual/83843/Yamaha-60F.html?page=34]
- Retardo al engranar atrás hasta que hay empuje; no se debe invertir a alta velocidad. [confirmado: https://manuals.buster.fi/content/GUID-EEC4236A-B2FA-44ED-A43B-FD03BD3B68D8/1.0.0.2026-en/en/GUID-2690A476-DD32-4271-BC41-4FF86DBA6A55.html]
- Números [estimado]: runabout de 5-6 m con 60-115 HP: planea a ~20-25 km/h, máxima 50-70 km/h; salida a planeo en 3-5 s; "trim" (inclinación del motor) cambia actitud y agarre. En el Delta se navega mayormente en 15-30 km/h por los límites de velocidad.

### 2.2 Lancha de pesca chica con caña del timón (tiller)
- El control es inverso: se empuja la caña hacia babor y la proa va a estribor; la proa siempre va hacia el lado opuesto al que se mueve la caña. [confirmado: https://www.boats.com/how-to/boating-tips-how-to-use-a-tiller-steer-outboard y https://en.wikipedia.org/wiki/Tiller (resumen de búsqueda)]
- Es contraintuitivo, sobre todo para quien viene del volante. [confirmado: https://www.epropulsion.com/post/tiller-outboard-motors/]
- La manija de la caña suele tener el acelerador giratorio y a veces un cambio (adelante/neutro/atrás) en el costado del motor. [estimado; patentes sobre tiller con agarre reversible: https://patents.justia.com/patent/10696367]. *Agregado del juez:* en motores chicos Yamaha la palanca de cambio está en el costado del motor, con tres posiciones (adelante/neutro/atrás): girarla hacia el usuario engrana adelante y alejarla engrana atrás. [confirmado: https://manualslib.mx/manual/87945/Yamaha-2B.html?page=32 (resumen de búsqueda)]
- Números [estimado]: bote de 4-4,5 m con fuera de borda 15-25 HP; planeo parcial 20-30 km/h; gran maniobrabilidad (radio muy corto, del orden de 1-1,5 esloras, con el motor bien orientado; "en el lugar" es exagerado salvo combinando adelante/atrás — corrección del juez), pero sensible al peso y a la posición del conductor (centro de gravedad).
- A baja velocidad sin arrancada el motor orientado empuja la popa de costado: el gobierno por empuje sigue funcionando con el motor en marcha (a diferencia del timón fijo). [estimado]

### 2.3 Lancha clásica de madera con intraborda
- Gobierno por volante y timón de pala detrás de la hélice; control de motor con palanca única de inversor/acelerador o dos palancas separadas (inversor + gases) según la época. [estimado]
- Aplican el pivote a un tercio desde proa y el efecto evolutivo de la hélice en marcha atrás (sección 0.2). [confirmado: fuentes en 0.2 y 0.3]
- Números [estimado]: 6-8 m, 10-20 km/h de crucero; giro con timón a la banda en 1,5-2,5 esloras; parada con inversor en 2-4 esloras. Con una sola hélice, arrima mejor con una banda que con la otra por el efecto evolutivo.

### 2.4 RIB (semirrígido)
- Gobierno y control como el runabout (volante + palanca, o caña en chicos). [estimado]
- Particularidades [estimado]: mucha estabilidad direccional en planeo, curva cerrada con inclinación hacia adentro; el casco en V profunda sigue la ola y se agarra bien en curva. Más flotabilidad y deriva por viento a baja velocidad (los tubos y el poco calado ofrecen mucha superficie al viento y poca resistencia lateral). *Corrección del juez:* se quitó "fuerte chine walk": es una inestabilidad (balanceo lateral oscilante) de cascos planeadores a alta velocidad con mucho trim, no un rasgo característico de los semirrígidos; puede modelarse como efecto opcional de exceso de trim en cualquier lancha de planeo.

### 2.5 Moto de agua (jet ski)
- Propulsión y gobierno por chorro: no se gobierna sin empuje. Soltar el acelerador, ponerlo en ralentí o apagar el motor hace perder todo el gobierno; la moto sigue derecho. [confirmado: https://driveaboatusa.com/blog/steering-control-pwc/ y https://www.boat-ed.com/texas/studyGuide/Steering-and-Stopping-a-PWC/10104502_48122/ (resumen de búsqueda)]
- Muchos modelos desde principios de los 2000 tienen gobierno asistido sin acelerador. Sea-Doo usó primero OPAS (Off-Power Assisted Steering, modelo 2002: dos aletas laterales a popa que actúan como timones al soltar el gas) y desde ~2009 pasó a OTAS (Off-Throttle Assisted Steering: al girar el manubrio a fondo sin gas, el sistema sube brevemente las RPM para dar algo de chorro). Es limitado frente al gobierno con gas. [confirmado: https://driveaboatusa.com/blog/steering-control-pwc/; https://www.personalwatercraft.com/?p=2257; https://www.jetdrift.com/sea-doo-opas/; https://www.machinedesign.com/news/looking-back-10202011 (resúmenes de búsqueda)]. *Corrección del juez:* el original los presentaba como "modelos nuevos" y no nombraba OTAS.
- Freno/marcha atrás en Sea-Doo moderno: iBR (Intelligent Brake & Reverse): la palanca frena desviando el chorro, arranca en un modo neutro que mantiene la moto quieta, y la misma palanca activa marcha atrás a ralentí. [confirmado: https://sea-doo.brp.com/us/en/discover/technologies/vehicle-technologies/ibr.html (resumen de búsqueda)]
- Incluso con sistema de freno, no se detienen de inmediato: dejar mucho espacio; no usar la marcha atrás para frenar a velocidad porque pueden salir despedidos los ocupantes. [confirmado: https://www.boat-ed.com/texas/studyGuide/Steering-and-Stopping-a-PWC/10104502_48122/]
- Números [estimado]: 55-100+ km/h máxima; giro muy cerrado con gas; parada con gas cortado larga (decenas de metros), con freno iBR bastante menor. Radio de giro con acelerador, ~2-3 esloras (la eslora es ~3,3 m).

---

## 3. Kayak

### 3.1 Remadas
- Remada hacia adelante: la pala entra junto a los pies y sale a la cadera; se alterna una banda y otra para ir derecho. [estimado: técnica estándar; la mecánica de alternar es de conocimiento general]
- Remada de barrido ("sweep stroke"): es el trazo principal para girar; se hace amplio, desde la proa hacia la popa; en el medio del trazo la pala está lejos a un costado y el barco gira con fuerza, incluso parado. Barrido adelante en un lado gira el kayak hacia el lado contrario. [confirmado: https://www.nswseakayaker.asn.au/page-18240 y https://www.kayarchy.com/html/02technique/001paddlingyourkayak/003sweepstrokes.htm (resumen de búsqueda)]
- Barrido en reversa ("reverse sweep"): desde la popa hacia la proa; gira hacia el mismo lado del trazo. [confirmado en parte: https://www.nswseakayaker.asn.au/page-18241; el sentido exacto es consecuencia de la mecánica; sin verificar texto completo]
- Remada atrás ("reverse stroke"): impulsa el kayak hacia atrás; útil para salir de peligros o de lugares estrechos. [confirmado: https://www.nswseakayaker.asn.au/page-18236]
- Girar inclinando el kayak ("edge") mejora el giro. [confirmado: https://www.nswseakayaker.asn.au/page-18240]
- Remada de arrastre ("draw stroke"): pala lejos del costado, se tira hacia el casco y el kayak se desplaza lateralmente hacia esa banda. [estimado: técnica estándar; no se obtuvo fuente en la búsqueda]
- Remada timón ("rudder stroke" / "stern rudder"): pala atrás, junto a la popa, como timón, sin impulsar. *Corrección del juez:* el sentido depende de lo que se haga con la pala: empujarla hacia afuera del casco (palanca) lleva la popa hacia el otro lado y la proa gira **hacia el lado de la pala**; traerla hacia el casco (tirón) gira la proa **al lado contrario**; dejarla arrastrando pasiva frena ese lado y gira levemente hacia él. [estimado: mecánica estándar; no se obtuvo fuente en la búsqueda]
- Giro por remadas alternadas desiguales: remar solo de un lado hace virar el kayak hacia el lado contrario. [estimado: consecuencia de la mecánica]

### 3.2 Cadencia y velocidad
- Cadencia en surfski (kayak de mar de carrera): crucero ~65 paladas/min, carreras de 10 millas ~80, sprint >100. Guía de entrenamiento: ~80 spm sobre 8 km, 100+ spm sobre 1 km, 130+ spm sobre 200 m. [confirmado como opinión de foro: https://forums.paddling.com/t/stroke-rate-monitor/36440 y https://surfski.info/forum/1-general/6055-ideal-cadence.html] Atención: los relojes a veces muestran "dobles paladas" (la mitad del valor). [confirmado: mismo foro]
- Velocidad recreativa en kayak de mar: ~3 nudos (5,5 km/h) fácil y ~4 nudos (7,4 km/h) rápido; otro usuario cita ~8 km/h como crucero en aguas planas, y otro ~4,8 km/h. [confirmado como opiniones de foro: https://forums.paddling.com/t/cruising-speed/17376]
- Cadencia recreativa y valor para el juego: [estimado] 40-60 paladas/min (20-30 por banda) a 4-7 km/h para paseo tranquilo; ~60-70 spm de crucero de travesía (coincide con el "~65 spm de crucero" del foro citado); picos 80+ spm a 8-10 km/h con kayak de paseo. *Corrección del juez:* el original decía que "el kayak de carrera supera los 12 km/h en sprint", lo cual subestima mucho: un K1 olímpico de elite promedia ~18-21 km/h en 200-1000 m [estimado: derivado de tiempos de regata típicos ~34-36 s en 200 m y ~3:20-3:30 en 1000 m, no verificado en esta revisión]. Para el juego no hace falta (no hay kayaks de carrera), pero el techo del kayak de paseo con un jugador "fuerte" debería quedar en ~9-10 km/h.
- Relación cadencia/velocidad: entre 50 y 85 spm la velocidad subió casi proporcional. [confirmado como anécdota: https://forums.paddling.com/t/stroke-rate-monitor/36440]
- Cada palada: aceleración y desaceleración (el barco "pulsa"). [estimado]
- Giro: radio de un kayak de paseo con barrido ~1-2 esloras; kayak largo de mar recto, más. [estimado]

---

## 4. Remo

### 4.1 Single scull (1x)
- Dos remos, uno en cada mano ("sculls"; en español "remo de par", "single" o "single scull"). *Corrección del juez:* el original decía "remos de punta", que es justamente lo contrario: "de punta" (sweep) es un solo remo por remero, de ~3,7-4 m; "de par" son dos remos por remero, de ~2,9 m. [confirmado: https://centros.edu.xunta.gal/cfrvigo/aulavirtual/mod/resource/view.php?id=10149 (resumen de búsqueda)]. No hay timón: se gobierna con presión: tirar un poco más fuerte de un lado durante una o dos paladas gira el bote lejos de esa pala. Tirar más fuerte a la izquierda gira a la derecha. *Nota del juez:* el remero mira hacia popa, así que su "izquierda" es la banda de estribor del bote. Para el juego conviene fijar el marco de referencia del bote: más fuerza en el remo de babor → la proa va a estribor (y viceversa). Así A/D se corresponde con lo que ve el jugador en pantalla (cámara mirando hacia proa). [confirmado: https://www.row2k.com/features/5589/technique-feature-steering-in-your-single/ y https://trieye.com/blogs/news/sculling-steering-hold-your-line (resumen de búsqueda)]
- Correcciones chicas y tempranas; un tirón grande de un solo lado arruina el ritmo y se pasa de la línea. [confirmado: mismas fuentes]
- Si el bote deriva siempre al mismo lado suele ser un arco desparejo. [confirmado: https://www.row2k.com/features/5589/technique-feature-steering-in-your-single/]
- El remero va de espaldas al sentido de marcha: se orienta mirando un punto fijo en popa; si se corre, está girando. [confirmado: https://trieye.com/blogs/news/sculling-steering-hold-your-line]
- Ciar ("back down"/"backing"): remar en reversa. [confirmado: https://www.rowingnews.com/backing-up-your-skills/ (resumen de búsqueda)]. Frenado: *corrección del juez:* la redacción original ("enterrar una pala plumada; con la pala cuadrada la velocidad del agua la saca") era confusa y técnicamente al revés en lo esencial. Lo que frena es la pala **cuadrada** (perpendicular al agua) metida en el agua ("hold it up"/"aguantar"); a velocidad se apoya primero plumada (de canto, entra sin violencia) y se va cuadrando progresivamente, porque cuadrarla de golpe puede arrancar el remo de las manos o dar un "cangrejo". Pala apoyada a ~30° solo frena un poco; pala plana sobre el agua, casi nada. [confirmado en parte: https://mecbc.soc.srcf.net/for-novices/jargon-buster/ (glosario de club, resumen de búsqueda); la progresión plumada→cuadrada es práctica de entrenadores, sin fuente obtenida; la fuente original citada fue https://www.row2k.com/features/5306/are-you-raceready-everything-you-should-know-before-the-starter-says-go/]. Para girar en el lugar: ciar con un remo y remar adelante con el otro. [confirmado en parte: https://www.rowingnews.com/backing-up-your-skills/]
- Cadencia: entrenamiento 24-30 paladas/min (spm), en regata generalmente algo más, usualmente por debajo de 36 [confirmado: https://www.concept2.com/products/understanding-stroke-rate; también https://www.concept2.nl/en/service/monitors/pm5/how-to-use/understanding-stroke-rate, que da 18-22 técnica, 24-28 ritmo sostenido, 30-36 intervalos/regata, 38+ elite]. *Nota del juez:* son cifras de ergómetro; en el agua los rangos son parecidos (regata 2000 m de un single de elite: ~32-38 spm). En ocho de elite, largada >45 spm y 34-40 en la mayor parte de la regata [confirmado como blog: https://augletics.com/blog/professional-rowing-strokes-per-minute-how-fast-do-elite-athletes-row/]. Concept2 reporta que en el Mundial algunos botes terminan a 47 spm. [confirmado: https://www.concept2.com.au/node/9011]
- Velocidad: elite masculino single ~6:40-7:00 en 2000 m = ~4,8-5,0 m/s (~17-18 km/h) [estimado para regatas típicas; la mejor marca mundial es 6:30,74 (R. Manson, 2017) = 5,1 m/s, confirmado: https://www.guinnessworldrecords.com/world-records/84079-fastest-row-single-sculls-male y https://en.wikipedia.org/wiki/List_of_world_best_times_in_rowing (resúmenes de búsqueda)]. *Nota del juez:* el original decía "6:50-7:00 = 4,8-4,9 m/s", pero 2000/420 s = 4,76 m/s y 2000/410 s = 4,88 m/s; se ajustó el rango. metros por palada = velocidad / (spm/60): ~9 m a 32 spm [estimado, calculado]. Elite ocho ~5:20 = ~6,2 m/s (~22 km/h), ~10 m/palada a 36 spm [estimado; la mejor marca mundial del ocho figura en 5:17,75 según https://en.wikipedia.org/wiki/List_of_world_best_times_in_rowing (resumen de búsqueda, fecha no verificada)].
- Para un remero recreativo/de club [estimado]: 18-24 spm, 2-3 m/s (7-11 km/h).
- Nota: el bote se mueve a impulsos; la velocidad sube en la propulsión (arrastre) y cae en la recuperación (~±10-15 % [estimado]). *Nota del juez:* en un single la oscilación real es mayor, del orden de ±20 % alrededor de la media (con el mínimo cerca del ataque) [estimado: conocimiento de biomecánica del remo, sin fuente obtenida]; para el juego ±15-20 % se siente bien. Una fuente indica estrategia de largada rápida: velocidad máxima en los primeros 100-150 m. [confirmado: https://ijass.sports.re.kr/v.34/2/215/722]

### 4.2 Bote de travesía (club, 4 remeros + timonel)
- Los clubes de Tigre (las fuentes hablan de unos 15 clubes históricos de remo en el Delta; la cifra varía según la fuente — corrección del juez, el original decía 16 sin respaldo; el Tigre Boat Club y Buenos Aires Rowing Club, entre los primeros) organizan travesías y regatas en el Delta. [confirmado como contexto: https://www.worldheritagesite.org/community/assif/city-of-tigre-and-its-rowing-clubs y https://es-academic.com/dic.nsf/eswiki/1121250 (resumen de búsqueda)]. No se halló ficha técnica del "bote de travesía" (eslora, peso, reglamento de la Asociación Argentina de Remeros Aficionados / CRIT). Tratar todo lo que sigue sobre su construcción como [estimado].
- Nota de nomenclatura: 4+ = cuatro con timonel; 4- = cuatro sin timonel; 4x = cuatro scull. [confirmado: https://web.mit.edu/21f.712/www/group1/remo.html (resumen de búsqueda; la fuente intermedia confundía 4- con 4+)]
- El timonel dirige y marca la cadencia a viva voz; en botes sin timonel se gobierna con un pie móvil. [confirmado: https://web.mit.edu/21f.712/www/group1/remo.html y https://centros.edu.xunta.gal/cfrvigo/aulavirtual/mod/resource/view.php?id=10149]
- Timón: el timonel gira la pala del timón hacia el lado hacia donde quiere ir la proa. [confirmado en parte: resumen de video, https://soundcloud.com/rowingchat/backing-down; coincide con la mecánica del timón de popa]
- Órdenes habituales [estimado: vocabulario de remo argentino; **sin verificar** por el juez — ninguna búsqueda devolvió un glosario de órdenes de timonel en español rioplatense]: "¡Listos!", "¡Remen!"/"¡Boga!", "¡Ciar!", "¡Alto!"/"¡Paren!", "¡Remen ambos!", "¡A babor!", "¡Cambio de ritmo!". Sugerencia del juez: agregar una orden de freno equivalente a "hold it up" (p. ej. "¡Aguanten!"/"¡Frenen!") y confirmar todo el vocabulario con un club.
- Números [estimado]: 4 remeros de punta, un remo cada uno (dos a babor y dos a estribor); cadencia de paseo 18-24 spm, de regata 30-36 spm; velocidad de travesía ~2,5-3,5 m/s (9-13 km/h). *Corrección del juez:* el original daba 3-5 m/s (11-18 km/h); 5 m/s es velocidad de un 4+ de regata de competición (la mejor marca del 4+ ronda los 6 min en 2000 m ≈ 5,6 m/s), no de un bote de travesía pesado. **Sin verificar:** si los botes de travesía de los clubes del Tigre son de punta (4+) o de par con timonel (4x+); ambos existen en remo de travesía.
- Giro: el timonel usa el timón mientras se rema, y para giros cerrados los remeros de un lado reman y los del otro cían. Radio de giro con timón: 3-5 esloras (≈ 30-60 m para un bote de ~10-12 m); en el lugar con ciar: ~1 eslora. [estimado] *Corrección del juez:* el original decía "~10-17 m", que no corresponde a 3-5 esloras de un cuatro (eso sería ~1-1,5 esloras); también se corrigió "ciaan" → "cían".

---

## 5. Propuesta para el juego

Principio de diseño: tres capas. (1) Modo arcade (existente). (2) Modo realista "asistido": misma interfaz pero con física realista (inercia, timón dependiente de velocidad, evolutivo). (3) Modo realista "manual": controles específicos por embarcación. Todos los valores son puntos de partida [estimado] y deben exponerse como constantes de ajuste por bote.

### 5.0 Física base a simular (todas las lanchas a motor)
- Modelo de 3 grados de libertad (adelante, lateral, giro) con arrastre cuadrático, masa/inercia distintas por embarcación.
- Fuerza de timón proporcional a (velocidad de flujo sobre pala)^2, con flujo = velocidad del casco + chorro de la hélice (golpe de hélice) [estimado].
- Efecto evolutivo: momento lateral de popa, grande en marcha atrás y a baja velocidad, pequeño en adelante.
- Pivote al ~33 % desde proa en adelante, que migra hacia popa en marcha atrás. [confirmado: https://www.boatblurb.com/post/quicktips-understanding-the-pivot-point-in-your-steering]
- Transmisión con retardo: pausa obligatoria en neutro y retardo de empuje antes de invertir; aceleración del motor con rampa.
- Corriente (vector, deriva) y viento (empuje sobre el área expuesta).
- Casco: desplazamiento (tope por eslora) vs planeo (transición, menos agarre lateral).

### 5.1 Lancha colectiva
- Teclado: A/D o flechas izquierda/derecha = rueda de timón (la rueda gira gradualmente, no salta: ~3 s de tope a tope); W/S = palanca de mando (sube/baja entre posiciones: Atrás toda, Atrás, Neutro, Avante, Avante toda; con detent en neutro); barra espaciadora = bocina. Un indicador de "telégrafo" opcional en pantalla con las posiciones.
- Táctil: rueda de timón virtual a la izquierda (arrastrar para girar; vuelve sola al centro si se suelta en modo asistido); palanca vertical a la derecha con escalones y un tope fijo en neutro (al cruzar neutro se exige una pausa de 1-2 s; el engrane atrás tiene retardo).
- Simular: gran inercia, parada en 3-5 esloras, radio de giro 2-3 esloras, viento/corriente fuertes en el atraque, evolutivo en marcha atrás, motor diésel con rampa lenta. Objetivo divertido: arrimar a un muelle con pasajeros y puntuación por suavidad.

### 5.2 Lanchas particulares
- Runabout fuera de borda / RIB:
  - Teclado: A/D = volante (suave); W/S = palanca única (adelante/neutro/atrás, con zona de ralentí de los primeros ~35 grados antes de acelerar); Q/E = trim (sube/baja el motor); Shift = gatillo de seguridad para salir de neutro.
  - Táctil: volante a la izquierda, palanca vertical a la derecha con zona muerta en el centro y tope en neutro; botón de trim.
  - Simular: planeo con transición (joroba de resistencia), curva con derrape y escora en planeo, gobierno por empuje del motor.
- Lancha de pesca con caña:
  - Teclado: A/D mueve la caña (proa gira al lado contrario, con indicador visual de la caña); W/S = acelerador giratorio; R = alternar cambio adelante/atrás (con pausa de neutro). Opción de "invertir caña" para quien se confunde.
  - Táctil: control deslizante horizontal para la caña, con animación de la caña moviéndose al lado opuesto al giro; acelerador deslizante vertical.
  - Simular: giro muy ágil, sensibilidad al peso, el motor orientado da empuje lateral aun a baja velocidad.
- Lancha clásica intraborda:
  - Mismo esquema que la colectiva pero más liviana; evolutivo marcado en marcha atrás, punto muerto con pausa corta.
- Moto de agua:
  - Teclado: A/D = manubrio; W (mantener) = gatillo del acelerador; S = freno/marcha atrás (iBR: toque corto frena, mantener a velocidad baja pasa a reversa); inclinación del cuerpo del piloto (Shift + A/D) para giros más cerrados.
  - Táctil: manubrio virtual o giroscopio, gatillo de acelerador a la derecha (mantener presionado), botón de freno/reversa.
  - Simular: sin gas no hay gobierno (la moto va derecha); modo opcional de gobierno sin acelerador limitado (OPAS); frenado largo; riesgo de caída si se hace marcha atrás a alta velocidad. [confirmado: https://driveaboatusa.com/blog/steering-control-pwc/, https://www.boat-ed.com/texas/studyGuide/Steering-and-Stopping-a-PWC/10104502_48122/]

### 5.3 Kayak
- Teclado: Q = pala izquierda (remada adelante), E = pala derecha; alternarlas con ritmo mantiene el rumbo; repetir la misma banda gira al lado contrario; Shift + Q/E = barrido (gira más, impulsa menos); Ctrl + Q/E = remada atrás (**juez: reemplazar, ver 5.6 punto 1; Ctrl+Q/W cierran el navegador o la pestaña**); Z/C = remada de arrastre (movimiento lateral, solo a baja velocidad); mantener pala atrás = "timón".
- Táctil: dos zonas, izquierda y derecha de la pantalla, cada una un botón de pala. Toque = remada adelante de esa banda; deslizar hacia atrás = remada atrás; deslizar en arco = barrido; mantener = timón. Un medidor de ritmo muestra la cadencia (verde en 40-70 spm; ajustado por el juez a la sección 3.2).
- Simular: pulso de propulsión por palada (velocidad ondulante), inercia y deriva, cadencia óptima para eficiencia (más cadencia = más rápido pero cansa: barra de energía), viento/corriente, giro con inclinación opcional.

### 5.4 Remo
- Single scull:
  - Teclado: espacio o A/D marca el ritmo; ciclo catch/drive/finish/recovery con barra de tiempo (el jugador toca en el momento correcto); A/D = más fuerza en la pala izquierda/derecha (el bote gira lejos de ese lado); S = ciar (marcha atrás), con freno de emergencia (enterrar pala plumada) con X.
  - Táctil: dos áreas (izquierda/derecha) que se arrastran hacia atrás en cada palada; arrastrar más fuerte en un lado gira; botón de ciar.
  - Simular: pulsos de velocidad (el bote desacelera en la recuperación), cadencia 18-32 spm, metros por palada y fatiga, deriva por viento y corriente. [estimado: decisión de diseño; la etiqueta original "confirmado: row2k" no corresponde, esa fuente solo respalda el gobierno por presión]
- Bote de travesía (4+):
  - Jugador como timonel: A/D = timón (suave), W/S = ritmo de boga (cadencia de la tripulación 18-36 spm), tecla/botón "¡Ciar!" y "¡Alto!" que mandan la orden y la tripulación responde con retardo de 1-2 paladas; "¡A babor!" para girar con remeros de un lado ciando.
  - Opción de jugador como remero (stroke) marcando el ritmo con el botón de remada.
  - Simular: la tripulación sincronizada (calidad de sincronía reduce velocidad si el ritmo es irregular), timón con efecto proporcional a la velocidad, giro cerrado solo con ciar de un lado.

### 5.5 Accesibilidad y diversión
- Modo "asistido" por defecto en táctil: mantiene el timón centrado al soltar, limita la deriva, atenúa el evolutivo (un 50 %), y avisa con indicadores cuando se va a pasar.
- Indicadores de aprendizaje: flecha del vector de movimiento (distinta de la proa), anillo de radio de giro, indicador de pausa de neutro.
- Misiones que premian lo realista: atracar con evolutivo, frenar a tiempo, navegar con corriente, remar en línea recta.

### 5.6 Observaciones del juez (viabilidad en celular y teclado)
1. **Combinaciones con Ctrl en el navegador (kayak, 5.3): no usar.** Ctrl+W cierra la pestaña, Ctrl+Q cierra el navegador en Linux/Firefox, Ctrl+E/Ctrl+D enfocan la barra de direcciones o agregan marcador, y no se pueden cancelar de forma fiable con `preventDefault`. Propuesta: Q/E = remada adelante, A/D = remada atrás de cada banda, mantener Shift + Q/E = barrido, Z/C = arrastre, mantener Q/E sin soltar = timón de esa banda. Evitar también Alt (abre menús) y Tab.
2. **Conflicto de teclas en el single (5.4):** "espacio o A/D marca el ritmo" y "A/D = más fuerza en una pala" se pisan. Propuesta: Espacio (o W) = palada en el momento justo; mantener A o D durante la palada = más presión en el remo de babor/estribor; S = ciar; X = freno (palas que se cuadran progresivamente mientras se mantiene). Definir A/D en el marco del bote (ver nota en 4.1) para que coincida con la pantalla.
3. **Gatillo de neutro con Shift (runabout):** en teclado agrega una tecla sin aportar decisión; se sugiere que el detent de neutro sea automático (pausa de 0,5-1 s al cruzar neutro) y dejar el gatillo solo en el modo "manual". En táctil, un toque largo sobre la palanca en neutro reemplaza al gatillo.
4. **Palanca de la colectiva con 5 escalones en W/S:** bien para teclado. En táctil, hacer la palanca continua con "imanes" en las posiciones del telégrafo y vibración háptica al pasar por neutro (`navigator.vibrate`, no disponible en iOS Safari: prever indicador visual).
5. **Rueda/volante virtual + palanca a dos pulgares:** viable en horizontal. Los controles deben ser multitáctiles independientes (cada uno sigue su propio `pointerId`), con zonas de al menos ~48 px y fuera de las áreas de gesto del sistema (bordes inferiores en iOS/Android). La rueda arrastrada en círculo es imprecisa en pantallas chicas: ofrecer como alternativa un deslizador horizontal con retorno al centro en modo asistido.
6. **Kayak táctil con gestos (toque, deslizar atrás, arco, mantener):** cuatro gestos por pulgar es mucho para distinguir de forma fiable a 60 spm (una palada por banda cada ~2 s). Propuesta: toque = remada adelante; mantener = timón; deslizar hacia arriba = remada atrás; el barrido se obtiene automáticamente cuando el bote va lento o con un botón modificador. Medidor de ritmo: verde en 40-70 spm (ajustado a 3.2).
7. **Giroscopio en moto de agua:** dejarlo opcional y desactivado por defecto; en iOS requiere permiso explícito (`DeviceOrientationEvent.requestPermission`) tras un gesto del usuario.
8. **Remo 4+ como timonel:** muy adecuado para celular (pocas entradas, decisiones tácticas). Sugerencia: retardo de la tripulación de 1-2 paladas visible con un ícono de "orden recibida".
9. **Coherencia de constantes:** usar los valores corregidos (pausa de neutro 1-3 s en la colectiva, parada 25-50 m desde 12 km/h, velocidad máxima de la colectiva ~17 km/h, travesía de remo 2,5-3,5 m/s) como valores iniciales de las constantes por bote.
10. **Escala de tiempo:** varias maniobras reales (frenar una colectiva, 20-30 s) pueden resultar lentas en un juego de celular; prever un multiplicador global de inercia en el modo asistido en lugar de cambiar cada constante.

---

## Fuentes principales utilizadas (resumen)
- Prop walk: https://riggingdoctor.com/life-aboard/2016/8/23/prop-walk ; https://riggingdoctor.com/life-aboard/2016/8/24/how-bad-will-my-prop-walk-be ; https://sailmagazine.com/cruising/walking-the-prop/ ; https://en.wikipedia.org/wiki/Propeller_walk
- Frenado y pivote: https://powerboating-blog.nauticed.org/the-art-of-stopping-a-boat/ ; https://www.boatblurb.com/post/quicktips-understanding-the-pivot-point-in-your-steering ; https://www.vesseloperations.org/class-blog/2017/10/5/pivot-points
- Controles fuera de borda: https://manualslib.mx/manual/83843/Yamaha-60F.html?page=34 ; https://manuals.buster.fi/content/GUID-5B400DEC-AFB4-48A2-AC25-7333D4E3AA25/1.0.0.2026-06-09T090445Z/en/GUID-8423FFE3-D3C2-4E6B-81F3-A6735B4ACFEF.html
- Caña del timón: https://www.boats.com/how-to/boating-tips-how-to-use-a-tiller-steer-outboard ; https://www.epropulsion.com/post/tiller-outboard-motors/
- Moto de agua: https://driveaboatusa.com/blog/steering-control-pwc/ ; https://www.boat-ed.com/texas/studyGuide/Steering-and-Stopping-a-PWC/10104502_48122/ ; https://sea-doo.brp.com/us/en/discover/technologies/vehicle-technologies/ibr.html
- Kayak: https://www.nswseakayaker.asn.au/page-18240 ; https://www.nswseakayaker.asn.au/page-18236 ; https://www.kayarchy.com/html/02technique/001paddlingyourkayak/003sweepstrokes.htm ; https://forums.paddling.com/t/cruising-speed/17376 ; https://forums.paddling.com/t/stroke-rate-monitor/36440
- Remo: https://www.row2k.com/features/5589/technique-feature-steering-in-your-single/ ; https://trieye.com/blogs/news/sculling-steering-hold-your-line ; https://www.rowingnews.com/backing-up-your-skills/ ; https://www.concept2.com/products/understanding-stroke-rate ; https://ijass.sports.re.kr/v.34/2/215/722 ; https://web.mit.edu/21f.712/www/group1/remo.html
- Terminología de mando (español): https://consultas2.oepm.es/pdf/ES/0000/000/00/15/68/ES-0156815_A3.pdf ; https://patents.google.com/patent/IT1011894B/en:Method
- Colectivas del Tigre (contexto): https://www.lanacion.com.ar/salud/salidas-en-catamaran-entre-canales-y-vegetacion-frondosa-para-internarse-en-otro-mundo-nid01032025/
- Agregadas por el juez: https://www.interempresas.net/Nautica/536932-Torqeedo-participa-en-la-iniciativa-EcoLancha.html ; https://www.iprofesional.com/negocios/389390-asi-es-la-primera-lancha-ecologica-fabricada-en-la-argentina ; https://manualslib.mx/manual/87945/Yamaha-2B.html?page=32 ; https://www.jetdrift.com/sea-doo-opas/ ; https://www.machinedesign.com/news/looking-back-10202011 ; https://mecbc.soc.srcf.net/for-novices/jargon-buster/ ; https://www.concept2.nl/en/service/monitors/pm5/how-to-use/understanding-stroke-rate ; https://www.guinnessworldrecords.com/world-records/84079-fastest-row-single-sculls-male ; https://en.wikipedia.org/wiki/List_of_world_best_times_in_rowing ; https://centros.edu.xunta.gal/cfrvigo/aulavirtual/mod/resource/view.php?id=10149 ; https://www.worldheritagesite.org/tentative/id/6288 ; https://consultas2.oepm.es/pdf/ES/0000/000/00/19/10/ES-0191093_A3.pdf (todas vistas solo como resumen de búsqueda)

## Pendientes recomendados
1. Entrevistar a un lanchero colectivo o ver fotos de timonera: confirmar rueda vs. caña, tipo de comando, existencia de telégrafo, motor y eslora reales.
2. Buscar manuales oficiales (Yamaha/Mercury/Volvo Penta) y el manual del Sea-Doo para citar página; los números de pausa en neutro y retardo de empuje son [estimado].
3. Pedir a la Asociación Argentina de Remeros Aficionados / clubes del Tigre la ficha del bote de travesía.
4. Medir distancias de frenado reales (pruebas de mar) para calibrar las constantes de la sección 0.5.
