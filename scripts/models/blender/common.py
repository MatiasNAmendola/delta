"""
Shared helpers for the procedural Blender models in this folder: materials,
primitives, the game export (one mesh per material, flat colors) and a
Cycles preview render. Import from a model script after putting this
folder on sys.path.
"""
import math

import bpy
import bmesh
from mathutils import Matrix, Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


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


def export_game_asset(path, turn_degrees=0.0):
    """
    One mesh per material, transforms baked, flat base colors.

    Blender (x, y, z) ends up as Babylon (-x, z, -y) through glTF: model with
    that in mind, or pass `turn_degrees` (about Blender Z) to orient it.
    """
    deps = bpy.context.evaluated_depsgraph_get()
    by_material = {}
    for o in list(bpy.data.objects):
        if o.type != "MESH":
            continue
        mesh = bpy.data.meshes.new_from_object(o.evaluated_get(deps))  # modifiers applied
        mesh.transform(o.matrix_world)
        by_material.setdefault(o.data.materials[0].name, []).append(mesh)

    turn = Matrix.Rotation(math.radians(turn_degrees), 4, "Z")
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
        joined.materials.append(bpy.data.materials[name])
        obj = bpy.data.objects.new(name, joined)
        bpy.context.scene.collection.objects.link(obj)
        tris += sum(len(p.vertices) - 2 for p in joined.polygons)

    # glTF can't carry Blender's procedural weathering: export the base colors
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        rgb = next((n for n in mat.node_tree.nodes if n.type == "RGB"), None)
        if not bsdf:
            continue
        for link in list(bsdf.inputs["Base Color"].links):
            mat.node_tree.links.remove(link)
        if rgb:
            bsdf.inputs["Base Color"].default_value = rgb.outputs[0].default_value

    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True)
    print("TRIANGLES", tris, "MESHES", len(by_material))


def render_preview(path, camera, target, water_material, sun_rotation=210.0):
    """Cycles preview on muddy water under a sky; not part of the game asset."""
    scene = bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
    water = bpy.context.object
    water.data.materials.append(water_material)
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
    sky.sun_rotation = math.radians(sun_rotation)
    world.node_tree.links.new(sky.outputs[0], world.node_tree.nodes["Background"].inputs[0])
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.2

    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(55), 0, math.radians(30)))
    bpy.context.object.data.energy = 3.0

    bpy.ops.object.camera_add(location=camera)
    cam = bpy.context.object
    cam.data.lens = 35
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("DONE")
