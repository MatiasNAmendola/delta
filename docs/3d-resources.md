# Recursos 3D Externos — Catálogo Completo

Este documento cataloga todos los repositorios y fuentes de assets 3D gratuitos
que se pueden usar en el proyecto Delta. Los assets se clonan en `resources/`
(ignorado por git) para evitar inflar el repositorio.

---

## 1. BabylonJS Assets (sucesor de MeshesLibrary)

- **Repo**: https://github.com/BabylonJS/Assets
- **CDN**: https://assets.babylonjs.com/
- **Licencia**: Creative Commons Attribution 4.0 (CC BY 4.0)
- **Estado**: Activo, 415+ commits

### Cómo clonar
```bash
git clone https://github.com/BabylonJS/Assets.git resources/babylonjs-assets
```

### Estructura de directorios
| Directorio | Contenido |
|---|---|
| `meshes/` | 132+ modelos 3D (GLB, .babylon, OBJ) |
| `textures/` | Texturas PBR, normales, etc. |
| `environments/` | Entornos HDR/EXR |
| `skyboxes/` | Cubemaps para cielos |
| `particles/` | Sistemas de partículas |
| `sound/` | Archivos de audio |
| `sprites/` | Sprites 2D |
| `mixamo/` | Animaciones Mixamo pre-convertidas |
| `materials/` | Definiciones de materiales |
| `fonts/` | Tipografías |
| `ibl/` | Image-Based Lighting |
| `photoDomes/` | Fotos 360° |
| `luts/` | Color Lookup Tables |

### Modelos relevantes para Delta (meshes/)
| Modelo | Formato | Uso potencial |
|---|---|---|
| `HVGirl.glb` | GLB | Personaje femenino animado (pasajera) |
| `Xbot.glb` | GLB | Personaje masculino animado (pasajero) |
| `Dude/` | .babylon | Personaje humano con animaciones walk/idle |
| `fish.glb` | GLB | Pez para el río |
| `seagulf.glb` | GLB | Gaviota para ambiente |
| `shark.glb` | GLB | Fauna acuática |
| `Bee.glb` | GLB | Abeja para vegetación |
| `octopus_customRig.glb` | GLB | Fauna acuática |
| `aerobatic_plane.glb` | GLB | Referencia vehículo |
| `blackPearl.glb` | GLB | Barco/embarcación de referencia |
| `ufo.glb` | GLB | Easter egg |
| `village/` | GLB | Escena de pueblo completa |
| `valleyvillage/` | GLB | Valle con pueblo |
| `both_houses_scene/` | GLB | Casas de referencia |
| `car.glb` | GLB | Vehículo de referencia |
| `babylonBuoy.glb` | GLB | Boya para el río |
| `bowlingBall.glb` | GLB | Objetos varios |

---

## 2. Open Source 3D Assets (CC0)

- **Web**: https://www.opensource3dassets.com/
- **Repo**: https://github.com/ToxSam/open-source-3D-assets
- **Licencia**: CC0 (dominio público, sin atribución requerida)
- **Cantidad**: 991+ modelos GLB

### Cómo clonar
```bash
git clone https://github.com/ToxSam/open-source-3D-assets.git resources/opensource-3d-assets
```

### Estructura
- `projects.json` — Lista maestra de colecciones
- `assets/*.json` — Archivos JSON por colección con URLs de descarga directa

### Colecciones disponibles (Polygonal Mind - CC0)
| Colección | Descripción | Uso potencial |
|---|---|---|
| **MomusPark** | Assets de parque | Vegetación, bancos, farolas |
| **abm** | Museo blockchain/ethereum | Arquitectura, muebles |
| **aero-system** | Tránsito sci-fi | Props futuristas |
| **avatar-garden** | Paisajes estilo Gauguin | Plantas, jardines |
| **avatar-show** | Muebles de entrevista | Mobiliario |
| **ca-world** | Arquitectura clásica/mansión | Casas, columnas |
| **christmas** | Decoraciones navideñas | Seasonal |
| **chromatic-chaos** | Estética vaporwave 80s | Props retro |
| **cryptoavatars-retro-booth** | Calle japonesa 80s | Arquitectura asiática |
| **crystal-crossroads** | Ruinas surrealistas (Moebius) | Decoración |
| **lunar-year** | Año nuevo asiático | Props festivos |
| **medieval-fair** | Estructuras/puestos medievales | Muelles, puestos |
| **tomb-chaser-1** | Pirámides egipcias | Ambiente |
| **tomb-chaser-2** | Pagoda japonesa neón | Props |
| **towers** | Instalaciones de galería de arte | Estructuras |
| **transit** | Estaciones retro-futuristas | Estaciones, muelles |
| **trash-polka** | Estética graffiti | Decoración urbana |
| **xyz** | **60 criaturas texturizadas y rigged** | **Fauna, personajes** |

