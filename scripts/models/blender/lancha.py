"""
Lancha colectiva (Tigre Delta wooden bus-boat), modeled procedurally in
headless Blender after reference photos: long varnished mahogany hull with
a red bottom and white boot stripe, open passenger cabin of varnished posts
with rolled white canvas curtains, teal roof with a rail and luggage,
windshield at the front, Argentine flag at the bow, tires as fenders and
life rings at the stern.

    .venv-blender/bin/python scripts/models/blender/lancha.py public/models [--render]

Game units (1 unit ~ 1 m at prop scale). Waterline at z = 0. The bow points
to Blender -Y, which becomes Babylon +Z (the boat's forward) through glTF.
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import beam, box, cyl, export_game_asset, material, render_preview, reset  # noqa: E402

RENDER = "--render" in sys.argv
OUT = [a for a in sys.argv[1:] if not a.startswith("--")][-1]

reset()

VARNISH = material("caoba", (0.36, 0.13, 0.05), 0.35, noise_scale=5, noise_amt=0.55, stripes=14)
VARNISH_LIGHT = material("caoba_clara", (0.55, 0.27, 0.1), 0.35, noise_scale=6, noise_amt=0.5, stripes=10)
RED = material("antiincrustante", (0.62, 0.06, 0.05), 0.55)
WHITE = material("blanco", (0.85, 0.85, 0.82), 0.45)
ROOF = material("techo_verde", (0.2, 0.55, 0.5), 0.6)
CANVAS = material("lona", (0.88, 0.86, 0.8), 0.9, noise_scale=20, noise_amt=0.2)
GLASS = material("vidrio", (0.08, 0.12, 0.14), 0.05, metallic=0.3)
RUBBER = material("goma", (0.04, 0.04, 0.04), 0.9)
ORANGE = material("salvavidas", (0.95, 0.35, 0.08), 0.6)
CELESTE = material("celeste", (0.45, 0.7, 0.92), 0.7)
GOLD = material("dorado", (0.85, 0.65, 0.2), 0.3, metallic=0.8)
LUGGAGE = material("equipaje", (0.12, 0.16, 0.3), 0.8)

LENGTH = 7.0   # stern (+Y) to bow (-Y)
BEAM = 1.7
DRAFT = 0.32
STATIONS = 44
# Height bands of the paint scheme: red bottom up to the waterline, then a
# white boot stripe. Rows are placed exactly on these heights at every
# station so the bands come out as clean lines along the whole hull.
WATERLINE = 0.12   # top of the red bottom: it shows above the water, the boat rides light
BOOT_TOP = 0.19
BOTTOM_ROWS, BOOT_ROWS, TOP_ROWS = 6, 1, 10
ROWS = BOTTOM_ROWS + BOOT_ROWS + TOP_ROWS

# ---------- hull lines ----------
def half_beam(s):
    """Half-beam at the sheer, s = 0 at the transom, 1 at the stem."""
    if s < 0.62:
        return BEAM / 2 * (0.86 + 0.14 * math.sin(s / 0.62 * math.pi / 2))
    t = (s - 0.62) / 0.38
    return BEAM / 2 * max(0.0, 1 - t ** 1.9) ** 0.75


def sheer(s):
    """Deck edge height: a gentle sweep up to a raised bow."""
    return 0.55 + 0.05 * (1 - s) ** 2 + 0.28 * max(0.0, (s - 0.55) / 0.45) ** 2


def keel(s):
    """Keel depth: flat run, the forefoot rising into the stem."""
    return -DRAFT + 0.22 * max(0.0, (s - 0.78) / 0.22) ** 2


def y_at(s):
    return LENGTH / 2 - s * LENGTH


def t_at_height(s, z):
    """Section parameter where the hull reaches height z at station s."""
    k, sh = keel(s), sheer(s)
    return min(1.0, max(0.0, (z - k) / (sh - k))) ** (1 / 1.25)


def row_t(s, j):
    """t of row j at station s: bottom rows up to the waterline, then the stripe, then topsides."""
    t1, t2 = t_at_height(s, WATERLINE), t_at_height(s, BOOT_TOP)
    if j <= BOTTOM_ROWS:
        return t1 * j / BOTTOM_ROWS
    if j <= BOTTOM_ROWS + BOOT_ROWS:
        return t1 + (t2 - t1) * (j - BOTTOM_ROWS) / BOOT_ROWS
    return t2 + (1 - t2) * (j - BOTTOM_ROWS - BOOT_ROWS) / TOP_ROWS


def section(s, t, side):
    """Point on the hull: t = 0 keel, 1 sheer; round bilge, slight flare."""
    hb = half_beam(s)
    k, sh = keel(s), sheer(s)
    x = hb * math.sin(t * math.pi / 2) ** 0.55
    z = k + (sh - k) * t ** 1.25
    return Vector((side * x, y_at(s), z))


def build_hull():
    """Loft the hull from cross-sections; bands colored by height."""
    bm = bmesh.new()
    grid = {}
    for side in (1, -1):
        for i in range(STATIONS + 1):
            s = i / STATIONS
            for j in range(ROWS + 1):
                grid[(side, i, j)] = bm.verts.new(section(s, row_t(s, j), side))
    faces = []
    for side in (1, -1):
        for i in range(STATIONS):
            for j in range(ROWS):
                q = [grid[(side, i, j)], grid[(side, i + 1, j)], grid[(side, i + 1, j + 1)], grid[(side, i, j + 1)]]
                if side < 0:
                    q.reverse()
                try:
                    f = bm.faces.new(q)
                except ValueError:
                    continue  # degenerate at the stem
                f.material_index = 2 if j < BOTTOM_ROWS else (1 if j < BOTTOM_ROWS + BOOT_ROWS else 0)
                faces.append(f)
    # Transom (stern, s = 0) closes the hull
    transom = [grid[(1, 0, j)] for j in range(ROWS + 1)] + [grid[(-1, 0, j)] for j in range(ROWS, -1, -1)]
    faces.append(bm.faces.new(transom))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    mesh = bpy.data.meshes.new("casco")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("casco", mesh)
    bpy.context.scene.collection.objects.link(obj)
    for m in (VARNISH, WHITE, RED):
        mesh.materials.append(m)
    for poly in mesh.polygons:
        poly.use_smooth = True
    split_by_material(obj)


def split_by_material(obj):
    """Exporter joins by an object's first material: split multi-material objects."""
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
    for o in bpy.context.selected_objects:
        used = {p.material_index for p in o.data.polygons}
        keep = o.data.materials[used.pop()] if used else o.data.materials[0]
        o.data.materials.clear()
        o.data.materials.append(keep)


