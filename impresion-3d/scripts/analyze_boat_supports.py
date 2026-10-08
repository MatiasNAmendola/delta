#!/usr/bin/env python3
"""Read-only geometric screening of printing orientations and hypothetical cuts.

No STL is changed or cut. This does not estimate slicer-generated support volume.
Downward surface areas use a 45-degree screening threshold, not a print guarantee.
Hypothetical cut surface scores use triangle centroids, hence are approximate.
"""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

import numpy as np
import trimesh

from solidify_boat import section_region

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "modelos/lancha-optimized-print-ready-solid-body-recessed-windows-no-mast-93mm.stl"


def main():
    mesh = trimesh.load_mesh(SOURCE)
    threshold = -np.sqrt(0.5)
    def area(axis, sign, minimum):
        selected = ((mesh.face_normals[:, axis] * sign < threshold)
                    & (mesh.triangles_center[:, axis] * sign > minimum + 0.2))
        return float(mesh.area_faces[selected].sum())
    downward = ((mesh.face_normals[:, 2] < threshold)
                & (mesh.triangles_center[:, 2] > 0.2))
    patches = sorted(mesh.submesh([np.flatnonzero(downward)], append=True).split(
        only_watertight=False), key=lambda p: p.area, reverse=True)
    orientations = []
    for name, axis, sign in [("upright", 2, 1), ("roof_down", 2, -1),
                             ("left_side_down", 0, 1), ("right_side_down", 0, -1),
                             ("bow_down", 1, 1), ("stern_down", 1, -1)]:
        orientations.append({"orientation": name, "screened_downward_area_mm2": area(
            axis, sign, float(np.min(mesh.vertices[:, axis] * sign))),
            "print_height_mm": float(mesh.extents[axis])})
    flat_bases = []
    for height in [0.01, 0.2, 0.5, 1.0, 2.0, 3.0, 4.0, 4.5]:
        region = section_region(mesh, height)
        flat_bases.append({"hypothetical_cut_z_mm": height,
                           "section_contact_area_mm2": region.area,
                           "section_bounds_xy_mm": list(region.bounds),
                           "remaining_screened_area_mm2_approx": area(2, 1, height)})
    historical = []
    for path in sorted((ROOT / "modelos").glob("*.3mf")):
        with zipfile.ZipFile(path) as archive:
            name = "Metadata/project_settings.config"
            if name in archive.namelist():
                config = json.loads(archive.read(name))
                keys = ["printer_model", "printer_variant", "filament_type", "layer_height",
                        "enable_support", "support_type", "support_threshold_angle"]
                historical.append({"file": path.name, "settings": {
                    key: config.get(key) for key in keys}, "current_setup_confirmed": False})
    report = {
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "method": "45-degree downward-face area; ignores first 0.2 mm above each hypothetical bed",
        "limitations": ["Not sliced; no support volume or print-success claim",
                        "Area score does not measure stability, bridges, cooling or support accessibility",
                        "Hypothetical cut screening uses triangle centroids; no mesh cut performed"],
        "current_exact_planar_bed_contact_area_mm2": float(mesh.area_faces[
            np.max(mesh.triangles[:, :, 2], axis=1) < 1e-5].sum()),
        "orientations": orientations,
        "largest_upright_downward_patches": [
            {"area_mm2": float(p.area), "bounds_mm": p.bounds.tolist()} for p in patches[:12]],
        "hypothetical_flat_bases": flat_bases,
        "hypothetical_longitudinal_halves": {
            "split_plane": "x=0; each cut face rests on bed",
            "right_half_screened_area_mm2_approx": area(0, 1, 0),
            "left_half_screened_area_mm2_approx": area(0, -1, 0),
            "cut_face_area_mm2": section_region(mesh, 0, axis=0).area},
        "historical_3mf_settings": historical,
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(2)
