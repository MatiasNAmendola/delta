#!/usr/bin/env python3
"""Replace only the two upper roof skins with finely tessellated clean surfaces.

Default: read-only validation. --write creates a new STL; --preview renders it.
The awning bridge underside, brackets, windscreen and all earlier STLs remain.
"""
import argparse
import io
import json
import sys

import numpy as np
from scipy.spatial import Delaunay
from shapely.geometry import MultiPoint, Point
import trimesh

import fill_boat_roof as roof
import brace_boat_awning as awning
from render_boat_stl import render
from solidify_boat import DOCS

SOURCE = awning.OUTPUT
SOURCE_SHA = "06ef397c42ecb674ae6b7a83888139b941e207205992685247becf285a2dabeb"
OUTPUT = roof.ROOT / "modelos/lancha-optimized-print-ready-smooth-roof-braced-awning-no-mast-93mm.stl"
GRID_MM = 0.5


def height(xy, front=False):
    x, y = xy.T
    # Low continuous crown, with the original downward slope toward the stern.
    if front:
        seam = -29.25
        return 20.45 - 0.012 * seam + 0.0001 * seam**2 - 0.0042 * (x - 0.055)**2 + 0.176 * (y - seam)
    return 20.45 - 0.012 * y + 0.0001 * y**2 - 0.0042 * (x - 0.055)**2


def panel(polygon, base, front=False, cutter=False):
    minx, miny, maxx, maxy = polygon.bounds
    points = list(polygon.exterior.coords[:-1])
    for x in np.arange(minx, maxx, GRID_MM):
        for y in np.arange(miny, maxy, GRID_MM):
            if polygon.contains(Point(x, y)):
                points.append((x, y))
    xy = np.unique(np.asarray(points), axis=0)
    faces = Delaunay(xy).simplices.copy()
    cross = np.cross(np.column_stack([xy[faces[:, 1]] - xy[faces[:, 0]], np.zeros(len(faces))]),
                     np.column_stack([xy[faces[:, 2]] - xy[faces[:, 0]], np.zeros(len(faces))]))[:, 2]
    faces[cross < 0] = faces[cross < 0][:, ::-1]
    n = len(xy)
    top = np.full(n, 40.0) if cutter else height(xy, front)
    vertices = np.vstack([np.column_stack([xy, top]), np.column_stack([xy, np.full(n, base)])])
    edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    _, indices, counts = np.unique(np.sort(edges, axis=1), axis=0, return_index=True, return_counts=True)
    side = []
    for a, b in edges[indices[counts == 1]]:
        side.extend([[a, b + n, b], [a, a + n, b + n]])
    mesh = trimesh.Trimesh(vertices, np.vstack([faces, faces[:, ::-1] + n, side]))
    mesh.fix_normals()
    return mesh


def geometry(parts):
    masks, panels = [], []
    fixture = trimesh.creation.box(bounds=[[-1.3, -31.7, 17], [1.3, -29.0, 40]])
    for index, base in [(18, 19.25), (19, 18.5)]:
        polygon = MultiPoint(parts[index].vertices[:, :2]).convex_hull.buffer(-0.1, join_style=2)
        cap = panel(polygon, base, index == 19)
        mask = panel(polygon, base, index == 19, cutter=True)
        if index == 19:
            cap = trimesh.boolean.difference([cap, fixture], engine="manifold")
            mask = trimesh.boolean.difference([mask, fixture], engine="manifold")
        panels.append(cap)
        masks.append(mask)
    return masks, panels


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    try:
        if roof.digest(SOURCE) != SOURCE_SHA:
            raise ValueError("Latest awning source changed; inspect before rebuilding")
        _, parts = roof.source_parts()
        source = trimesh.load_mesh(SOURCE)
        masks, panels = geometry(parts)
        if args.write:
            result = trimesh.boolean.difference([source, *masks], engine="manifold")
            result = trimesh.boolean.union([result, *panels], engine="manifold")
            # Boolean contact fans can share a position but not a topological
            # vertex. STL readers merge those into four-face edges. Separate only
            # those roof contacts by 0.0002 mm toward each fan's interior, avoiding
            # a global repair that would change untouched brackets or hull details.
            _, inverse, counts = np.unique(np.round(result.vertices, 8), axis=0,
                                           return_inverse=True, return_counts=True)
            coincident = counts[inverse] > 1
            direction = np.zeros_like(result.vertices)
            for corner in range(3):
                np.add.at(direction, result.faces[:, corner],
                          result.triangles_center - result.vertices[result.faces[:, corner]])
            direction /= np.maximum(np.linalg.norm(direction, axis=1), 1e-15)[:, None]
            result.vertices[coincident] += direction[coincident] * 0.0002
            result = trimesh.load_mesh(io.BytesIO(result.export(file_type="stl")), file_type="stl")
            if not result.is_volume:
                raise ValueError("STL contact repair failed; source geometry was not modified")
            result.export(OUTPUT)
        result = trimesh.load_mesh(OUTPUT)
        findings = []
        if not result.is_volume or len(result.split()) != 1:
            findings.append("Expected one watertight consistently oriented solid")
        if not np.allclose(result.bounds, source.bounds, atol=1e-5):
            findings.append("External bounds changed")
        # No edits below the front roof skin: includes the bridge plane at 18.2.
        protected = trimesh.creation.box(bounds=[[-30, -60, -1], [30, 60, 18.49]])
        with np.errstate(invalid="ignore", divide="ignore"):
            added = trimesh.boolean.difference([result, source], engine="manifold")
            removed = trimesh.boolean.difference([source, result], engine="manifold")
            change_below = sum(float(trimesh.boolean.intersection([m, protected], engine="manifold").volume)
                               for m in [added, removed] if len(m.faces))
        if abs(change_below) > 0.01:
            findings.append("Protected bridge/body region changed")
        report = {"status": "PASS" if not findings else "FAIL", "findings": findings,
                  "source_sha256": roof.digest(SOURCE), "output_sha256": roof.digest(OUTPUT),
                  "watertight": bool(result.is_watertight), "winding_consistent": bool(result.is_winding_consistent),
                  "components": len(result.split()), "faces": len(result.faces),
                  "volume_mm3": float(result.volume), "surface_grid_mm": GRID_MM,
                  "changed_volume_below_18_49mm_mm3": change_below,
                  "protected_region_volume_tolerance_mm3": 0.01,
                  "method": "Replace upper skins with quadratic crown and raked forward canopy; no global smoothing"}
        if args.preview:
            render(OUTPUT, DOCS / "lancha-smooth-roof.png")
            render(OUTPUT, DOCS / "lancha-smooth-roof-front.png", view_vector=(0.5, -0.8, 0.35),
                   focus=(0, -31, 13), scale=33)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0 if report["status"] == "PASS" else 1
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