build_hull()

# White rub rail along the sheer, both sides
for side in (1, -1):
    for i in range(STATIONS):
        s0, s1 = i / STATIONS, (i + 1) / STATIONS
        a = section(s0, 1, side) + Vector((side * 0.025, 0, -0.03))
        b = section(s1, 1, side) + Vector((side * 0.025, 0, -0.03))
        beam(f"defensa_{side}_{i}", a, b, 0.05, WHITE)

# ---------- deck and cabin ----------
CABIN_S0, CABIN_S1 = 0.07, 0.76          # cabin from near the stern to the wheelhouse
BULWARK = 0.88                            # top of the varnished side panel (seat back height)
ROOF_Z = 1.55
POST = 0.06

def cabin_half(s):
    return half_beam(s) - 0.04

# Deck planking (bow and stern) and cabin floor
for s0, s1, z in ((0.0, CABIN_S0, None), (CABIN_S1, 0.97, None)):
    n = 6 if s1 - s0 > 0.1 else 2
    for k in range(n):
        sa = s0 + (s1 - s0) * k / n
        sb = s0 + (s1 - s0) * (k + 1) / n
        sm = (sa + sb) / 2
        w = half_beam(sm) * 2 - 0.08
        if w <= 0.05:
            continue
        box(f"cubierta_{sa:.2f}", (w, abs(y_at(sb) - y_at(sa)) + 0.01, 0.04), (0, y_at(sm), sheer(sm) - 0.02), VARNISH_LIGHT, bevel=0)

