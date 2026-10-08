#!/usr/bin/env python3
"""Deterministic orthographic STL preview with a real depth buffer.

Usage: python scripts/render_boat_stl.py input.stl output.png
No interactive graphics context required. Does not alter the mesh.
"""
import argparse

import numpy as np
from PIL import Image
import trimesh


def render(source, target, view_vector=(0.57, -0.55, 0.61), focus=None, scale=12):
    mesh = trimesh.load_mesh(source)
    width = height = 1200
    view = np.array(view_vector, dtype=float)
    view /= np.linalg.norm(view)
    right = np.cross([0, 0, 1], view)
    right /= np.linalg.norm(right)
    up = np.cross(view, right)
    vertices = mesh.vertices @ np.stack([right, up, view]).T
    if focus is not None:
        vertices -= np.asarray(focus) @ np.stack([right, up, view]).T
    # Fixed framing makes before/after directly comparable.
    vertices[:, :2] *= scale
    vertices[:, 0] += width / 2
    vertices[:, 1] = height / 2 + (100 if focus is None else 0) - vertices[:, 1]
    depth = np.full((height, width), -np.inf)
    pixels = np.full((height, width, 3), 248, dtype=np.uint8)
    light = np.array([-0.3, -0.6, 0.74])
    light /= np.linalg.norm(light)
    colors = np.array([169, 194, 206])[None, :] * (
        0.4 + 0.6 * np.clip(mesh.face_normals @ light, 0, 1)
    )[:, None]
    for indices, color in zip(mesh.faces, colors):
        triangle = vertices[indices]
        xmin = max(0, int(np.floor(triangle[:, 0].min())))
        xmax = min(width - 1, int(np.ceil(triangle[:, 0].max())))
        ymin = max(0, int(np.floor(triangle[:, 1].min())))
        ymax = min(height - 1, int(np.ceil(triangle[:, 1].max())))
        if xmin > xmax or ymin > ymax:
            continue
        x, y = np.meshgrid(np.arange(xmin, xmax + 1) + 0.5, np.arange(ymin, ymax + 1) + 0.5)
        a, b, c = triangle
        denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(denominator) < 1e-10:
            continue
        u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator
        v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator
        w = 1 - u - v
        z = u * a[2] + v * b[2] + w * c[2]
        region = depth[ymin:ymax + 1, xmin:xmax + 1]
        visible = (u >= -1e-8) & (v >= -1e-8) & (w >= -1e-8) & (z > region)
        region[visible] = z[visible]
        pixels[ymin:ymax + 1, xmin:xmax + 1][visible] = color
    Image.fromarray(pixels).save(target)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("target")
    args = parser.parse_args()
    render(args.source, args.target)