---

## 3. Khronos glTF Sample Assets

- **Repo**: https://github.com/KhronosGroup/glTF-Sample-Assets
- **Licencia**: Variada por modelo (mayormente CC0, CC-BY)
- **Cantidad**: 80+ modelos de referencia

### Cómo clonar
```bash
git clone https://github.com/KhronosGroup/glTF-Sample-Assets.git resources/gltf-samples
```

### Modelos destacados
| Modelo | Descripción |
|---|---|
| Cesium Man | Humano con skinning y animaciones |
| Cesium Milk Truck | Camión con múltiples meshes y animaciones |
| Brain Stem | Animaciones complejas con skins |
| Barramundi Fish | Pez con features core |
| A Beautiful Game | Ajedrez con transmisión y volumen |
| Flight Helmet | Casco detallado PBR |
| Avocado | Objeto natural con PBR |

---

## 4. BabylonJS MeshesLibrary (archivo/legacy)

- **Repo**: https://github.com/BabylonJS/MeshesLibrary (ARCHIVADO)
- **CDN**: https://models.babylonjs.com/
- **Licencia**: CC BY 4.0
- **Nota**: Migrado a BabylonJS/Assets (punto 1). Usar el CDN para acceso rápido.

### Acceso vía CDN (sin clonar)
```typescript
// Cargar modelo directo desde CDN en BabylonJS
SceneLoader.ImportMeshAsync("", "https://models.babylonjs.com/", "shark.glb", scene);
```

### Modelos en CDN
Alien, Bee, Chair, CornellBox, Dude, Skull, aerobatic_plane, boombox,
fish, flightHelmet, haunted_house, pirateFort, seagulf, shark, ufo,
vintageDeskFan, y más.

---

## 5. Herramientas de Creación de Avatares

### ReadyPlayerMe
- **Web**: https://readyplayer.me/
- **SDK npm**: `@readyplayerme/rpm-react-sdk`
- **Licencia**: CC BY-NC 4.0 (gratis solo no-comercial, comercial requiere plan pago)
- **Output**: GLB con morph targets
- **BabylonJS**: [Demo con animaciones](https://github.com/crazyramirez/readyplayer-talk)
- **Animaciones**: Combinar con Mixamo vía Blender → GLB

### VRoid Studio
- **Web**: https://vroid.com/en/studio
- **Licencia**: Gratis, sin restricciones comerciales
- **Output**: VRM (renombrar a .glb para cargar directo)
- **Estilo**: Anime/estilizado
- **Ideal para**: Juegos con estética estilizada

### MakeHuman
- **Web**: https://www.makehumancommunity.org/
- **Licencia**: AGPL (open source completo)
- **Output**: MakeHuman → Blender → GLB
- **Estilo**: Realista

### Mesh2Motion
- **Web**: https://mesh2motion.org/
- **Licencia**: Gratis personal y comercial
- **Función**: Exporta múltiples animaciones Mixamo a un solo GLB
- **Ideal para**: Empaquetar idle + walk + sit en un solo archivo

---

## 6. Animaciones (Mixamo)

- **Web**: https://www.mixamo.com/ (Adobe, gratis)
- **Docs BabylonJS**: https://doc.babylonjs.com/features/featuresDeepDive/Exporters/Mixamo_to_Babylon

### Workflow
1. Subir personaje a Mixamo (o usar los incluidos)
2. Seleccionar animaciones (Idle, Walking, Sitting, Waving)
3. Descargar como FBX
4. Importar en Blender → combinar en una sola timeline → exportar GLB
5. O usar **Mesh2Motion** para exportar directo a GLB

### Animaciones relevantes para pasajeros de lancha
- `Idle` — parado esperando
- `Sitting Idle` — sentado en la lancha
- `Waving` — saludando al subir/bajar
- `Walking` — caminando en el muelle

---

## Setup rápido

```bash
# Desde la raíz del proyecto:
mkdir -p resources

# Clonar los repos de assets (están en .gitignore)
git clone --depth 1 https://github.com/BabylonJS/Assets.git resources/babylonjs-assets
git clone --depth 1 https://github.com/ToxSam/open-source-3D-assets.git resources/opensource-3d-assets
git clone --depth 1 https://github.com/KhronosGroup/glTF-Sample-Assets.git resources/gltf-samples

# Los modelos que se usen se copian a public/models/ para servir con Vite
cp resources/babylonjs-assets/meshes/fish.glb public/models/
cp resources/babylonjs-assets/meshes/seagulf.glb public/models/
```
