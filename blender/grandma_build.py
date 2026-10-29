"""買菜阿嬤 — built entirely from this script inside Blender (via MCP for Blender or blender --python).

Every run wipes the "Grandma" and "Preview" collections and rebuilds them, so the model is reproducible:
    import runpy; g = runpy.run_path(r"<repo>/blender/grandma_build.py", run_name="grandma"); g["build"]()
Units follow FigureKit (prototype-3d/figure-kit.js): feet on z=0, about 2.1 to the top of the head, chibi
proportions. The figure faces -Y; the glTF exporter turns that into +Z, the way the app's figures face.
Only image textures and Principled BSDF are used so everything survives the GLB export.
"""
import math
import os
import random

import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
TEX_DIR = os.path.join(HERE, "textures")
PREVIEW_DIR = os.path.join(HERE, "previews")
COL, PREVIEW = "Grandma", "Preview"

SKIN = "#f3cdb8"
HAT, HAT_BAND = "#a07ccc", "#6c449e"
PANTS, SHOE, SOLE = "#7a2c3a", "#6e1f2c", "#3b2020"
EYE, BUTTON = "#2a201c", "#4a2a68"
METAL, RUBBER, HUB = "#202024", "#18181a", "#b9bdc3"
LEAF, LEAF2, STEM = "#4a9a3f", "#3c8a35", "#e6efcf"

BODY = .8                           # body heights relative to the first draft: short and round
DROP = 1.25 * (1 - BODY)            # how far the head comes down with the shorter body
HEAD_C = Vector((0, 0, 1.66 - DROP))  # head centre
HA, HB, HC = .455, .42, .42         # head half-width, half-depth, half-height
NECK = Vector((0, 0, 1.25 - DROP))  # head pivot (the head nods forward a little)
HEAD_TILT = .07
HAT_Z, HAT_TILT = 1.855 - DROP, -.12   # brim tipped up at the front so the brows show
TROLLEY, TROLLEY_SCALE = (-.64, -.06), .85   # trolley origin on the floor at her right side (-X), and its size


def bz(z):
    """Body height: z from the first draft, squashed to the shorter body."""
    return z * BODY


def trolley_point(x, y, z):
    """A point given in trolley space, placed in the world."""
    ox, oy = TROLLEY
    return Vector((ox + x * TROLLEY_SCALE, oy + y * TROLLEY_SCALE, z * TROLLEY_SCALE))


# ---------------------------------------------------------------- small helpers
def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def to_linear(c):
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)


def catmull(pts, n=6, extra=None):
    """Catmull-Rom through pts (2D or 3D). extra: per-point scalars interpolated alongside."""
    P = [Vector(p) for p in pts]
    E = list(extra) if extra is not None else [0.0] * len(P)
    ext = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out, oe = [], []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(.5 * ((2 * p1) + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3))
            oe.append(E[i - 1] + (E[i] - E[i - 1]) * t)
    out.append(P[-1])
    oe.append(E[-1])
    return (out, oe) if extra is not None else out


