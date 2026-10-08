#!/usr/bin/env python3
"""Shorten the smooth awning to the windscreen, remove rejected arches/front posts.

Default read-only validation. --write creates a new variant; --preview renders it.
No earlier STL is overwritten. Geometric screening is not a slicer guarantee.
"""
import argparse
import io
import json
import sys

import numpy as np
import trimesh

import smooth_boat_roof as smooth
import recess_boat_windows as windows
from render_boat_stl import render
from solidify_boat import section_region, DOCS

OUTPUT = smooth.roof.ROOT / "modelos/lancha-optimized-print-ready-short-awning-smooth-roof-no-mast-93mm.stl"
REFERENCE_SHA = "37798da154170aa4c79885875fdfc8b2476e8d4653c60d590609ee213148e3ea"
FRONT_Y = -30.0


def build(parts):
    # Reconstruct the approved smooth shell from the pre-arch source, so removing
    # arches cannot cut into original windscreen/deck geometry at their anchors.
    source = trimesh.load_mesh(windows.OUTPUT)
    masks, panels = smooth.geometry(parts)
    base = trimesh.boolean.union([trimesh.boolean.difference([source, *masks], engine="manifold"), *panels], engine="manifold")
    # Sloping lower cut follows the canopy, instead of chopping windscreen frames
    # with a horizontal box below the actual roof.
    points = []
    for x in [-20, 20]:
        for y in [-50, FRONT_Y]:
            for z in [17.5 + (y + 39) / 6, 40]:
                points.append([x, y, z])
    cuts = [trimesh.convex.convex_hull(np.asarray(points))]
    for x in [-6.02, 6.06]:
        cuts.append(trimesh.creation.box(bounds=[[x - .65, -39.7, 12.9], [x + .65, -38.4, 18.1]]))
    base = trimesh.boolean.difference([base, *cuts], engine="manifold")
    # Solid bevel anchored inside the cabin: widens and advances gradually toward
    # the short roof edge, including the side corners. No long transverse bridge.
    points = [[-8.7, -28.5, 17.6], [8.7, -28.5, 17.6], [-10.1, -26.5, 17.6], [10.1, -26.5, 17.6]]
    for y in np.linspace(FRONT_Y, -26.5, 8):
        width = 10.8 + (y + 30) / 3.5 * 1.4
        for x in np.linspace(-width, width, 45):
            points.append([x, y, float(smooth.height(np.array([[x, y]]), front=y < -29.25)[0])])
    bevel = trimesh.convex.convex_hull(np.asarray(points))
    result = trimesh.boolean.union([base, bevel], engine="manifold")
    _, inverse, counts = np.unique(np.round(result.vertices, 8), axis=0, return_inverse=True, return_counts=True)
    selected = counts[inverse] > 1
    direction = np.zeros_like(result.vertices)
    for corner in range(3):
        np.add.at(direction, result.faces[:, corner], result.triangles_center - result.vertices[result.faces[:, corner]])
    direction /= np.maximum(np.linalg.norm(direction, axis=1), 1e-15)[:, None]
    result.vertices[selected] += direction[selected] * .0002
    result = trimesh.load_mesh(io.BytesIO(result.export(file_type="stl")), file_type="stl")
    # Cutting the canopy releases its disconnected old lip and microscopic Boolean
    # fragments. Keep the connected boat, not floating remnants of removed parts.
    with np.errstate(invalid="ignore", divide="ignore"):
        result = max(result.split(only_watertight=False), key=lambda c: c.volume)
    return result, bevel


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    try:
        if smooth.roof.digest(smooth.OUTPUT) != REFERENCE_SHA:
            raise ValueError("Latest approved roof reference changed")
        _, parts = smooth.roof.source_parts()
        reference = trimesh.load_mesh(smooth.OUTPUT)
        candidate, bevel = build(parts)
        if args.write:
            candidate.export(OUTPUT)
        result = trimesh.load_mesh(OUTPUT)
        findings = []
        if not result.is_volume or len(result.split()) != 1:
            findings.append("Expected one closed oriented solid")
        if not np.allclose(result.bounds[:, :2], reference.bounds[:, :2], atol=1e-5):
            findings.append("Hull footprint changed")
        body = windows.cores(parts)[0]
        samples = []
        for z in [19.0, 19.5, 20.0]:
            cabin_front = section_region(body, z).bounds[1]
            samples.append({"z_mm": z, "cabin_core_front_y_mm": cabin_front,
                            "roof_leading_edge_y_mm": FRONT_Y,
                            "forward_projection_from_core_mm": max(0, cabin_front - FRONT_Y)})
        # The added bevel's bottom must already rest in solid cabin material.
        anchor = section_region(bevel, 17.6001)
        approved_body = section_region(trimesh.load_mesh(windows.OUTPUT), 17.59)
        unsupported_anchor_area = anchor.difference(approved_body).area
        if unsupported_anchor_area > 0.001:
            findings.append("Bevel foundation extends outside existing cabin material")
        report = {"status": "PASS" if not findings else "FAIL", "findings": findings,
                  "reference_sha256": smooth.roof.digest(smooth.OUTPUT),
                  "output_sha256": smooth.roof.digest(OUTPUT),
                  "watertight": bool(result.is_watertight), "winding_consistent": bool(result.is_winding_consistent),
                  "components": len(result.split()), "volume_mm3": float(result.volume),
                  "old_canopy_front_y_mm": float(parts[19].bounds[0, 1]),
                  "new_canopy_front_y_mm": FRONT_Y,
                  "length_removed_mm": FRONT_Y - float(parts[19].bounds[0, 1]),
                  "remaining_projection_samples": samples,
                  "bevel_anchor_area_not_overlapping_cabin_mm2": unsupported_anchor_area,
                  "sliced": False, "limitation": "Short bevel supported by cabin; small original recess under central roof accessory remains. Requires slicer verification, especially roof edges/accessory. Hull support unchanged."}
        if args.preview:
            render(OUTPUT, DOCS / "lancha-short-awning-front.png", view_vector=(.5, -.8, .35), focus=(0, -31, 13), scale=33)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0 if report["status"] == "PASS" else 1
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
