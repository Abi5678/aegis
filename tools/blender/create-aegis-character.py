"""Generate original Aegis mini-agent characters in Blender.

Run from the project root with:
  blender --background --python tools/blender/create-aegis-character.py -- --actor guardian

Outputs:
  apps/aegis/public/characters/aegis-<actor>.blend
  apps/aegis/public/characters/aegis-<actor>.glb
  apps/aegis/public/characters/aegis-<actor>.png
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_PATH = Path(globals().get("__file__", "tools/blender/create-aegis-character.py")).resolve()
ROOT = SCRIPT_PATH.parents[2]
OUT_DIR = ROOT / "apps" / "aegis" / "public" / "characters"

PALETTES = {
    "injector": ("ff5f62", "f7b500", "ffe0a3"),
    "manipulator": ("ff3f68", "9c5cff", "ffd2dd"),
    "exfiltrator": ("4f8fff", "38dbc2", "dbf7ff"),
    "loophole": ("ff8a3d", "ffcf47", "fff0bf"),
    "historian": ("5fd6ff", "59f0d3", "e6fffa"),
    "diagnostician": ("8d82ff", "49e6c9", "f1eeff"),
    "builder": ("4bd66f", "5ec2ff", "eaffef"),
    "guardian": ("5af0d1", "468cff", "e8fffb"),
    "judge": ("f4d35e", "7f72ff", "fff8d9"),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--actor", choices=sorted(PALETTES), default="guardian")
    parser.add_argument("--no-render", action="store_true")
    return parser.parse_args()


def color(hex_color: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    return tuple(int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)) + (alpha,)


def material(name: str, hex_color: str, roughness: float = 0.52, metallic: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color(hex_color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def add_uv_sphere(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float], mat: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def add_capsule(name: str, loc: tuple[float, float, float], radius: float, depth: float, mat: bpy.types.Material, rot=(0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    bevel = obj.modifiers.new("soft bevel", "BEVEL")
    bevel.width = radius * 0.78
    bevel.segments = 18
    obj.modifiers.new("surface polish", "WEIGHTED_NORMAL")
    return obj


def add_cube(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float], mat: bpy.types.Material, rot=(0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("rounded edges", "BEVEL")
    bevel.width = 0.08
    bevel.segments = 8
    obj.modifiers.new("soft normals", "WEIGHTED_NORMAL")
    return obj


def add_torus(name: str, loc: tuple[float, float, float], major: float, minor: float, mat: bpy.types.Material, rot=(0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=64, minor_segments=16, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def create_role_prop(actor: str, accent: bpy.types.Material, dark: bpy.types.Material) -> None:
    if actor == "historian":
        add_cube("book", (0.78, -0.1, 1.42), (0.22, 0.05, 0.28), accent, (0.05, 0.0, -0.25))
        for index in range(3):
            add_capsule(f"book-line-{index}", (0.78, -0.16, 1.5 - index * 0.07), 0.01, 0.22, dark, (math.pi / 2, 0, math.pi / 2))
    elif actor == "diagnostician":
        add_torus("lens", (0.78, -0.08, 1.43), 0.16, 0.018, dark, (math.pi / 2, 0, 0.35))
        add_capsule("lens-handle", (0.96, -0.08, 1.22), 0.025, 0.34, dark, (0.68, 0.0, -0.55))
    elif actor == "builder":
        add_capsule("wrench-handle", (0.85, -0.07, 1.32), 0.035, 0.48, dark, (0.6, 0.0, -0.65))
        add_torus("wrench-head", (0.69, -0.06, 1.52), 0.09, 0.018, accent, (math.pi / 2, 0, -0.45))
    elif actor == "guardian":
        add_cube("shield", (0.78, -0.12, 1.4), (0.19, 0.04, 0.27), accent, (0.0, 0.0, 0.14))
        add_capsule("shield-cross-v", (0.78, -0.17, 1.4), 0.018, 0.36, dark, (0, 0, 0))
        add_capsule("shield-cross-h", (0.78, -0.17, 1.4), 0.018, 0.26, dark, (math.pi / 2, 0, math.pi / 2))
    elif actor == "judge":
        add_capsule("gavel-handle", (0.85, -0.08, 1.32), 0.035, 0.48, dark, (0.6, 0.0, -0.65))
        add_capsule("gavel-head", (0.64, -0.06, 1.55), 0.055, 0.24, accent, (math.pi / 2, 0, math.pi / 2 - 0.35))
    elif actor == "injector":
        add_capsule("injector-body", (0.82, -0.08, 1.36), 0.045, 0.5, dark, (0.55, 0.0, -0.55))
        add_capsule("injector-tip", (1.0, -0.09, 1.12), 0.012, 0.25, accent, (0.55, 0.0, -0.55))
    elif actor == "manipulator":
        add_capsule("control-left", (-0.32, -0.02, 2.32), 0.012, 0.72, accent, (0.28, 0.1, 0.18))
        add_capsule("control-right", (0.35, -0.02, 2.32), 0.012, 0.72, accent, (0.28, -0.1, -0.18))
        add_uv_sphere("control-node-left", (-0.48, -0.04, 2.62), (0.06, 0.06, 0.06), accent)
        add_uv_sphere("control-node-right", (0.51, -0.04, 2.62), (0.06, 0.06, 0.06), accent)
    elif actor == "exfiltrator":
        add_torus("key-ring", (0.81, -0.08, 1.44), 0.1, 0.018, dark, (math.pi / 2, 0, 0.2))
        add_capsule("key-stem", (0.93, -0.08, 1.26), 0.025, 0.32, dark, (0.55, 0, -0.45))
    elif actor == "loophole":
        add_torus("loop", (0.8, -0.08, 1.39), 0.16, 0.035, accent, (math.pi / 2, 0, -0.35))


def create_character(actor: str) -> None:
    primary_hex, secondary_hex, accent_hex = PALETTES[actor]
    primary = material(f"{actor}-primary", primary_hex)
    secondary = material(f"{actor}-secondary", secondary_hex)
    accent = material(f"{actor}-accent", accent_hex, roughness=0.38)
    dark = material("soft-ink", "101318", roughness=0.7)
    white = material("eye-spark", "ffffff", roughness=0.32)
    shadow = material("contact-shadow", "0a0d12", roughness=0.9)

    add_uv_sphere("body", (0, 0, 1.2), (0.62, 0.5, 0.72), primary)
    add_uv_sphere("head", (0, -0.02, 1.88), (0.54, 0.46, 0.48), primary)
    add_uv_sphere("belly-glow", (0.0, -0.42, 1.23), (0.34, 0.06, 0.33), secondary)

    add_capsule("arm-left", (-0.62, -0.02, 1.28), 0.075, 0.72, primary, (0.0, 0.72, -0.55))
    add_capsule("arm-right", (0.62, -0.02, 1.28), 0.075, 0.72, primary, (0.0, -0.72, 0.55))
    add_uv_sphere("hand-left", (-0.92, -0.25, 1.05), (0.11, 0.1, 0.1), primary)
    add_uv_sphere("hand-right", (0.92, -0.25, 1.05), (0.11, 0.1, 0.1), primary)
    add_uv_sphere("foot-left", (-0.28, -0.12, 0.46), (0.23, 0.16, 0.09), dark)
    add_uv_sphere("foot-right", (0.28, -0.12, 0.46), (0.23, 0.16, 0.09), dark)

    add_uv_sphere("eye-left", (-0.18, -0.43, 1.92), (0.095, 0.04, 0.12), dark)
    add_uv_sphere("eye-right", (0.18, -0.43, 1.92), (0.095, 0.04, 0.12), dark)
    add_uv_sphere("eye-spark-left", (-0.145, -0.462, 1.97), (0.025, 0.01, 0.025), white)
    add_uv_sphere("eye-spark-right", (0.215, -0.462, 1.97), (0.025, 0.01, 0.025), white)
    add_capsule("smile", (0.0, -0.48, 1.72), 0.018, 0.26, dark, (math.pi / 2, 0, math.pi / 2))

    add_uv_sphere("floor-shadow", (0, 0, 0.33), (0.78, 0.48, 0.025), shadow)
    create_role_prop(actor, accent, dark)


def setup_scene(actor: str) -> None:
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 80
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.world.color = color("05070a")[:3]

    bpy.ops.object.light_add(type="AREA", location=(0, -3.2, 4.2))
    key = bpy.context.object
    key.name = "softbox-key"
    key.data.energy = 550
    key.data.size = 4

    bpy.ops.object.light_add(type="POINT", location=(-2.5, 1.2, 2.6))
    rim = bpy.context.object
    rim.name = "mint-rim"
    rim.data.energy = 100
    rim.data.color = color(PALETTES[actor][1])[:3]

    bpy.ops.object.camera_add(location=(0, -5.2, 2.1), rotation=(math.radians(72), 0, 0))
    bpy.context.scene.camera = bpy.context.object
    bpy.context.scene.render.resolution_x = 1400
    bpy.context.scene.render.resolution_y = 1400
    bpy.context.scene.eevee.taa_render_samples = 64


def save_outputs(actor: str, no_render: bool) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    blend_path = OUT_DIR / f"aegis-{actor}.blend"
    glb_path = OUT_DIR / f"aegis-{actor}.glb"
    png_path = OUT_DIR / f"aegis-{actor}.png"

    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB", export_yup=True)
    if not no_render:
      bpy.context.scene.render.filepath = str(png_path)
      bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    clear_scene()
    create_character(args.actor)
    setup_scene(args.actor)
    save_outputs(args.actor, args.no_render)


if __name__ == "__main__":
    main()
