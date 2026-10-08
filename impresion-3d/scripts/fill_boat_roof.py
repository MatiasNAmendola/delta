#!/usr/bin/env python3
"""Close the reinforced boat roof and remove its flag mast, preserving the source.

Default is read-only validation. --write explicitly regenerates the new STL.
Exit codes: 0 valid, 1 validation findings, 2 input/dependency/runtime error.
Coordinates are the source STL's millimetres; the source hash guards selections.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
import pymeshfix
import trimesh

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "modelos/lancha-optimized-print-ready-reinforced-93mm.stl"
OUTPUT = ROOT / "modelos/lancha-optimized-print-ready-solid-roof-no-mast-93mm.stl"
SOURCE_SHA256 = "e04367b89f6ac8428eb74045ac80222d512faa5ded543bcd24f0daeece218651"
ROOF_VOLUME_TOLERANCE_MM3 = 0.001  # Float32 STL/Boolean surface roundoff.


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_parts():
    if digest(SOURCE) != SOURCE_SHA256:
        raise ValueError("Source STL changed; inspect geometry before reusing selections")
    source = trimesh.load_mesh(SOURCE)
    parts = source.split(only_watertight=False)
    if len(parts) != 27:
        raise ValueError("Unexpected source component layout")
    return source, parts


def mast_cutter():
    # All original mast, stays and flags lie inside this region above the roof.
    return trimesh.creation.box(bounds=[[-7, -21, 20.8], [7, -10, 40]])


def roof_solids(parts):
    # Existing main and forward roof reinforcements define curved roof envelopes.
    # Convexification fills perforations without filling the passenger cabin.
    return [parts[18].convex_hull, parts[19].convex_hull]


def build(parts):
    # Original main surface has one edge shared by four faces. Repair that surface
    # before booleans; retain other solids (keel, frames and interior detail).
    repair = pymeshfix.MeshFix(parts[0].vertices, parts[0].faces)
    repair.repair(joincomp=False, remove_smallest_components=False)
    base = trimesh.Trimesh(repair.points, repair.faces)
    keep = [base] + [p for p in parts[1:24] if len(p.faces) > 2 and p.is_volume]
    # Components 24–26 are mast/flag reinforcements; the cutter also removes their
    # underlying source geometry from the main surface.
    result = trimesh.boolean.union(keep + roof_solids(parts), engine="manifold")
    result = trimesh.boolean.difference([result, mast_cutter()], engine="manifold")
    # Negative-volume shells are sealed microcavities in the original roof.
    # Discarding their inward boundaries makes the roof fully solid. Preserve
    # both positive solids, including the pre-existing separate interior detail.
    return trimesh.util.concatenate([p for p in result.split() if p.volume > 0])


def validate(source, parts, result):
    findings = []
    if not result.is_watertight or not result.is_winding_consistent:
        findings.append("Surface is not closed with consistent winding")
    counts = np.bincount(result.edges_unique_inverse)
    if np.any(counts != 2):
        findings.append("Non-manifold edges")
    if not np.allclose(source.bounds[:, :2], result.bounds[:, :2], atol=1e-5):
        findings.append("Hull footprint changed")
    if abs(result.bounds[0, 2]) > 1e-6:
        findings.append("Print bed origin changed")
    mast_remaining = trimesh.boolean.intersection([result, mast_cutter()], engine="manifold")
    with np.errstate(divide="ignore", invalid="ignore"):
        mast_volume = float(mast_remaining.volume)
    if abs(mast_volume) > 1e-6:
        findings.append("Geometry remains inside removed mast region")
    expected_roof = trimesh.boolean.union(roof_solids(parts), engine="manifold")
    expected_roof = trimesh.boolean.difference([expected_roof, mast_cutter()], engine="manifold")
    missing_roof = trimesh.boolean.difference([expected_roof, result], engine="manifold")
    if abs(missing_roof.volume) > ROOF_VOLUME_TOLERANCE_MM3:
        findings.append("Roof envelope is not completely filled")
    components = result.split()
    if len(components) != 2 or any(c.volume <= 0 for c in components):
        findings.append("Unexpected separate solids or enclosed cavities")
    return {
        "status": "PASS" if not findings else "FAIL",
        "source_sha256": digest(SOURCE),
        "output_sha256": digest(OUTPUT),
        "bounds_mm": result.bounds.tolist(),
        "faces": len(result.faces),
        "watertight": bool(result.is_watertight),
        "winding_consistent": bool(result.is_winding_consistent),
        "non_manifold_edges": int(np.count_nonzero(counts != 2)),
        "positive_solids": len(components),
        "solid_volumes_mm3": sorted([float(c.volume) for c in components], reverse=True),
        "missing_roof_volume_mm3": float(missing_roof.volume),
        "roof_volume_tolerance_mm3": ROOF_VOLUME_TOLERANCE_MM3,
        "remaining_mast_volume_mm3": mast_volume,
        "findings": findings,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Generate the new STL, then validate it")
    args = parser.parse_args()
    try:
        source, parts = source_parts()
        if args.write:
            build(parts).export(OUTPUT)
        report = validate(source, parts, trimesh.load_mesh(OUTPUT))
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0 if report["status"] == "PASS" else 1
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
