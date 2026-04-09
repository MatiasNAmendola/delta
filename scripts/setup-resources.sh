#!/bin/bash
# Download external 3D asset repositories for the Delta project
# These are cloned into resources/ (gitignored) to avoid bloating the repo.
# See docs/3d-resources.md for full catalog.

set -e

RESOURCES_DIR="$(cd "$(dirname "$0")/.." && pwd)/resources"
mkdir -p "$RESOURCES_DIR"

echo "=== Downloading 3D asset repositories ==="
echo "Target: $RESOURCES_DIR"
echo ""

# 1. BabylonJS Assets (meshes, textures, skyboxes, animations)
if [ ! -d "$RESOURCES_DIR/babylonjs-assets" ]; then
  echo "[1/3] Cloning BabylonJS/Assets (meshes, textures, skyboxes)..."
  git clone --depth 1 https://github.com/BabylonJS/Assets.git "$RESOURCES_DIR/babylonjs-assets"
else
  echo "[1/3] BabylonJS/Assets already exists, skipping."
fi

# 2. Open Source 3D Assets (991+ CC0 models)
if [ ! -d "$RESOURCES_DIR/opensource-3d-assets" ]; then
  echo "[2/3] Cloning ToxSam/open-source-3D-assets (991+ CC0 models)..."
  git clone --depth 1 https://github.com/ToxSam/open-source-3D-assets.git "$RESOURCES_DIR/opensource-3d-assets"
else
  echo "[2/3] open-source-3D-assets already exists, skipping."
fi

# 3. Khronos glTF Sample Assets (80+ reference models)
if [ ! -d "$RESOURCES_DIR/gltf-samples" ]; then
  echo "[3/3] Cloning KhronosGroup/glTF-Sample-Assets (80+ reference models)..."
  git clone --depth 1 https://github.com/KhronosGroup/glTF-Sample-Assets.git "$RESOURCES_DIR/gltf-samples"
else
  echo "[3/3] glTF-Sample-Assets already exists, skipping."
fi

echo ""
echo "=== Done! ==="
echo ""
echo "Available resources:"
echo "  $RESOURCES_DIR/babylonjs-assets/meshes/   - BabylonJS models (GLB)"
echo "  $RESOURCES_DIR/opensource-3d-assets/       - CC0 asset catalog (JSON + URLs)"
echo "  $RESOURCES_DIR/gltf-samples/Models/       - Khronos reference models"
echo ""
echo "To use a model in the game, copy it to public/models/:"
echo "  cp $RESOURCES_DIR/babylonjs-assets/meshes/fish.glb public/models/"
echo ""
echo "See docs/3d-resources.md for the full catalog."
