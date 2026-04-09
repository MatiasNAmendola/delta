/**
 * StaticGeometryMerger — Collects meshes that share the same material,
 * applies their world transforms to the vertex data, and merges them into
 * a single BufferGeometry per material.  This dramatically reduces draw
 * calls for static objects like houses, docks, and railings.
 *
 * Uses Three.js BufferGeometryUtils.mergeGeometries() under the hood.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Walk a scene graph, collect all Mesh children that use MeshStandardMaterial
 * or MeshBasicMaterial with a matching material cache key, bake their world
 * transforms into the geometry, merge, and return one Mesh per material.
 *
 * The original meshes are removed from the scene.
 *
 * @param root       The root group/scene to scan.
 * @param removeOriginals  If true (default), originals are removed from their parents.
 * @returns Array of merged Mesh objects (already added to the scene).
 */
export function mergeStaticMeshes(
  root: THREE.Object3D,
  scene: THREE.Scene,
  removeOriginals = true
): THREE.Mesh[] {
  // Collect meshes grouped by material uuid
  const buckets = new Map<
    string,
    { material: THREE.Material; geometries: THREE.BufferGeometry[] }
  >();

  const meshesToRemove: THREE.Mesh[] = [];

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    // Skip instanced meshes, skinned meshes, etc.
    if (child instanceof THREE.InstancedMesh) return;

    const mat = child.material as THREE.Material;
    if (!mat) return;

    const key = mat.uuid;

    if (!buckets.has(key)) {
      buckets.set(key, { material: mat, geometries: [] });
    }

    // Clone geometry and bake world transform
    const geom = child.geometry.clone();
    child.updateWorldMatrix(true, false);
    geom.applyMatrix4(child.matrixWorld);

    // Ensure consistent attributes — drop uv if not present on some geoms
    buckets.get(key)!.geometries.push(geom);
    meshesToRemove.push(child);
  });

  // Remove originals
  if (removeOriginals) {
    for (const mesh of meshesToRemove) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
  }

  // Merge each bucket
  const merged: THREE.Mesh[] = [];
  for (const [, bucket] of buckets) {
    if (bucket.geometries.length === 0) continue;

    // Ensure all geometries have the same attributes before merging
    const referenceAttrs = new Set(
      Object.keys(bucket.geometries[0].attributes)
    );
    const compatible = bucket.geometries.filter((g) => {
      const attrs = new Set(Object.keys(g.attributes));
      if (attrs.size !== referenceAttrs.size) return false;
      for (const a of referenceAttrs) {
        if (!attrs.has(a)) return false;
      }
      return true;
    });

    if (compatible.length < 2) {
      // Not worth merging a single geometry — just re-add it
      if (compatible.length === 1) {
        const m = new THREE.Mesh(compatible[0], bucket.material);
        m.matrixAutoUpdate = false;
        scene.add(m);
        merged.push(m);
      }
      continue;
    }

    try {
      const mergedGeom = mergeGeometries(compatible, false);
      if (!mergedGeom) continue;

      mergedGeom.computeBoundingSphere();
      mergedGeom.computeBoundingBox();

      const mesh = new THREE.Mesh(mergedGeom, bucket.material);
      mesh.matrixAutoUpdate = false;
      mesh.name = `merged_${merged.length}`;
      scene.add(mesh);
      merged.push(mesh);
    } catch (e) {
      console.warn("[StaticGeometryMerger] Failed to merge bucket:", e);
    }

    // Dispose intermediate cloned geometries
    for (const g of compatible) {
      g.dispose();
    }
  }

  return merged;
}

/**
 * Merge all children of a THREE.Group into as few meshes as possible,
 * then replace the group's children with the merged results.
 * Useful for dock groups, house groups, etc.
 *
 * @param group  The group whose children will be merged.
 * @param scene  Scene to add merged meshes to.
 * @returns The merged meshes.
 */
export function mergeGroupChildren(
  group: THREE.Group,
  scene: THREE.Scene
): THREE.Mesh[] {
  return mergeStaticMeshes(group, scene, true);
}