# Side panels below the windows
for side in (1, -1):
    stations = [CABIN_S0 + (CABIN_S1 - CABIN_S0) * k / 12 for k in range(13)]
    for a, b in zip(stations, stations[1:]):
        m = (a + b) / 2
        x = side * cabin_half(m)
        length = abs(y_at(b) - y_at(a))
        height = BULWARK - sheer(m)
        box(f"borda_{side}_{a:.2f}", (0.04, length + 0.01, height), (x, y_at(m), sheer(m) + height / 2), VARNISH, bevel=0)

# Posts and window sills: the forest of varnished uprights of the photos
posts = [CABIN_S0 + (CABIN_S1 - CABIN_S0) * k / 16 for k in range(17)]
for side in (1, -1):
    for k, s in enumerate(posts):
        x = side * cabin_half(s)
        box(f"parante_{side}_{k}", (POST, POST, ROOF_Z - BULWARK), (x, y_at(s), (ROOF_Z + BULWARK) / 2), VARNISH_LIGHT)
    for a, b in zip(posts, posts[1:]):
        m = (a + b) / 2
        box(f"alfeizar_{side}_{a:.2f}", (0.09, abs(y_at(b) - y_at(a)) + 0.01, 0.04), (side * cabin_half(m), y_at(m), BULWARK + 0.02), VARNISH_LIGHT, bevel=0)

# Stern bulkhead with a door opening, and the wheelhouse front with windshield
y_back = y_at(CABIN_S0)
hb_back = cabin_half(CABIN_S0)
for side in (1, -1):
    box(f"popa_panel_{side}", (hb_back - 0.35, 0.05, ROOF_Z - sheer(CABIN_S0)), (side * (hb_back + 0.35) / 2, y_back, (ROOF_Z + sheer(CABIN_S0)) / 2), VARNISH)
y_front = y_at(CABIN_S1)
hb_front = cabin_half(CABIN_S1)
box("frente_bajo", (hb_front * 2, 0.05, BULWARK - sheer(CABIN_S1) + 0.1), (0, y_front, (BULWARK + sheer(CABIN_S1)) / 2), VARNISH)
parabrisas = box("parabrisas", (hb_front * 2 - 0.1, 0.04, ROOF_Z - BULWARK - 0.12), (0, y_front - 0.08, (ROOF_Z + BULWARK) / 2 + 0.02), GLASS, bevel=0)
parabrisas.rotation_euler.x = math.radians(-12)
for xo in (-hb_front + 0.03, 0, hb_front - 0.03):
    box(f"marco_parabrisas_{xo:.2f}", (0.05, 0.05, ROOF_Z - BULWARK), (xo, y_front - 0.08, (ROOF_Z + BULWARK) / 2), VARNISH_LIGHT)

# Benches inside (dark shapes seen through the windows)
for k in range(9):
    s = CABIN_S0 + 0.04 + (CABIN_S1 - CABIN_S0 - 0.08) * k / 8
    box(f"banco_{k}", (cabin_half(s) * 2 - 0.25, 0.32, 0.06), (0, y_at(s), 0.55), VARNISH_LIGHT, bevel=0)
    box(f"respaldo_{k}", (cabin_half(s) * 2 - 0.25, 0.05, 0.35), (0, y_at(s) + 0.15, 0.75), VARNISH_LIGHT, bevel=0)

# ---------- roof ----------
roof_len = abs(y_at(CABIN_S1) - y_at(CABIN_S0)) + 0.5
roof_y = (y_at(CABIN_S1) + y_at(CABIN_S0)) / 2 - 0.1
roof_w = BEAM - 0.02
box("techo", (roof_w, roof_len, 0.06), (0, roof_y, ROOF_Z + 0.03), ROOF)
for side in (1, -1):
    box(f"cenefa_{side}", (0.03, roof_len, 0.12), (side * roof_w / 2, roof_y, ROOF_Z - 0.02), WHITE)
    # Rolled-up canvas curtains under the eaves
    c = cyl(f"cortina_{side}", 0.055, roof_len - 0.4, (side * (roof_w / 2 - 0.06), roof_y, ROOF_Z - 0.12), CANVAS, verts=8)
    c.rotation_euler.x = math.radians(90)
