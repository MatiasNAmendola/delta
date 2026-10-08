#!/usr/bin/env python3
"""Candidate awning with two lateral arch brackets and a level bridge underside.

Default validates existing output read-only. --write creates a separate candidate
STL; --preview writes the front view. Geometry screening is not a slicing result.
"""
import argparse
import io
import json
import sys

import numpy as np
from shapely.geometry import LineString, Point
import trimesh

import fill_boat_roof as roof
import recess_boat_windows as windows
from solidify_boat import section_region, DOCS
from render_boat_stl import render

SOURCE = windows.OUTPUT
SOURCE_SHA = "5f43ce2bf937912b09e3064b674bb8a65609054649aa80988de8423c51f355be"
OUTPUT = roof.ROOT / "modelos/lancha-optimized-print-ready-braced-awning-no-mast-93mm.stl"
BRIDGE_Z = 18.2
RIB_WIDTH = 0.9


def additions(parts):
    canopy = parts[19].convex_hull
    floor = canopy.vertices.copy()
    floor[:, 2] = BRIDGE_Z
    plate = trimesh.convex.convex_hull(np.vstack([
        canopy.vertices[canopy.vertices[:, 2] >= BRIDGE_Z], floor]))
    brackets = []
    for sign in [-1, 1]:
        front = np.array([sign * 6.02, -39.03])
        rear = np.array([sign * 9.95, -31.0])
        delta = rear - front
        normal = np.array([-delta[1], delta[0]]) / np.linalg.norm(delta)
        # Each side grows inward from the front pillar and rear windshield frame.
        # The rising lower edges meet before the bridge layer begins.
        for stations, bottoms in [([0, 0.5], [13.5, 18.0]), ([0.5, 1], [18.0, 13.5])]:
            points = []
            for t, bottom in zip(stations, bottoms):
                xy = front + t * delta
                for offset in [-RIB_WIDTH / 2, RIB_WIDTH / 2]:
                    for z in [bottom, 18.3 + 1.8 * t]:
                        points.append([*(xy + offset * normal), z])
            brackets.append(trimesh.convex.convex_hull(np.asarray(points)))
    return plate, brackets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    try:
        if roof.digest(SOURCE) != SOURCE_SHA:
            raise ValueError("Approved source changed; inspect before rebuilding")
        _, parts = roof.source_parts()
        source = trimesh.load_mesh(SOURCE)
        plate, brackets = additions(parts)
        if args.write:
            candidate = trimesh.boolean.union([source, plate, *brackets], engine="manifold")
            candidate = trimesh.util.concatenate([c for c in candidate.split() if c.volume > 0])
            candidate = trimesh.load_mesh(io.BytesIO(candidate.export(file_type="stl")), file_type="stl")
            if not candidate.is_volume:
                repair = roof.pymeshfix.MeshFix(candidate.vertices, candidate.faces)
                repair.repair(joincomp=False, remove_smallest_components=False)
                candidate = trimesh.Trimesh(repair.points, repair.faces)
            candidate.export(OUTPUT)
        result = trimesh.load_mesh(OUTPUT)
        findings = []
        if not result.is_volume or len(result.split()) != 1:
            findings.append("Expected one closed, consistently oriented solid")
        if not np.allclose(result.bounds, source.bounds, atol=1e-5):
            findings.append("External bounds changed")
        contact_volumes = []
        low_band = trimesh.creation.box(bounds=[[-20, -45, 13.5], [20, -25, 14.0]])
        for bracket in brackets:
            contact = trimesh.boolean.intersection([source, bracket, low_band], engine="manifold")
            with np.errstate(invalid="ignore", divide="ignore"):
                contact_volumes.append(float(contact.volume))
        if any(v <= 1e-5 for v in contact_volumes):
            findings.append("Bracket foot does not overlap an existing support")
        with np.errstate(invalid="ignore", divide="ignore"):
            removed = float(trimesh.boolean.difference([source, result], engine="manifold").volume)
        # STL quantization at the canopy union creates tiny non-manifold slivers;
        # their local repair is allowed a small, explicitly reported volume budget.
        if abs(removed) > 0.02:
            findings.append("Original geometry removed")
        # Illustrative 0.12 mm layer advance: sections around the new underside.
        below = section_region(result, BRIDGE_Z - 0.12)
        above = section_region(result, BRIDGE_Z + 0.01)
        newly_spanning = above.difference(below)
        spans = []
        for y in np.linspace(-38.4, -31.2, 13):
            crossing = newly_spanning.intersection(LineString([[-16, y], [16, y]]))
            segments = [crossing] if crossing.geom_type == "LineString" else list(getattr(crossing, "geoms", []))
            for line in segments:
                if line.geom_type != "LineString" or line.length <= 1:
                    continue
                a, b = sorted(line.coords, key=lambda p: p[0])[::len(line.coords) - 1]
                anchored = (below.buffer(0.03).covers(Point(a[0] - 0.02, y))
                            and below.buffer(0.03).covers(Point(b[0] + 0.02, y)))
                spans.append({"y_mm": float(y), "clear_span_mm": line.length,
                              "supported_at_both_sides": bool(anchored)})
        slope = np.linalg.norm([3.93, 8.03]) / 2 / 4.5
        report = {
            "status": "PASS" if not findings else "FAIL", "findings": findings,
            "source_sha256": roof.digest(SOURCE), "output_sha256": roof.digest(OUTPUT),
            "watertight": bool(result.is_watertight), "winding_consistent": bool(result.is_winding_consistent),
            "components": len(result.split()), "volume_mm3": float(result.volume),
            "added_volume_mm3": float(result.volume - source.volume),
            "original_removed_mm3": removed, "bracket_foot_contact_mm3": contact_volumes,
            "local_repair_volume_budget_mm3": 0.02,
            "bracket_width_mm": RIB_WIDTH, "flat_bridge_underside_z_mm": BRIDGE_Z,
            "arch_horizontal_advance_per_0_12mm_layer": float(slope * 0.12),
            "arch_lower_edge_angle_from_vertical_deg": float(np.degrees(np.arctan(slope))),
            "sampled_transverse_bridges": spans,
            "max_sampled_bridge_mm": max((s["clear_span_mm"] for s in spans), default=0),
            "sliced": False,
            "limitation": "Candidate for PLA bridging; not a no-support guarantee. Hull support needs unchanged.",
        }
        if args.preview:
            render(OUTPUT, DOCS / "lancha-braced-awning-front.png",
                   view_vector=(0.5, -0.8, 0.35), focus=(0, -31, 13), scale=33)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0 if report["status"] == "PASS" else 1
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
