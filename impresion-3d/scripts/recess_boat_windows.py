#!/usr/bin/env python3
"""Create a solid boat with recessed window backing and original visible frames.

Default read-only verification; --write creates a separate STL; --preview creates
exterior, longitudinal-cut and close front comparison images. No prior STL changes.
"""
import argparse
import json
import sys

import numpy as np
from shapely.geometry import MultiPoint
import trimesh

import fill_boat_roof as roof
import solidify_boat as body
from render_boat_stl import render

OUTPUT = roof.ROOT / "modelos/lancha-optimized-print-ready-solid-body-recessed-windows-no-mast-93mm.stl"
INSET_MM = 1.0


def cores(parts):
    result = []
    # The forward canopy covers an exterior foredeck, not the passenger cabin.
    # Filling its footprint hides the true windscreen behind the forward pillars.
    for index, hull in enumerate(roof.roof_solids(parts)[:1]):
        # Inset the plan footprint before lowering it: the prior full roof
        # footprint buried the frames and straightened the front window profile.
        inset = MultiPoint(hull.vertices[:, :2]).convex_hull.buffer(-INSET_MM, join_style=2)
        xy = np.asarray(inset.exterior.coords[:-1])
        prism = trimesh.convex.convex_hull(np.vstack([
            np.column_stack([xy, np.zeros(len(xy))]),
            np.column_stack([xy, np.full(len(xy), 40)])]))
        top = trimesh.boolean.intersection([hull, prism], engine="manifold")
        bottom = top.vertices.copy()
        bottom[:, 2] = 8.5
        # The real windscreen is behind the canopy's front pillars. Extend only
        # the lower leading edge of the main cabin core to follow that rake,
        # leaving the exterior foredeck under the canopy open as in the source.
        front_weight = np.clip((-25.0 - bottom[:, 1]) / 3.4, 0, 1)
        bottom[:, 0] *= 1.0 - 0.12 * front_weight
        bottom[:, 1] -= 6.1 * front_weight
        result.append(trimesh.convex.convex_hull(np.vstack([top.vertices, bottom])))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    try:
        _, parts = roof.source_parts()
        if roof.digest(body.SOURCE) != body.SOURCE_SHA256:
            raise ValueError("Roof-only source changed; inspect before rebuilding")
        source = trimesh.load_mesh(body.SOURCE)
        interior = cores(parts)
        if args.write:
            body.fill(source, interior).export(OUTPUT)
        result = trimesh.load_mesh(OUTPUT)
        report = body.validate(source, result, interior, output_path=OUTPUT)
        with np.errstate(divide="ignore", invalid="ignore"):
            removed = float(trimesh.boolean.difference([source, result], engine="manifold").volume)
        report["original_material_removed_mm3"] = removed
        report["original_material_tolerance_mm3"] = 0.005
        report["roof_footprint_inset_mm"] = INSET_MM
        if abs(removed) > 0.005:
            report["findings"].append("Original frame/hull material removed")
            report["status"] = "FAIL"
        if args.preview:
            body.previews(source, result, output_path=OUTPUT, prefix="lancha-recessed-windows")
            for path, name in [(body.SOURCE, "front-original"), (OUTPUT, "front-corrected")]:
                render(path, body.DOCS / f"lancha-{name}.png",
                       view_vector=(0.5, -0.8, 0.35), focus=(0, -31, 13), scale=33)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0 if report["status"] == "PASS" else 1
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
