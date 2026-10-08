"""
Delta muelle (bus-boat stop) modeled procedurally in headless Blender,
after reference photos of Tigre docks: braced piles, plank deck, white
railing, corrugated tin gable roof on posts with brackets, side stairs.

Run with Blender's Python module (no Blender install needed):

    python3.11 -m venv .venv-blender && .venv-blender/bin/pip install "bpy==4.5.*"
    .venv-blender/bin/python scripts/models/blender/muelle.py public/models [--render]

Writes <out>/muelle.glb for the game (one mesh per material, flat colors,
open side facing +X in Babylon) and, with --render, <out>/muelle-render.png.
"""
import math
import sys

import bpy
import bmesh
from mathutils import Vector

RENDER = "--render" in sys.argv
OUT = [a for a in sys.argv[1:] if not a.startswith("--")][-1]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------- materials ----------
def material(name, color, rough=0.8, metallic=0.0, noise_scale=0.0, noise_amt=0.0, stripes=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    base = nt.nodes.new("ShaderNodeRGB")
    base.outputs[0].default_value = (*color, 1)
    col = base.outputs[0]
    if noise_amt > 0:
        # Weathering: darken/lighten with noise (and wood grain stretched along X)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1.0, stripes or 1.0, stripes or 1.0)
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = noise_scale
        nz.inputs["Detail"].default_value = 8
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = noise_amt
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (0.55, 0.55, 0.55, 1)
        ramp.color_ramp.elements[1].color = (1.15, 1.15, 1.15, 1)
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
        nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(col, mix.inputs["A"])
        nt.links.new(ramp.outputs["Color"], mix.inputs["B"])
        col = mix.outputs["Result"]
    nt.links.new(col, bsdf.inputs["Base Color"])
    return m


WOOD = material("madera", (0.32, 0.22, 0.14), 0.85, noise_scale=6, noise_amt=0.8, stripes=12)
WOOD_DARK = material("madera_humeda", (0.17, 0.12, 0.08), 0.7, noise_scale=8, noise_amt=0.7, stripes=6)
PAINT = material("pintura_blanca", (0.82, 0.8, 0.74), 0.6, noise_scale=14, noise_amt=0.35)
TIN = material("chapa", (0.62, 0.6, 0.55), 0.38, metallic=0.85, noise_scale=3, noise_amt=0.45)
RED = material("rojo", (0.55, 0.12, 0.08), 0.5)
SIGN = material("cartel", (0.08, 0.08, 0.09), 0.5)
WATER = material("agua_delta", (0.3, 0.21, 0.12), 0.22)


# ---------- helpers ----------
def box(name, size, loc, mat, rot=(0, 0, 0), bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    # Only bake the scale: applying location too would put the origin at the world center
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = 1
    o.data.materials.append(mat)
    return o


def beam(name, a, b, thick, mat):
    """Square beam from point a to b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = box(name, (thick, thick, d.length), (a + b) / 2, mat)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return o


def cyl(name, r, h, loc, mat, verts=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    return o


# ---------- the muelle ----------
W, D = 4.2, 3.0          # deck width (x, along the shore) and depth (y, out over the water)
DECK = 1.25              # deck height above the water
RAIL = 0.95
ROOF_EAVE = DECK + 2.05
ROOF_PITCH = math.radians(17)

# Piles (round, wet and dark at the waterline) from the riverbed up to the deck
pile_x = [-W / 2 + 0.15, 0, W / 2 - 0.15]
pile_y = [-D / 2 + 0.15, D / 2 - 0.15]
for i, x in enumerate(pile_x):
    for j, y in enumerate(pile_y):
        cyl(f"pilote_{i}{j}", 0.09, DECK + 1.6, (x, y, (DECK - 1.6) / 2), WOOD_DARK)

# Bearers and diagonal bracing like the photo (X braces between piles, low stringer)
for j, y in enumerate(pile_y):
    box(f"viga_{j}", (W, 0.12, 0.2), (0, y, DECK - 0.2), WOOD_DARK)
    box(f"larguero_bajo_{j}", (W, 0.1, 0.12), (0, y, 0.15), WOOD_DARK)
    for k in range(2):
        x0, x1 = pile_x[k], pile_x[k + 1]
        beam(f"cruz_{j}{k}a", (x0, y, 0.2), (x1, y, DECK - 0.3), 0.07, WOOD_DARK)
        beam(f"cruz_{j}{k}b", (x1, y, 0.2), (x0, y, DECK - 0.3), 0.07, WOOD_DARK)

# Deck planks with gaps, each slightly different
for k in range(14):
    y = -D / 2 + 0.11 + k * (D - 0.1) / 14
    p = box(f"tablon_{k}", (W + 0.1, 0.19, 0.05), (0, y, DECK), WOOD, bevel=0.008)
    p.rotation_euler.z = math.radians((k % 3 - 1) * 0.4)

# White railing: posts and two rails on the land side and both ends; water side open
post_xs = [-W / 2 + 0.06 + i * (W - 0.12) / 5 for i in range(6)]
for i, x in enumerate(post_xs):
    box(f"poste_b_{i}", (0.07, 0.07, RAIL), (x, -D / 2 + 0.05, DECK + RAIL / 2), PAINT)
for side in (-1, 1):
    x = side * (W / 2 - 0.05)
    for i in range(3):
        y = -D / 2 + 0.05 + i * (D - 0.6) / 2
        box(f"poste_l_{side}_{i}", (0.07, 0.07, RAIL), (x, y, DECK + RAIL / 2), PAINT)
    for h in (0.45, RAIL):
        box(f"pasamanos_l_{side}_{h}", (0.06, D - 0.5, 0.05), (x, -0.25, DECK + h), PAINT)
for h in (0.45, RAIL):
    box(f"pasamanos_b_{h}", (W, 0.06, 0.05), (0, -D / 2 + 0.05, DECK + h), PAINT)
# Bench along the back railing
box("banco", (W * 0.6, 0.35, 0.05), (0, -D / 2 + 0.35, DECK + 0.45), WOOD)

# Roof posts with little corner brackets
for x in (-W / 2 + 0.25, W / 2 - 0.25):
    for y in (-D / 2 + 0.25, D / 2 - 0.25):
        box(f"parante_{x}_{y}", (0.09, 0.09, ROOF_EAVE - DECK), (x, y, (ROOF_EAVE + DECK) / 2), PAINT)
        s = 1 if y > 0 else -1
        beam(f"mensula_{x}_{y}", (x, y, ROOF_EAVE - 0.45), (x, y - s * 0.4, ROOF_EAVE - 0.02), 0.05, RED)

# Corrugated tin gable roof: a subdivided plane rippled along its slope
def roof_slab(side):
    span = (D / 2 + 0.35) / math.cos(ROOF_PITCH)
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.object
    o.name = f"chapa_{side}"
    o.scale = (W + 0.5, span, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    # Corrugations every 7.6 cm (typical sinusoidal sheet), 4 vertices per wave
    period = 0.076
    waves = round((W + 0.5) / period)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs(e.verts[0].co.x - e.verts[1].co.x) > 0.1], cuts=waves * 4 - 1)
    for v in bm.verts:
        v.co.z = 0.012 * math.sin((v.co.x + (W + 0.5) / 2) * math.pi * 2 / period)
    bm.to_mesh(o.data)
    bm.free()
    sol = o.modifiers.new("espesor", "SOLIDIFY")
    sol.thickness = 0.012
    o.data.materials.append(TIN)
    o.rotation_euler.x = -side * ROOF_PITCH
    rise = math.sin(ROOF_PITCH) * span / 2
    o.location = (0, side * math.cos(ROOF_PITCH) * span / 2, ROOF_EAVE + rise)
    bpy.ops.object.shade_smooth()
    return o


roof_slab(1)
roof_slab(-1)
ridge = (D / 2 + 0.35) * math.tan(ROOF_PITCH)
box("cumbrera", (W + 0.55, 0.16, 0.05), (0, 0, ROOF_EAVE + ridge + 0.03), TIN)
# Red eave trim like the photo
for side in (-1, 1):
    box(f"cenefa_{side}", (W + 0.5, 0.03, 0.12), (0, side * (D / 2 + 0.33), ROOF_EAVE - 0.07), RED)

# Name board under the ridge on the water side
box("cartel", (1.6, 0.04, 0.32), (0, D / 2 - 0.2, ROOF_EAVE - 0.15), SIGN)

# Side stairs going down into the water at the open end
STAIR_Y = D / 2 - 0.45
for k in range(6):
    box(f"escalon_{k}", (0.3, 0.8, 0.05), (W / 2 + 0.2 + k * 0.21, STAIR_Y, DECK - 0.22 - k * 0.22), WOOD)
for dy in (-0.42, 0.42):
    beam(f"zanca_{dy}", (W / 2 + 0.05, STAIR_Y + dy, DECK), (W / 2 + 1.45, STAIR_Y + dy, -0.25), 0.06, WOOD_DARK)

# ---------- export the game asset (before adding preview-only scenery) ----------
def export_game_asset(path):
    """One mesh per material, transforms baked, open side facing Babylon +X."""
    from mathutils import Matrix

    deps = bpy.context.evaluated_depsgraph_get()
    by_material = {}
    for o in list(bpy.data.objects):
        if o.type != "MESH":
            continue
        mesh = bpy.data.meshes.new_from_object(o.evaluated_get(deps))  # modifiers applied
        mesh.transform(o.matrix_world)
        by_material.setdefault(o.data.materials[0].name, []).append(mesh)

    # Blender (x, y, z) ends up as Babylon (-x, z, -y) through glTF; turning the
    # model +90 degrees about Z makes the open side (Blender +Y) Babylon +X.
    turn = Matrix.Rotation(math.radians(90), 4, "Z")
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)

    tris = 0
    for name, meshes in by_material.items():
        bm = bmesh.new()
        for m in meshes:
            bm.from_mesh(m)
        joined = bpy.data.meshes.new(name)
        bm.to_mesh(joined)
        bm.free()
        joined.transform(turn)
        mat = bpy.data.materials[name]
        joined.materials.append(mat)
        obj = bpy.data.objects.new(name, joined)
        bpy.context.scene.collection.objects.link(obj)
        tris += sum(len(p.vertices) - 2 for p in joined.polygons)

    # glTF can't carry Blender's procedural weathering: export the base colors
    for mat in bpy.data.materials:
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        rgb = next((n for n in mat.node_tree.nodes if n.type == "RGB"), None)
        for link in list(bsdf.inputs["Base Color"].links):
            mat.node_tree.links.remove(link)
        if rgb:
            bsdf.inputs["Base Color"].default_value = rgb.outputs[0].default_value

    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True)
    print("TRIANGLES", tris, "MESHES", len(by_material))


if not RENDER:
    export_game_asset(f"{OUT}/muelle.glb")
    sys.exit(0)

# ---------- preview scene ----------
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
water = bpy.context.object
water.data.materials.append(WATER)
ripple = water.modifiers.new("ondas", "DISPLACE")
tex = bpy.data.textures.new("ondas", "CLOUDS")
tex.noise_scale = 0.6
ripple.texture = tex
ripple.strength = 0.02
bpy.ops.object.modifier_add(type="SUBSURF")
water.modifiers["Subdivision"].levels = 6
water.modifiers["Subdivision"].subdivision_type = "SIMPLE"
water.modifiers.move(1, 0)

world = bpy.data.worlds.new("cielo")
scene.world = world
world.use_nodes = True
sky = world.node_tree.nodes.new("ShaderNodeTexSky")
sky.sun_elevation = math.radians(28)
sky.sun_rotation = math.radians(210)
world.node_tree.links.new(sky.outputs[0], world.node_tree.nodes["Background"].inputs[0])
world.node_tree.nodes["Background"].inputs[1].default_value = 0.35

bpy.ops.object.light_add(type="SUN", rotation=(math.radians(55), 0, math.radians(30)))
bpy.context.object.data.energy = 3.5

bpy.ops.object.camera_add(location=(4.2, 9.5, 3.4))
cam = bpy.context.object
cam.data.lens = 35
direction = Vector((0, 0, 1.6)) - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.view_settings.view_transform = "AgX"
scene.render.filepath = f"{OUT}/muelle-render.png"
bpy.ops.render.render(write_still=True)
print("DONE")