for end in (1, -1):
    box(f"cenefa_frente_{end}", (roof_w, 0.03, 0.12), (0, roof_y + end * roof_len / 2, ROOF_Z - 0.02), WHITE)

# Roof rail and luggage
RAIL_Z = ROOF_Z + 0.28
for side in (1, -1):
    for k in range(7):
        y = roof_y - roof_len / 2 + 0.3 + k * (roof_len - 0.6) / 6
        box(f"baranda_poste_{side}_{k}", (0.03, 0.03, 0.25), (side * (roof_w / 2 - 0.08), y, ROOF_Z + 0.15), WHITE)
    beam(f"baranda_{side}", (side * (roof_w / 2 - 0.08), roof_y - roof_len / 2 + 0.3, RAIL_Z), (side * (roof_w / 2 - 0.08), roof_y + roof_len / 2 - 0.3, RAIL_Z), 0.03, WHITE)
for k, (x, y, w, d, h) in enumerate(((-0.3, 0.6, 0.45, 0.35, 0.3), (0.25, 0.4, 0.4, 0.5, 0.25), (0.0, -0.4, 0.6, 0.4, 0.22), (-0.35, -1.0, 0.35, 0.35, 0.35))):
    box(f"equipaje_{k}", (w, d, h), (x, roof_y + y, ROOF_Z + 0.06 + h / 2), LUGGAGE)
cyl("garrafa", 0.12, 0.35, (0.4, roof_y - 1.1, ROOF_Z + 0.24), RED, verts=10)

# ---------- fittings ----------
# Flag mast at the bow with the Argentine flag
s_mast = 0.9
mast_base = Vector((0, y_at(s_mast), sheer(s_mast)))
cyl("mastil", 0.02, 1.4, mast_base + Vector((0, 0, 0.7)), WHITE, verts=6)
for k, mat in enumerate((CELESTE, WHITE, CELESTE)):
    box(f"bandera_{k}", (0.01, 0.5, 0.11), (0, y_at(s_mast) + 0.27, mast_base.z + 1.33 - k * 0.11), mat, bevel=0)

# Tires hanging as fenders along the sides
for side in (1, -1):
    for k, s in enumerate((0.12, 0.27, 0.42, 0.55)):
        p = section(s, 0.82, side)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.13, minor_radius=0.05, major_segments=12, minor_segments=6,
                                         location=(p.x + side * 0.06, p.y, p.z), rotation=(0, math.radians(90), 0))
        t = bpy.context.object
        t.name = f"cubierta_auto_{side}_{k}"
        t.data.materials.append(RUBBER)

# Life rings on the stern
for side in (1, -1):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.045, major_segments=14, minor_segments=6,
                                     location=(side * 0.42, y_back + 0.04, 1.15), rotation=(math.radians(90), 0, 0))
    r = bpy.context.object
    r.name = f"salvavidas_{side}"
    r.data.materials.append(ORANGE)

# Gold name on both bows
for side in (1, -1):
    bpy.ops.object.text_add(location=(0, 0, 0))
    txt = bpy.context.object
    txt.data.body = "DELTA SUR"
    txt.data.size = 0.13
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.materials.append(GOLD)
    s_name = 0.73
    p = section(s_name, 0.8, side)
    # Follow the side as it narrows toward the bow, or the aft letters sink into the hull
    fore, aft = section(s_name + 0.05, 0.8, side), section(s_name - 0.05, 0.8, side)
    toe = math.atan2(aft.x - fore.x, aft.y - fore.y)
    txt.location = (p.x + side * 0.03, p.y, p.z - 0.04)
    txt.rotation_euler = (math.radians(90), 0, math.radians(90 if side > 0 else -90) - toe)
    bpy.ops.object.convert(target="MESH")

if RENDER:
    WATER = material("agua_delta", (0.3, 0.21, 0.12), 0.22)
    render_preview(f"{OUT}/lancha-render.png", camera=(6.5, -5.5, 2.6), target=(0, -0.3, 0.8), water_material=WATER)
else:
    export_game_asset(f"{OUT}/lancha-delta.glb")
