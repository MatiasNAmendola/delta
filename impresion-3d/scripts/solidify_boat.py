#!/usr/bin/env python3
"""Fill the boat cabin and hull interior while retaining the external model.

Default: read-only validation. --write: create the new solid-body STL.
--preview: write before/after section evidence and exterior/cut previews.
Exit codes: 0 pass, 1 findings, 2 error. Run from any working directory.
"""
import argparse
import json
from pathlib import Path
import tempfile
import sys

import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import Polygon
import trimesh

import fill_boat_roof as roof
from render_boat_stl import render

SOURCE = roof.OUTPUT
SOURCE_SHA256 = "80b6c5f1b214c91df6d52b9e48c5d5d66f057b0775a9e030f906aaa85ff6e74a"
OUTPUT = roof.ROOT / "modelos/lancha-optimized-print-ready-solid-body-no-mast-93mm.stl"
DOCS = roof.ROOT / "docs"


def cores(parts):
    # Two local roof footprints retain the narrowing bow and curved side outline.
    # Extend each existing curved roof solid down to the hull's solid side band.
    # A global boat convex hull would erase the keel, tires and deck shape.
    result = []
    for hull in roof.roof_solids(parts):
        bottom = hull.vertices.copy()
        bottom[:, 2] = 10.0
        result.append(trimesh.convex.convex_hull(np.vstack([hull.vertices, bottom])))
    return result


def fill(source, interior):
    result = trimesh.boolean.union([source, *interior], engine="manifold")
    result = trimesh.boolean.difference([result, roof.mast_cutter()], engine="manifold")
    # Filling the cabin seals the pockets below the new core. Removing inward
    # cavity shells makes those pockets solid too, down to the original floor.
    return trimesh.util.concatenate([p for p in result.split() if p.volume > 0])


def section_region(mesh, level, axis=2):
    origin = np.zeros(3)
    normal = np.zeros(3)
    origin[axis] = level
    normal[axis] = 1
    path = mesh.section(plane_origin=origin, plane_normal=normal)
    region = Polygon()
    if path is not None:
        for loop in path.discrete:
            polygon = Polygon(np.delete(loop, axis, axis=1)).buffer(0)
            region = region.symmetric_difference(polygon)
    return region


def polygons(region):
    if region.geom_type == "Polygon":
        return [region] if not region.is_empty else []
    return [p for p in region.geoms if p.geom_type == "Polygon"]


def validate(source, result, interior, output_path=OUTPUT):
    findings = []
    solids = result.split()
    edge_counts = np.bincount(result.edges_unique_inverse)
    if not result.is_watertight or not result.is_winding_consistent or np.any(edge_counts != 2):
        findings.append("Surface is not closed, oriented and manifold")
    if len(solids) != 1 or solids[0].volume <= 0:
        findings.append("Expected one solid with no separate inward cavity shells")
    if not np.allclose(result.bounds, source.bounds, atol=1e-5):
        findings.append("External bounds changed")
    sections = []
    for z in [5.0, 8.0, 9.5, 12.0, 15.0, 17.0]:
        actual = section_region(result, z)
        largest = max(polygons(actual), key=lambda p: p.area)
        if z < min(core.bounds[0, 2] for core in interior):
            # The original lower hull outline must be filled, including seat gaps.
            expected = Polygon(max(polygons(section_region(source, z)), key=lambda p: p.area).exterior)
        else:
            expected = Polygon()
            for core in interior:
                expected = expected.union(section_region(core, z))
        missing = expected.difference(actual).area
        if missing > 0.001:
            findings.append(f"Interior not filled at z={z}")
        sections.append({"z_mm": z, "body_area_mm2": largest.area,
                         "missing_interior_area_mm2": missing})
    with np.errstate(divide="ignore", invalid="ignore"):
        mast_volume = float(trimesh.boolean.intersection([result, roof.mast_cutter()], engine="manifold").volume)
    if abs(mast_volume) > 1e-6:
        findings.append("Mast region contains geometry")
    return {
        "status": "PASS" if not findings else "FAIL",
        "findings": findings,
        "original_sha256": roof.digest(roof.SOURCE),
        "roof_only_sha256": roof.digest(SOURCE),
        "output_sha256": roof.digest(output_path),
        "watertight": bool(result.is_watertight),
        "winding_consistent": bool(result.is_winding_consistent),
        "non_manifold_edges": int(np.count_nonzero(edge_counts != 2)),
        "closed_surface_components": len(solids),
        "bounds_mm": result.bounds.tolist(),
        "volume_mm3": float(result.volume),
        "previous_volume_mm3": float(source.volume),
        "remaining_mast_volume_mm3": mast_volume,
        "section_area_tolerance_mm2": 0.001,
        "sections": sections,
    }


def previews(source, result, output_path=OUTPUT, prefix="lancha-solid-body"):
    render(output_path, DOCS / f"{prefix}-no-mast.png")
    half = trimesh.boolean.intersection([
        result, trimesh.creation.box(bounds=[[-30, -60, -1], [0, 60, 40]])
    ], engine="manifold")
    with tempfile.TemporaryDirectory(prefix="delta-solid-cut-") as temporary:
        path = Path(temporary) / "cut.stl"
        half.export(path)
        render(path, DOCS / f"{prefix}-cut.png")
    canvas = Image.new("RGB", (1250, 790), "#f8f8f8")
    draw = ImageDraw.Draw(canvas)
    for mesh, offset, title, color in [
        (source, 80, "ANTES - techo cerrado, cabina hueca", "#89a6b4"),
        (result, 440, "AHORA - casco y cabina macizos", "#dc9d50"),
    ]:
        draw.text((65, offset - 40), title, fill="#172e3b", font_size=25)
        draw.text((65, offset - 7), "Corte longitudinal central. El color representa material.", fill="#425b68", font_size=19)
        region = section_region(mesh, 0, axis=0)
        def coordinates(points):
            return [(65 + (y + 47) * 12, offset + 310 - z * 12) for y, z in points]
        for polygon in polygons(region):
            draw.polygon(coordinates(polygon.exterior.coords), fill=color, outline="#425b68")
            for hole in polygon.interiors:
                draw.polygon(coordinates(hole.coords), fill="#f8f8f8")
    canvas.save(DOCS / f"{prefix}-sections.png")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    try:
        _, parts = roof.source_parts()
        if roof.digest(SOURCE) != SOURCE_SHA256:
            raise ValueError("Roof-only STL changed; inspect before rebuilding")
        source = trimesh.load_mesh(SOURCE)
        interior = cores(parts)
        if args.write:
            fill(source, interior).export(OUTPUT)
        result = trimesh.load_mesh(OUTPUT)
        report = validate(source, result, interior)
        if args.preview:
            previews(source, result)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0 if report["status"] == "PASS" else 1
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