def material(name, color=None, rough=.8, image=None, vcol=None, metallic=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if color:
        lin = to_linear(hex_rgb(color))
        bsdf.inputs["Base Color"].default_value = (*lin, 1)
        m.diffuse_color = (*lin, 1)
    if image is not None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if vcol:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = vcol
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def save_image(name, arr):
    """arr: H x W x 3 sRGB in 0..1, row 0 at the bottom (Blender's pixel order). Saved as a PNG next to this script."""
    H, W = arr.shape[:2]
    old = bpy.data.images.get(name)
    if old:
        bpy.data.images.remove(old)
    img = bpy.data.images.new(name, W, H, alpha=False)
    rgba = np.concatenate([np.clip(arr, 0, 1), np.ones((H, W, 1))], axis=2).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    os.makedirs(TEX_DIR, exist_ok=True)
    path = os.path.join(TEX_DIR, name + ".png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    img.source = "FILE"
    img.filepath = path
    img.reload()
    return img


# ---------------------------------------------------------------- mesh builders
def mesh_obj(name, verts, faces, uvs=None, mat=None, smooth_shade=True, part=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    if uvs is not None:
        layer = me.uv_layers.new(name="UVMap")
        layer.data.foreach_set("uv", [c for face in uvs for uv in face for c in uv])
    me.validate()
    me.update()
    if smooth_shade:
        me.shade_smooth()
    if mat is not None:
        me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.data.collections[COL].objects.link(ob)
    if part:
        ob["part"] = part
    return ob


def grid(name, rows, wrap=True, us=None, vs=None, **kw):
    """rows run bottom -> top (or along a path); points in a row run counter-clockwise seen from outside, so
    faces point outwards. A row whose points all coincide becomes a single pole vertex."""
    R, C = len(rows), len(rows[0])
    verts, idx = [], []
    for row in rows:
        if max((Vector(p) - Vector(row[0])).length for p in row) < 1e-7:
            verts.append(Vector(row[0]))
            idx.append([len(verts) - 1] * C)
        else:
            idx.append(list(range(len(verts), len(verts) + C)))
            verts.extend(Vector(p) for p in row)
    ncol = C if wrap else C - 1
    us = us or [j / ncol for j in range(ncol + 1)]
    vs = vs or [i / (R - 1) for i in range(R)]
    faces, uvs = [], []
    for i in range(R - 1):
        for j in range(ncol):
            j2 = (j + 1) % C
            corners = [(idx[i][j], (us[j], vs[i])), (idx[i][j2], (us[j + 1], vs[i])),
                       (idx[i + 1][j2], (us[j + 1], vs[i + 1])), (idx[i + 1][j], (us[j], vs[i + 1]))]
            seen, f, uv = set(), [], []
            for v, t in corners:
                if v not in seen:
                    seen.add(v)
                    f.append(v)
                    uv.append(t)
            if len(f) >= 3:
                faces.append(f)
                uvs.append(uv)
    return mesh_obj(name, verts, faces, uvs, **kw)


def lathe(name, prof, seg=48, ys=1.0, rad=None, u_rep=1.0, v_len=None, phi0=-math.pi, span=2 * math.pi, **kw):
    """Revolve prof [(r, z)] (bottom -> top) round the z axis. phi = 0 is the front (-Y), +phi turns towards +X.
    rad(phi, z, r) can reshape the radius; ys squashes front to back; v_len sets UV v per world unit."""
    wrap = span >= 2 * math.pi - 1e-9
    cols = seg if wrap else seg + 1
    rows = []
    for r, z in prof:
        row = []
        for j in range(cols):
            phi = phi0 + span * j / seg
            rr = rad(phi, z, r) if rad else r
            row.append((math.sin(phi) * rr, -math.cos(phi) * rr * ys, z))
        rows.append(row)
    L = [0.0]
    for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
        L.append(L[-1] + math.hypot(r1 - r0, z1 - z0))
    vs = [l / v_len for l in L] if v_len else [l / (L[-1] or 1) for l in L]
    us = [u_rep * j / seg for j in range(seg + 1)]
    return grid(name, rows, wrap=wrap, us=us, vs=vs, **kw)


def ellipsoid(name, radii, loc=(0, 0, 0), rot=(0, 0, 0), matrix=None, seg=24, rings=14, **kw):
    rx, ry, rz = radii
    prof = [(rx * math.cos(t), rz * math.sin(t)) for t in (-math.pi / 2 + math.pi * i / rings for i in range(rings + 1))]
    ob = lathe(name, prof, seg=seg, ys=ry / rx, **kw)
    if matrix is not None:
        ob.matrix_world = matrix
    else:
        ob.location = loc
        ob.rotation_euler = rot
    return ob


def tube(name, pts, radii, n=6, seg=16, caps=True, u_rep=None, v_len=None, **kw):
    """Round tube along a Catmull-Rom path; radii are per control point. u_rep/v_len scale the UVs like lathe()."""
    P, Rr = catmull(pts, n, radii)
    if u_rep and v_len:
        L = [0.0]
        for a, b in zip(P, P[1:]):
            L.append(L[-1] + (b - a).length)
        vs = [l / v_len for l in L]
        kw["us"], kw["vs"] = [u_rep * j / seg for j in range(seg + 1)], ([vs[0]] + vs + [vs[-1]]) if caps else vs
    T = [(P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized() for i in range(len(P))]
    up = Vector((0, 0, 1)) if abs(T[0].z) < .9 else Vector((1, 0, 0))
    N = (up - T[0] * up.dot(T[0])).normalized()
    rows = []
    for i, t in enumerate(T):
        if i:
            N = T[i - 1].rotation_difference(t) @ N
            N = (N - t * N.dot(t)).normalized()
        B = t.cross(N)
        rows.append([P[i] + Rr[i] * (math.cos(a) * N + math.sin(a) * B) for a in (2 * math.pi * j / seg for j in range(seg))])
    if caps:
        rows = [[P[0]] * seg] + rows + [[P[-1]] * seg]
    return grid(name, rows, wrap=True, **kw)


def box(name, size, loc, bevel=.02, tile=None, **kw):
    """Bevelled box; with tile, UVs are a box projection at `tile` world units per texture repeat."""
    sx, sy, sz = (s / 2 for s in size)
    V = [Vector((x * sx, y * sy, z * sz)) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    F = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    uvs = None
    if tile:
        uvs = []
        for f in F:
            n = (V[f[1]] - V[f[0]]).cross(V[f[2]] - V[f[0]])
            ax = max(range(3), key=lambda a: abs(n[a]))
            a, b = [k for k in range(3) if k != ax]
            uvs.append([((V[i][a] + loc[a]) / tile, (V[i][b] + loc[b]) / tile) for i in f])
    ob = mesh_obj(name, V, F, uvs, smooth_shade=False, **kw)
    ob.location = loc
    if bevel:
        m = ob.modifiers.new("Bevel", "BEVEL")
        m.width, m.segments, m.limit_method = bevel, 4, "NONE"
        m.harden_normals = True  # keeps the flat sides flat under smooth shading
        ob.data.shade_smooth()
    return ob


# ---------------------------------------------------------------- head
def dir_of(phi, el):
    return Vector((math.sin(phi) * math.cos(el), -math.cos(phi) * math.cos(el), math.sin(el)))


def head_offset(d):
    """Head surface (relative to HEAD_C) along unit direction d: round, with full cheeks that sag towards the jaw
    and soft bags under the eyes."""
    el = math.asin(max(-1.0, min(1.0, d.z)))
    phi = math.atan2(d.x, -d.y)
    x, y, z = d.x * HA, d.y * HB, d.z * HC
    front = max(0.0, -d.y)
    jowl = math.exp(-((d.z + .55) / .32) ** 2)
    cheek = math.exp(-((abs(phi) - .7) / .6) ** 2)
    x *= 1 + .12 * jowl
    y *= 1 + .07 * jowl * front
    z -= .03 * jowl * cheek * front               # the cheeks drop a little
    x *= 1 - .03 * smooth(.45, .95, d.z)
    if d.y > 0:
        y *= 1.03
    bags = sum(math.exp(-(((phi - s * .31) / .1) ** 2 + ((el + .21) / .05) ** 2)) for s in (-1, 1))
    return Vector((x, y, z)) + d * (.01 * bags)


def head_frame(phi, el):
    """Surface point and outward normal at (phi, el)."""
    e = 1e-3
    p = HEAD_C + head_offset(dir_of(phi, el))
    dp = head_offset(dir_of(phi + e, el)) - head_offset(dir_of(phi - e, el))
    de = head_offset(dir_of(phi, el + e)) - head_offset(dir_of(phi, el - e))
    n = dp.cross(de).normalized()
    if n.dot(dir_of(phi, el)) < 0:
        n = -n
    return p, n


def face_texture(W=2048, H=1024):
    """Skin with the painted face, in the head's (phi, el) equirectangular UVs."""
    img = np.ones((H, W, 3)) * np.array(hex_rgb(SKIN))
    phis = -math.pi + 2 * math.pi * (np.arange(W) + .5) / W
    els = -math.pi / 2 + math.pi * (np.arange(H) + .5) / H
    c0, c1 = np.searchsorted(phis, -1.1), np.searchsorted(phis, 1.1)
    r0, r1 = np.searchsorted(els, -1.0), np.searchsorted(els, .75)
    PH, EL = np.meshgrid(phis[c0:c1], els[r0:r1])
    X, Y = PH * np.cos(EL), EL
    sub = img[r0:r1, c0:c1]
    px = 2 * math.pi / W

    def paint(a, color):
        sub[:] = sub * (1 - a[..., None]) + np.array(hex_rgb(color)) * a[..., None]

    def stroke(pts, width, color, alpha=1.0, taper=False, soft=False):
        """A line through pts (phi, el). soft: a gaussian falloff (a crease in the skin) instead of a drawn edge."""
        pts = [Vector((p * math.cos(e), e)) for p, e in pts]
        if len(pts) > 2:
            pts = catmull(pts, 8)
        d = np.full(X.shape, 1e9)
        w = np.full(X.shape, width)
        total = sum((b - a).length for a, b in zip(pts, pts[1:])) or 1
        run = 0.0
        for a, b in zip(pts, pts[1:]):
            ab = b - a
            L2 = max(ab.length_squared, 1e-12)
            t = np.clip(((X - a.x) * ab.x + (Y - a.y) * ab.y) / L2, 0, 1)
            dd = np.hypot(X - (a.x + t * ab.x), Y - (a.y + t * ab.y))
            closer = dd < d
            d = np.where(closer, dd, d)
            if taper:  # thick in the middle, thin at both ends
                s = (run + t * ab.length) / total
                w = np.where(closer, width * (.35 + .65 * np.sin(np.pi * s)), w)
            run += ab.length
        if soft:
            paint(np.exp(-2 * (d / (w / 2)) ** 2) * alpha, color)
        else:
            paint(np.clip((w / 2 - d) / px + .5, 0, 1) * alpha, color)

    def blob(cx, cy, rx, ry, color, alpha):
        x0 = cx * math.cos(cy)
        paint(np.exp(-(((X - x0) / rx) ** 2 + ((Y - cy) / ry) ** 2) * 2.2) * alpha, color)

    line = "#c98672"   # wrinkle colour: a deeper tone of the skin; creases are soft shadows, not drawn lines
    for s in (-1, 1):
        blob(s * .46, -.3, .13, .09, "#f19c9c", .5)                                    # blush
        stroke([(s * .15, .11), (s * .26, .15), (s * .37, .135), (s * .47, .065)], .046, "#8f8984", .95, taper=True)  # brows, drooping
        for end in ((.50, -.05), (.505, -.13)):                                          # crow's feet
            stroke([(s * .43, -.085), (s * end[0], end[1])], .016, line, .35, soft=True)
        stroke([(s * .22, -.19), (s * .31, -.225), (s * .40, -.195)], .02, line, .35, soft=True)  # under-eye bags
        stroke([(s * .09, -.33), (s * .15, -.42), (s * .165, -.50)], .024, line, .4, soft=True)   # smile folds
    for e in (.27, .34):                                                                 # forehead lines
        stroke([(-.24, e), (0, e + .014), (.24, e)], .016, line, .3, soft=True)
    stroke([(-.2, -.70), (0, -.745), (.2, -.70)], .03, line, .25, soft=True)            # soft double chin
    stroke([(-.135, -.465), (-.07, -.53), (0, -.548), (.07, -.53), (.135, -.465)], .016, "#9f4d55")  # smile
    stroke([(-.07, -.565), (0, -.582), (.07, -.565)], .022, "#e3948f", .4, soft=True)                 # lower lip
    return save_image("grandma_face", img)


def build_head():
    skin_tex = material("Skin", rough=.6, image=face_texture())
    skin = material("SkinPlain", SKIN, rough=.6)
    rows = [[HEAD_C + head_offset(dir_of(-math.pi + 2 * math.pi * j / 64, -math.pi / 2 + math.pi * i / 40)) for j in range(64)]
            for i in range(41)]
    grid("Head", rows, us=[j / 64 for j in range(65)], vs=[i / 40 for i in range(41)], mat=skin_tex, part="head")

    eye_m, white = material("Eye", EYE, rough=.15), material("EyeShine", "#ffffff", rough=.2)
    for s in (-1, 1):
        phi, el = s * .31, -.10
        p, n = head_frame(phi, el)
        # Outer corners turn down; the upper lid droops over the eye a little more.
        R = Matrix.Rotation(phi, 4, "Z") @ Matrix.Rotation(-el, 4, "X") @ Matrix.Rotation(s * .12, 4, "Y")
        c = p - n * .012
        ellipsoid(f"Eye.{'L' if s > 0 else 'R'}", (.042, .03, .05), matrix=Matrix.Translation(c) @ R, mat=eye_m, part="head")
        ellipsoid(f"EyeShine.{'L' if s > 0 else 'R'}", (.014, .009, .014),
                  loc=c + (R @ Vector((-.013, -.029, .012, 0))).to_3d(), mat=white, seg=12, rings=8, part="head")
        lid = Matrix.Translation(c + (R @ Vector((0, -.004, .036, 0))).to_3d()) @ R @ Matrix.Rotation(s * .18, 4, "Y")
        ellipsoid(f"Eyelid.{'L' if s > 0 else 'R'}", (.05, .032, .025), matrix=lid, mat=skin, part="head")
        ep, en = head_frame(s * 1.52, -.14)
        ellipsoid(f"Ear.{'L' if s > 0 else 'R'}", (.03, .055, .08), loc=ep - en * .015, rot=(0, 0, -s * .3), mat=skin, part="head")
    p, n = head_frame(0, -.28)
    ellipsoid("Nose", (.058, .045, .048), loc=p - n * .012, mat=skin, part="head")


# ---------------------------------------------------------------- hair: one merged metaball mass of curls
def hairline(phi):
    a = abs(phi)
    if a < .3:
        return .45
    if a < .55:
        return .45 - (a - .3) / .25 * .13   # curls come down at the temples
    if a < 1.35:
        return .32 - (a - .55) / .8 * .35
    if a < 1.9:
        return -.03 - (a - 1.35) / .55 * .32
    return -.35 - (a - 1.9) / (math.pi - 1.9) * .12


HAT_PROF = [tuple(p) for p in catmull([(.715, -.13), (.66, -.10), (.58, -.06), (.50, -.02), (.455, 0.0), (.45, .06),
                                       (.44, .14), (.41, .21), (.34, .26), (.22, .29), (0, .30)], 4)]
HAT_THICK = .022
_BRIM = sorted((r, z) for r, z in HAT_PROF if z <= 0)


def under_hat(c, rho):
    """True when a blob of visible radius rho at c stays inside the crown or below the brim's underside."""
    p = (Matrix.Rotation(-HAT_TILT, 4, "X") @ (c - Vector((0, 0, HAT_Z))).to_4d()).to_3d()
    h = math.hypot(p.x, p.y / .96)
    if h + rho < .45 - HAT_THICK - .005:
        return p.z + rho < .26
    if h - rho > .72:
        return True
    zb = float(np.interp(h + rho, [r for r, _ in _BRIM], [z for _, z in _BRIM])) - HAT_THICK - .012
    return p.z + rho < zb


def build_hair(seed=7):
    rng = random.Random(seed)
    mb = bpy.data.metaballs.new("HairMeta")
    mb.resolution = mb.render_resolution = .02
    mb.threshold = .6
    meta = bpy.data.objects.new("HairMeta", mb)
    bpy.data.collections[COL].objects.link(meta)
    curls = []
    N, golden = 1100, math.pi * (3 - math.sqrt(5))
    for i in range(N):
        z = 1 - 2 * (i + .5) / N
        r, th = math.sqrt(1 - z * z), golden * i
        d = Vector((r * math.cos(th), r * math.sin(th), z))
        el, phi = math.asin(z), math.atan2(d.x, -d.y)
        if not hairline(phi) < el < .62:
            continue
        puff = math.exp(-((el - .08) / .28) ** 2) * smooth(.35, .9, abs(phi))
        top = smooth(.30, .62, el)
        base = HEAD_C + head_offset(d)
        off = (.03 + .07 * puff) * (1 - .8 * top)
        ir = .08 + .02 * puff - .03 * top
        cr = (.048 + .016 * rng.random()) * (1 - .35 * top)
        jitter = Vector(tuple(rng.uniform(-1, 1) for _ in range(3))) * .01
        # Pull the blobs in (and shrink them) until they clear the hat; ones that never do stay hidden anyway.
        for _ in range(12):
            ic, cc = base + d * off * .5, base + d * (off + .028) + jitter
            if under_hat(ic, ir * .75) and under_hat(cc, cr * .8):
                break
            off, ir, cr = max(0.0, off - .012), ir * .93, cr * .93
        else:
            continue
        e = mb.elements.new()
        e.co, e.radius, e.stiffness = ic, ir, 2.0
        e = mb.elements.new()
        e.co, e.radius, e.stiffness = cc, cr, 2.0
        curls.append((cc, cr, rng.random()))
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(meta.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(meta, do_unlink=True)
    bpy.data.metaballs.remove(mb)
    me.name = "Hair"
    me.shade_smooth()

    # Colour: light grey on each curl, darker in the gaps between curls, a few near-white curls.
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3).astype(float)
    C = np.array([c for c, _, _ in curls])
    Rc = np.array([r for _, r, _ in curls])
    tone = np.array([t for _, _, t in curls])
    palette = np.array([hex_rgb(h) for h in ("#8f8a86", "#a9a49f", "#c4bfba", "#dad6d2")])
    dark = np.array(hex_rgb("#5f5b58"))
    cols = np.empty((len(co), 3))
    for s in range(0, len(co), 4000):
        v = co[s:s + 4000]
        d2 = ((v[:, None, :] - C[None, :, :]) ** 2).sum(-1) / (Rc[None, :] * 1.7) ** 2
        k = d2.argmin(1)
        lift = np.clip(1 - d2[np.arange(len(v)), k], 0, 1) ** .7
        light = palette[np.minimum((tone[k] * 4.4).astype(int), 3)]
        cols[s:s + 4000] = dark + (light - dark) * (.3 + .7 * lift)[:, None]
    lin = np.where(cols <= .04045, cols / 12.92, ((cols + .055) / 1.055) ** 2.4)
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    attr.data.foreach_set("color", np.concatenate([lin, np.ones((len(lin), 1))], 1).astype(np.float32).ravel())
    me.materials.append(material("Hair", rough=.75, vcol="Col"))

    ob = bpy.data.objects.new("Hair", me)
    bpy.data.collections[COL].objects.link(ob)
    ob["part"], ob["hair"] = "head", True
    tex = bpy.data.textures.get("HairCurls") or bpy.data.textures.new("HairCurls", "STUCCI")
    tex.noise_scale = .035
    m = ob.modifiers.new("Curls", "DISPLACE")
    m.texture, m.strength, m.mid_level = tex, .012, .5
    m = ob.modifiers.new("Decimate", "DECIMATE")
    m.ratio = .4
    return ob


# ---------------------------------------------------------------- hat
def build_hat():
    hat = lathe("Hat", HAT_PROF, seg=64, ys=.96, mat=material("Hat", HAT, rough=.85), part="head")
    m = hat.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = HAT_THICK, -1
    band = lathe("HatBand", [(.459, .004), (.462, .04), (.456, .078)], seg=64, ys=.96,
                 mat=material("HatBand", HAT_BAND, rough=.7), part="head")
    m = band.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = .008, 1
    for ob in (hat, band):
        ob.location, ob.rotation_euler = (0, 0, HAT_Z), (HAT_TILT, 0, 0)
        ob["headwear"] = True


# ---------------------------------------------------------------- clothes and body
def floral_texture(S=1024, seed=3):
    rng = random.Random(seed)
    img = np.ones((S, S, 3)) * np.array(hex_rgb("#7d3a97"))
    yy, xx = np.mgrid[0:S, 0:S].astype(float)

    def wrap(dx):
        return (dx + S / 2) % S - S / 2

    def place(n, rmin, rmax, gap, taken):
        for _ in range(3000):
            if n == 0:
                break
            r, x, y = rng.uniform(rmin, rmax) * S, rng.uniform(0, S), rng.uniform(0, S)
            if all(wrap(x - fx) ** 2 + wrap(y - fy) ** 2 > (r + fr + gap) ** 2 for fx, fy, fr in taken):
                taken.append((x, y, r))
                n -= 1
        return taken

    def over(a, color):
        nonlocal img
        img = img * (1 - a[..., None]) + np.array(hex_rgb(color)) * a[..., None]

    flowers = place(24, .055, .1, 10, [])
    for x, y, r in flowers:
        dx, dy = wrap(xx - x), wrap(yy - y)
        rho, th = np.hypot(dx, dy), np.arctan2(dy, dx)
        rot = rng.uniform(0, 2 * math.pi)
        petal = r * (.6 + .4 * np.abs(np.cos(2.5 * (th - rot))))
        a = np.clip(petal - rho + .5, 0, 1)
        t = np.clip(rho / petal, 0, 1)[..., None]
        c = np.array(hex_rgb("#d8265a")) + (np.array(hex_rgb("#f27aa2")) - np.array(hex_rgb("#d8265a"))) * t ** 1.4
        img = img * (1 - a[..., None]) + c * a[..., None]
        over(np.clip(r * .25 - rho + .5, 0, 1), "#8a1538")
        over(np.clip(r * .09 - np.hypot(dx - r * .04, dy + r * .04) + .5, 0, 1), "#f7c35a")
    for x, y, r in place(40, .012, .02, 6, list(flowers))[len(flowers):]:
        over(np.clip(r - np.hypot(wrap(xx - x), wrap(yy - y)) + .5, 0, 1), "#f6a9c4")
    return save_image("grandma_floral", img)


def tartan_texture(S=512):
    def stripes(n):
        c = np.ones((n, 3)) * np.array(hex_rgb("#c7303b"))
        for start, width, color in ((0, 64, "#8c1b27"), (256, 64, "#8c1b27"), (28, 8, "#2a0f12"), (284, 8, "#2a0f12"),
                                    (140, 5, "#efd9c9"), (396, 5, "#efd9c9")):
            c[start:start + width] = hex_rgb(color)
        return c
    s = stripes(S)
    return save_image("grandma_tartan", (s[None, :, :] + s[:, None, :]) / 2)


SHIRT_PROF = [(r, bz(z)) for r, z in ((.305, .50), (.318, .56), (.335, .66), (.342, .78), (.336, .90), (.318, 1.0),
                                       (.296, 1.07), (.262, 1.13), (.205, 1.18), (.14, 1.215), (.10, 1.235))]
SHIRT_TOP = SHIRT_PROF[-1][1]
SHIRT_YS = .84


def belly(phi, z, r):
    return r * (1 + .09 * math.exp(-(phi / 1.0) ** 2) * math.exp(-((z - bz(.74)) / bz(.17)) ** 2))


def shirt_point(phi, z, lift=0.0):
    zs = [p[1] for p in SHIRT_PROF]
    r = belly(phi, z, float(np.interp(z, zs, [p[0] for p in SHIRT_PROF]))) + lift
    return Vector((math.sin(phi) * r, -math.cos(phi) * r * SHIRT_YS, z))


def build_body():
    skin = material("SkinPlain", SKIN, rough=.6)
    floral = material("Shirt", rough=.85, image=floral_texture())
    pants = material("Pants", PANTS, rough=.9)

    shirt = lathe("Shirt", [tuple(p) for p in catmull(SHIRT_PROF, 3)], seg=64, ys=SHIRT_YS, rad=belly,
                  u_rep=4, v_len=.45, mat=floral)
    m = shirt.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = .012, -1

    # Rounded turn-down collar, open at the front.
    rows = []
    span = 2 * math.pi - .14
    for i in range(7):
        t = 1 - i / 6
        row = []
        for j in range(49):
            phi = .07 + span * j / 48
            pw = phi if phi <= math.pi else phi - 2 * math.pi
            drop = .065 + .09 * math.exp(-((abs(pw) - .2) / .16) ** 2)
            inner = Vector((math.sin(phi) * .135, -math.cos(phi) * .135 * SHIRT_YS, SHIRT_TOP))
            outer = shirt_point(phi, SHIRT_TOP - drop, .012)
            row.append(inner.lerp(outer, t) + Vector((0, 0, .015 * math.sin(math.pi * t))))
        rows.append(row)
    collar = grid("Collar", rows, wrap=False, us=[2 * j / 48 for j in range(49)], vs=[.32 * i / 6 for i in range(7)], mat=floral)
    m = collar.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = .01, -1
    btn = material("Button", BUTTON, rough=.4)
    for k, z in enumerate((1.06, .92, .78)):
        ellipsoid(f"Button.{k}", (.024, .012, .024), loc=shirt_point(0, bz(z), .006), mat=btn, seg=16, rings=8)

    tube("Neck", [(0, 0, bz(1.12)), (0, 0, bz(1.12) + .3)], [.085, .085], n=1, mat=skin)

    # Arms: left hangs by her side, right reaches the trolley handle.
    grip = trolley_point(.1, .09, .905)
    arms = {"L": [(.25, 0, bz(1.10)), (.37, .02, bz(.88)), (.395, -.03, bz(.70))],
            "R": [(-.25, 0, bz(1.10)), (-.4, .05, bz(1.0)), (grip.x + .04, grip.y - .01, grip.z + .015)]}
    for side, (sh, el, wr) in arms.items():
        sh, el, wr = Vector(sh), Vector(el), Vector(wr)
        dirn = (el - sh).normalized()
        sl = tube(f"Sleeve.{side}", [sh - dirn * .02, sh + dirn * .17], [.105, .096], n=2, caps=False,
                  u_rep=2, v_len=.45, mat=floral)
        m = sl.modifiers.new("Solidify", "SOLIDIFY")
        m.thickness, m.offset = .01, -1
        tube(f"Arm.{side}", [sh + dirn * .08, el, wr], [.062, .056, .05], n=6, mat=skin)
        hand = grip if side == "R" else wr + Vector((.005, -.015, -.06))
        ellipsoid(f"Hand.{side}", (.058, .05, .07) if side == "L" else (.06, .065, .058), loc=hand, mat=skin)
        thumb = hand + (Vector((-.02, -.05, .01)) if side == "L" else Vector((.0, -.055, .03)))
        ellipsoid(f"Thumb.{side}", (.022, .022, .034), loc=thumb, mat=skin, seg=12, rings=8)

    lathe("Hips", [(r, bz(z)) for r, z in ((0, .36), (.2, .38), (.27, .44), (.295, .52), (.30, .60))], seg=48, ys=SHIRT_YS, mat=pants)
    shoe_m, sole_m = material("Shoe", SHOE, rough=.45), material("Sole", SOLE, rough=.8)
    for s in (-1, 1):
        tube(f"Leg.{'L' if s > 0 else 'R'}", [(s * .135, 0, bz(.50)), (s * .14, -.005, (bz(.50) + .12) / 2), (s * .14, -.01, .12)],
             [.12, .116, .118], n=6, mat=pants)
        shoe = ellipsoid(f"Shoe.{'L' if s > 0 else 'R'}", (.085, .135, .062), loc=(s * .14, -.045, .045), mat=shoe_m)
        for v in shoe.data.vertices:
            v.co.z = max(v.co.z, -.035)
        sole = ellipsoid(f"Sole.{'L' if s > 0 else 'R'}", (.09, .14, .02), loc=(s * .14, -.045, .012), mat=sole_m)
        for v in sole.data.vertices:
            v.co.z = max(v.co.z, -.012)


# ---------------------------------------------------------------- shopping trolley
def build_trolley():
    """Built at full size round TROLLEY, then scaled by TROLLEY_SCALE about it (trolley_point() does the same maths)."""
    ox, oy = TROLLEY
    col = bpy.data.collections[COL]
    before = set(col.objects)

    def at(x, y, z):
        return Vector((ox + x, oy + y, z))

    metal, rubber = material("Metal", METAL, rough=.35, metallic=.6), material("Rubber", RUBBER, rough=.7)
    U = [(.13, .06, .09), (.13, .065, .5), (.13, .085, .82), (.11, .09, .9), (0, .09, .91), (-.11, .09, .9),
         (-.13, .085, .82), (-.13, .065, .5), (-.13, .06, .09)]
    tube("TrolleyFrame", [at(*p) for p in U], [.014] * len(U), n=6, seg=12, mat=metal)
    tube("TrolleyGrip", [at(-.09, .09, .91), at(.09, .09, .91)], [.024, .024], n=1, mat=rubber)
    tube("TrolleyAxle", [at(-.2, .06, .085), at(.2, .06, .085)], [.012, .012], n=1, mat=metal)
    hub = material("Hub", HUB, rough=.4, metallic=.3)
    for s in (-1, 1):
        x = s * .19
        tube(f"Wheel.{s}", [at(x - .022, .06, .085), at(x + .022, .06, .085)], [.085, .085], n=1, seg=28, mat=rubber)
        tube(f"WheelHub.{s}", [at(x - .026, .06, .085), at(x + .026, .06, .085)], [.042, .042], n=1, seg=20, mat=hub)
        tube(f"TrolleyFoot.{s}", [at(s * .1, -.15, .14), at(s * .1, -.16, .02)], [.01, .01], n=1, seg=8, mat=metal)
    box("TrolleyBase", (.34, .27, .015), at(0, -.075, .14), bevel=.005, mat=metal)
    box("Bag", (.34, .26, .56), at(0, -.075, .43), bevel=.04, tile=.26, mat=material("Bag", rough=.9, image=tartan_texture()))
    box("BagRim", (.35, .27, .032), at(0, -.075, .695), bevel=.012, mat=material("BagRim", "#7e1c27", rough=.8))

    # Bok choy sticking out of the bag: pale stems, big leaves leaning outwards.
    g = 1.6
    leaf_m, leaf2_m, stem_m = material("Leaf", LEAF, rough=.6), material("Leaf2", LEAF2, rough=.6), material("Stem", STEM, rough=.55)
    for b, (x, y, tilt, yaw) in enumerate(((-.07, -.06, .28, .5), (.07, -.11, .32, -1.0), (.0, -.02, .1, 2.6))):
        base = Matrix.Translation(at(x, y, .6)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(-tilt, 4, "X")
        ellipsoid(f"Stem.{b}", (.042 * g, .03 * g, .1 * g), matrix=base @ Matrix.Translation((0, 0, .06 * g)), mat=stem_m, seg=16, rings=10)
        for k in range(6):
            a = 2 * math.pi * k / 6 + b
            R = Matrix.Rotation(a - math.pi / 2, 4, "Z") @ Matrix.Rotation(-.38, 4, "X")
            M = (base @ Matrix.Translation((math.cos(a) * .02 * g, math.sin(a) * .02 * g, .13 * g)) @ R
                 @ Matrix.Translation((0, 0, .06 * g)))
            ellipsoid(f"Leaf.{b}.{k}", (.055 * g, .012 * g, .1 * g), matrix=M, mat=leaf_m if k % 2 else leaf2_m, seg=16, rings=10)

    bpy.context.view_layer.update()
    S = Matrix.Translation((ox, oy, 0)) @ Matrix.Scale(TROLLEY_SCALE, 4) @ Matrix.Translation((-ox, -oy, 0))
    for ob in set(col.objects) - before:
        ob.matrix_world = S @ ob.matrix_world
        ob["part"] = "trolley"


# ---------------------------------------------------------------- assembly, preview and entry point
def reset():
    for name in ("Cube", "MCP_Test", "Light", "Camera"):
        ob = bpy.data.objects.get(name)
        if ob is not None:
            bpy.data.objects.remove(ob, do_unlink=True)
    for name in (COL, PREVIEW):
        col = bpy.data.collections.get(name)
        if col is None:
            col = bpy.data.collections.new(name)
            bpy.context.scene.collection.children.link(col)
        for ob in list(col.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.metaballs, bpy.data.cameras, bpy.data.lights):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)


# Pivots the app can turn to make her walk (glTF node names: no dots, three.js strips them).
JOINTS = {
    "hip_L": ((.135, 0, bz(.50)), ("Leg.L", "Shoe.L", "Sole.L")),
    "hip_R": ((-.135, 0, bz(.50)), ("Leg.R", "Shoe.R", "Sole.R")),
    "shoulder_L": ((.25, 0, bz(1.10)), ("Sleeve.L", "Arm.L", "Hand.L", "Thumb.L")),
    "shoulder_R": ((-.25, 0, bz(1.10)), ("Sleeve.R", "Arm.R", "Hand.R", "Thumb.R")),
}


def assemble():
    """grandma -> head_pivot (head, hair, hat), hip_L/R, shoulder_L/R, trolley, and the rest of the body."""
    col = bpy.data.collections[COL]

    def empty(name, loc):
        ob = bpy.data.objects.new(name, None)
        col.objects.link(ob)
        ob.location = loc
        return ob

    root = empty("grandma", (0, 0, 0))
    pivot = empty("head_pivot", NECK)
    trolley = empty("trolley", (*TROLLEY, 0))
    joints = {name: empty(name, loc) for name, (loc, _) in JOINTS.items()}
    owner = {part: joints[name] for name, (_, parts) in JOINTS.items() for part in parts}
    holders = {root, pivot, trolley, *joints.values()}
    bpy.context.view_layer.update()

    def attach(ob, parent):
        mw = ob.matrix_world.copy()
        ob.parent = parent
        ob.matrix_world = mw

    for ob in list(col.objects):
        if ob in holders:
            continue
        part = ob.get("part")
        attach(ob, pivot if part == "head" else trolley if part == "trolley" else owner.get(ob.name, root))
    for ob in (pivot, trolley, *joints.values()):
        attach(ob, root)
    pivot.rotation_euler = (HEAD_TILT, 0, 0)
    return root


def triangle_count():
    dg = bpy.context.evaluated_depsgraph_get()
    total = 0
    for ob in bpy.data.collections[COL].objects:
        if ob.type == "MESH":
            me = ob.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            total += len(me.loop_triangles)
            ob.evaluated_get(dg).to_mesh_clear()
    return total


def build():
    reset()
    build_head()
    build_hair()
    build_hat()
    build_body()
    build_trolley()
    assemble()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "grandma.blend"))
    return f"built {len(bpy.data.collections[COL].objects)} objects, {triangle_count()} triangles"


GLB_PATH = os.path.join(os.path.dirname(HERE), "prototype-3d", "models", "grandma.glb")


def export_glb(path=GLB_PATH, image_format="AUTO"):
    """The Grandma collection only (not the preview stand, lights or cameras), modifiers applied, custom properties
    (hair / headwear / part) kept as glTF extras so the app can find them in userData."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    for ob in bpy.data.collections[COL].all_objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects["grandma"]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_extras=True, export_yup=True, export_image_format=image_format,
                              export_jpeg_quality=85, export_vertex_color="MATERIAL", export_animations=False,
                              export_cameras=False, export_lights=False)
    return path, os.path.getsize(path)


def setup_preview():
    col = bpy.data.collections[PREVIEW]
    for ob in list(col.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    scene = bpy.context.scene
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    # Neutral ambient light; the pink backdrop is composited afterwards so it doesn't tint the colours.
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*to_linear(hex_rgb("#ece8e3")), 1)
    bg.inputs["Strength"].default_value = .75
    disk = lathe("Stand", [(0, -.07), (.95, -.07), (1.0, -.035), (.95, 0), (0, 0)], seg=64,
                 mat=material("Stand", "#fff4df", rough=.6))
    bpy.data.collections[COL].objects.unlink(disk)
    col.objects.link(disk)
    for name, loc, power, size in (("Key", (-2.6, -3.6, 4.2), 420, 3), ("Fill", (3.5, -3.0, 2.4), 150, 4),
                                   ("Rim", (1.8, 3.8, 4.0), 260, 2.5)):
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.size = power, size
        ob = bpy.data.objects.new(name, data)
        col.objects.link(ob)
        ob.location = loc
        ob.rotation_euler = (Vector((-.15, 0, 1.0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    try:
        scene.view_settings.view_transform = "Standard"
    except TypeError:
        pass
    try:
        scene.eevee.taa_render_samples = 48
    except AttributeError:
        pass


VIEWS = {  # direction towards the camera, framing centre, ortho scale
    "front": ((0, -1, 0), (-.15, 0, .95), 2.35),
    "side": ((1, 0, 0), (0, 0, .95), 2.35),
    "three_quarter": ((-.55, -1, .18), (0, 0, .9), 2.6),
    "face": ((0, -1, .05), (0, 0, HEAD_C.z - .06), 1.2),
    "face_three_quarter": ((-.5, -1, .1), (0, 0, HEAD_C.z - .06), 1.2),
}
BACKDROP = "#f6d5dc"


def render_previews(views=("front", "side", "three_quarter"), size=(640, 820), sheet="grandma_sheet"):
    setup_preview()
    scene = bpy.context.scene
    col = bpy.data.collections[PREVIEW]
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    paths = []
    for v in views:
        dirn, centre, scale = VIEWS[v]
        d, target = Vector(dirn).normalized(), Vector(centre)
        cam_data = bpy.data.cameras.new(f"Cam.{v}")
        cam_data.type, cam_data.ortho_scale = "ORTHO", scale
        cam = bpy.data.objects.new(f"Cam.{v}", cam_data)
        col.objects.link(cam)
        cam.location = target + d * 8
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        scene.camera = cam
        scene.render.filepath = os.path.join(PREVIEW_DIR, f"grandma_{v}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    # Over the pink backdrop, side by side in one sheet (each view is also saved on its own).
    tiles, pink = [], np.array([*hex_rgb(BACKDROP), 1.0], np.float32)
    for p in paths:
        img = bpy.data.images.load(p, check_existing=False)
        w, h = img.size
        a = np.empty(w * h * 4, np.float32)
        img.pixels.foreach_get(a)
        a = a.reshape(h, w, 4)
        a = a * a[..., 3:] + pink * (1 - a[..., 3:])
        a[..., 3] = 1
        img.pixels.foreach_set(a.ravel())
        img.save()
        tiles.append(a)
        bpy.data.images.remove(img)
    path = os.path.join(PREVIEW_DIR, sheet + ".png")
    img = np.concatenate(tiles, axis=1)
    out = bpy.data.images.new(sheet, img.shape[1], img.shape[0], alpha=False)
    out.pixels.foreach_set(img.ravel())
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    return path


if __name__ == "__main__":
    print(build())
    print(render_previews())
