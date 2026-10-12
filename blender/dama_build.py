"""菜市場大媽 — built entirely from this script inside Blender (via MCP for Blender or blender --python).

After the user's reference picture (2026-10-08): an ivory scooter helmet over dark curls, a grey face mask, a zipped
lavender fleece, floral gloves, a long floral skirt and brown trainers; her hands are folded in front of her and a
red-and-white striped bag of spring onions hangs from her left forearm.

Same conventions as grandma_build.py, whose generic mesh helpers are reused here: feet on z=0, the figure faces -Y,
chibi proportions matching the app's other figures. Run it in an empty file (File > New) so the grandma's materials
are not touched; every run wipes the "Dama" and "Preview" collections and rebuilds them:
    import runpy; d = runpy.run_path(r"<repo>/blender/dama_build.py", run_name="dama"); d["build"](); d["render_previews"]()
"""
import importlib.util
import math
import os
import random

import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))


def _grandma_helpers():
    spec = importlib.util.spec_from_file_location("grandma_build", os.path.join(HERE, "grandma_build.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


G = _grandma_helpers()
COL, PREVIEW = "Dama", G.PREVIEW
G.COL = COL  # the shared helpers link every new object into G.COL
lathe, tube, grid, ellipsoid, material, save_image = G.lathe, G.tube, G.grid, G.ellipsoid, G.material, G.save_image
catmull, smooth, hex_rgb, dir_of = G.catmull, G.smooth, G.hex_rgb, G.dir_of

SKIN, EYE = "#f1c8ae", "#2b1d18"
HELMET, TRIM = "#e4dac6", "#3f302b"
MASK, MASK_EDGE, LOOP = "#c3c4c9", "#dcdde1", "#ececee"
JACKET, JACKET_RIB, ZIP = "#c4acdc", "#a98fc7", "#e6e3ea"
LEGS, SHOE, SOLE = "#3a3135", "#4b3832", "#e8e1d6"
BAG_RED, BAG_WHITE, BAG_PINK = "#d8343f", "#f7f2ec", "#ef9aa8"
ONION, ONION2, ONION_WHITE = "#4f9c3b", "#3f8c33", "#eef1da"

HEAD_C = Vector((0, 0, 1.41))       # same head as the grandma's (centre, half-width, half-depth, half-height)
HA, HB, HC = .45, .42, .42
NECK = Vector((0, 0, 1.0))          # head pivot
HEAD_TILT = .05

HELM_C = HEAD_C + Vector((0, .015, .02))   # the helmet is an ellipsoid shell a little bigger than the head
HELM_R = (.53, .515, .455)
HELM_T = .03


# ---------------------------------------------------------------- head
def head_offset(d):
    """Head surface (relative to HEAD_C) along unit direction d: round, cheeks only a little full (younger than the
    grandma's, and the mask hides the lower face anyway)."""
    x, y, z = d.x * HA, d.y * HB, d.z * HC
    front = max(0.0, -d.y)
    jowl = math.exp(-((d.z + .5) / .32) ** 2)
    x *= 1 + .08 * jowl
    y *= 1 + .05 * jowl * front
    x *= 1 - .03 * smooth(.45, .95, d.z)
    if d.y > 0:
        y *= 1.03
    return Vector((x, y, z))


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
    """Skin with brows, eyeliner and a little blush, in the head's (phi, el) equirectangular UVs."""
    img = np.ones((H, W, 3)) * np.array(hex_rgb(SKIN))
    phis = -math.pi + 2 * math.pi * (np.arange(W) + .5) / W
    els = -math.pi / 2 + math.pi * (np.arange(H) + .5) / H
    c0, c1 = np.searchsorted(phis, -1.1), np.searchsorted(phis, 1.1)
    r0, r1 = np.searchsorted(els, -.6), np.searchsorted(els, .6)
    PH, EL = np.meshgrid(phis[c0:c1], els[r0:r1])
    X, Y = PH * np.cos(EL), EL
    sub = img[r0:r1, c0:c1]
    px = 2 * math.pi / W

    def paint(a, color):
        sub[:] = sub * (1 - a[..., None]) + np.array(hex_rgb(color)) * a[..., None]

    def stroke(pts, width, color, alpha=1.0):
        """A line through pts (phi, el), thick in the middle and thin at both ends."""
        pts = [Vector((p * math.cos(e), e)) for p, e in pts]
        if len(pts) > 2:
            pts = catmull(pts, 8)
        d = np.full(X.shape, 1e9)
        w = np.full(X.shape, width)
        total = sum((b - a).length for a, b in zip(pts, pts[1:])) or 1
        run = 0.0
        for a, b in zip(pts, pts[1:]):
            ab = b - a
            t = np.clip(((X - a.x) * ab.x + (Y - a.y) * ab.y) / max(ab.length_squared, 1e-12), 0, 1)
            dd = np.hypot(X - (a.x + t * ab.x), Y - (a.y + t * ab.y))
            closer = dd < d
            d = np.where(closer, dd, d)
            w = np.where(closer, width * (.35 + .65 * np.sin(np.pi * (run + t * ab.length) / total)), w)
            run += ab.length
        paint(np.clip((w / 2 - d) / px + .5, 0, 1) * alpha, color)

    def blob(cx, cy, rx, ry, color, alpha):
        paint(np.exp(-(((X - cx * math.cos(cy)) / rx) ** 2 + ((Y - cy) / ry) ** 2) * 2.2) * alpha, color)

    for s in (-1, 1):
        blob(s * .5, -.15, .1, .06, "#f2a39c", .4)                                                     # blush
        stroke([(s * .13, .11), (s * .24, .165), (s * .35, .165), (s * .45, .115)], .05, "#3b2722", .95)  # arched brows
        stroke([(s * .385, -.04), (s * .45, -.008)], .02, "#2a1c18", .9)                               # eyeliner flick
    return save_image("dama_face", img)


def build_head():
    skin_tex = material("Skin", rough=.6, image=face_texture())
    skin = material("SkinPlain", SKIN, rough=.6)
    rows = [[HEAD_C + head_offset(dir_of(-math.pi + 2 * math.pi * j / 64, -math.pi / 2 + math.pi * i / 40)) for j in range(64)]
            for i in range(41)]
    grid("Head", rows, us=[j / 64 for j in range(65)], vs=[i / 40 for i in range(41)], mat=skin_tex, part="head")

    eye_m, white = material("Eye", EYE, rough=.15), material("EyeShine", "#ffffff", rough=.2)
    for s in (-1, 1):
        side = "L" if s > 0 else "R"
        phi, el = s * .30, -.06
        p, n = head_frame(phi, el)
        R = Matrix.Rotation(phi, 4, "Z") @ Matrix.Rotation(-el, 4, "X") @ Matrix.Rotation(s * .06, 4, "Y")
        c = p - n * .012
        ellipsoid(f"Eye.{side}", (.046, .032, .055), matrix=Matrix.Translation(c) @ R, mat=eye_m, part="head")
        ellipsoid(f"EyeShine.{side}", (.015, .009, .015), loc=c + (R @ Vector((-.014, -.03, .014, 0))).to_3d(),
                  mat=white, seg=12, rings=8, part="head")
        lid = Matrix.Translation(c + (R @ Vector((0, -.004, .042, 0))).to_3d()) @ R @ Matrix.Rotation(s * .1, 4, "Y")
        ellipsoid(f"Eyelid.{side}", (.054, .033, .022), matrix=lid, mat=skin, part="head")


# ---------------------------------------------------------------- face mask
def mask_bounds(phi):
    """(bottom, top) elevation of the mask: over the bridge of the nose, round under the chin."""
    a = abs(phi)
    return -1.02 + .25 * smooth(.25, .92, a), -.15 - .09 * smooth(.15, .85, a)


def mask_point(phi, t):
    """t = 0 bottom edge .. 1 top edge. It stands off the face over the nose and in front of the mouth."""
    lo, hi = mask_bounds(phi)
    el = lo + (hi - lo) * t
    p, n = head_frame(phi, el)
    nose = .045 * math.exp(-((phi / .2) ** 2 + ((el + .27) / .13) ** 2))
    mouth = .02 * math.exp(-(phi / .4) ** 2) * math.exp(-((el + .6) / .25) ** 2)
    return p + n * (.014 + nose + mouth)


def mask_texture(W=512, H=256):
    U, V = np.meshgrid((np.arange(W) + .5) / W, (np.arange(H) + .5) / H)
    shade = np.zeros((H, W))
    for c in (.30, .52, .74):  # three pleats: a soft shadow under each fold, a highlight above it
        shade += -.12 * np.exp(-((V - c + .015) / .018) ** 2) + .06 * np.exp(-((V - c - .025) / .03) ** 2)
    img = np.array(hex_rgb(MASK)) * (1 + shade[..., None]) * np.ones((H, W, 3))
    binding = (U < .018) | (U > .982) | (V < .04) | (V > .96)
    img[binding] = hex_rgb(MASK_EDGE)
    return save_image("dama_mask", img)


MASK_SPAN = .92


def build_mask():
    cols, nrow = 37, 17
    rows = [[mask_point(-MASK_SPAN + 2 * MASK_SPAN * j / (cols - 1), i / (nrow - 1)) for j in range(cols)] for i in range(nrow)]
    m = grid("Mask", rows, wrap=False, mat=material("Mask", rough=.9, image=mask_texture()), part="head")
    mod = m.modifiers.new("Solidify", "SOLIDIFY")
    mod.thickness, mod.offset = .007, -1
    loop = material("EarLoop", LOOP, rough=.8)
    for s in (-1, 1):
        ear, en = head_frame(s * 1.5, -.16)
        for k, t in enumerate((0.0, 1.0)):
            mid, mn = head_frame(s * 1.22, -.2 - .25 * (1 - t))
            tube(f"EarLoop.{'L' if s > 0 else 'R'}{k}", [mask_point(s * MASK_SPAN, t), mid + mn * .022, ear + en * .01],
                 [.006, .006, .006], n=6, seg=8, mat=loop, part="head")


# ---------------------------------------------------------------- helmet
def helmet_edge(phi):
    """Elevation of the helmet's rim (seen from HELM_C): above the brows at the front, over the ears, low at the back."""
    a = abs(phi)
    return .30 - .56 * smooth(.35, 1.5, a) - .12 * smooth(1.9, 3.0, a)


def helmet_point(phi, el, grow=0.0):
    d = dir_of(phi, el)
    return HELM_C + Vector((d.x * (HELM_R[0] + grow), d.y * (HELM_R[1] + grow), d.z * (HELM_R[2] + grow)))


def build_helmet():
    cols, nrow = 72, 25
    rows = []
    for i in range(nrow):
        t = i / (nrow - 1)
        row = []
        for j in range(cols):
            phi = -math.pi + 2 * math.pi * j / cols
            e = helmet_edge(phi)
            row.append(helmet_point(phi, e + (math.pi / 2 - e) * t))
        rows.append(row)
    shell = grid("Helmet", rows, mat=material("Helmet", HELMET, rough=.45), part="head")
    m = shell.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = HELM_T, -1
    shell["headwear"] = True

    trim = material("HelmetTrim", TRIM, rough=.4)
    rim = [helmet_point(phi, helmet_edge(phi), -HELM_T / 2) for phi in (-math.pi + 2 * math.pi * k / 96 for k in range(97))]
    tube("HelmetRim", rim, [.02] * len(rim), n=2, seg=10, caps=False, mat=trim, part="head")["headwear"] = True

    # A short dark peak over the forehead.
    span, cols = .95, 33
    rows = []
    for i in range(6):
        t = i / 5
        row = []
        for j in range(cols):
            phi = -span + 2 * span * j / (cols - 1)
            p = helmet_point(phi, helmet_edge(phi), -HELM_T / 2)
            out = (Vector((math.sin(phi), -math.cos(phi), 0)) * .95 + Vector((0, 0, -.3))).normalized()
            row.append(p + out * (.075 * math.sqrt(max(0.0, 1 - (phi / span) ** 2)) * t))
        rows.append(row)
    peak = grid("HelmetPeak", rows, wrap=False, mat=trim, part="head")
    m = peak.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = .014, 0
    peak["headwear"] = True

    # Chin straps: down from the rim beside each cheek, close to the skin, ending under the side of the mask.
    for s in (-1, 1):
        pts = [helmet_point(s * .97, helmet_edge(s * .97), .004)]
        for phi, el, lift in ((.98, -.3, .016), (.94, -.58, .014), (.86, -.74, .004)):
            p, n = head_frame(s * phi, el)
            pts.append(p + n * lift)
        tube(f"ChinStrap.{'L' if s > 0 else 'R'}", pts, [.011] * len(pts), n=4, seg=8, mat=trim, part="head")


# ---------------------------------------------------------------- hair: dark curls puffing out under the helmet
HELM_IN = tuple(r - HELM_T - .006 for r in HELM_R)


def under_helmet(c, rho):
    """True when a blob of visible radius rho at c stays inside the helmet shell or hangs below its rim."""
    p = c - HELM_C
    q = Vector((p.x / HELM_IN[0], p.y / HELM_IN[1], p.z / HELM_IN[2]))
    L = q.length
    if L + rho / min(HELM_IN) < 1:
        return True
    el = math.asin(max(-1.0, min(1.0, q.z / L)))
    return el + 1.2 * rho / HELM_R[2] < helmet_edge(math.atan2(q.x, -q.y)) - .03


def hair_low(phi):
    """Lowest elevation the curls reach: wisps at the temples, past the jaw at the sides, the nape at the back."""
    a = abs(phi)
    if a < .5:
        return None
    if a < 1.0:
        return -.02 - (a - .5) / .5 * .2
    if a < 1.3:
        return -.22 - (a - 1.0) / .3 * .45
    return -.67 - smooth(1.3, math.pi, a) * .13


def build_hair(seed=11):
    rng = random.Random(seed)
    mb = bpy.data.metaballs.new("HairMeta")
    mb.resolution = mb.render_resolution = .02
    mb.threshold = .6
    meta = bpy.data.objects.new("HairMeta", mb)
    bpy.data.collections[COL].objects.link(meta)
    curls = []
    N, golden = 2800, math.pi * (3 - math.sqrt(5))
    for i in range(N):
        z = 1 - 2 * (i + .5) / N
        r, th = math.sqrt(1 - z * z), golden * i
        d = Vector((r * math.cos(th), r * math.sin(th), z))
        el, phi = math.asin(z), math.atan2(d.x, -d.y)
        low, edge = hair_low(phi), helmet_edge(phi)
        if low is None or not low < el < edge + .12:
            continue
        puff = math.exp(-((el - (edge - .3)) / .28) ** 2)   # fullest a little under the rim
        tip = smooth(low, low + .15, el)                      # thinner where the curls end
        base = HEAD_C + head_offset(d)
        off = (.06 + .07 * puff) * (.55 + .45 * tip) * (1 - .45 * smooth(1.15, .55, abs(phi)))  # tucked in at the temples
        ir = (.065 + .02 * puff) * (.6 + .4 * tip)
        cr = (.034 + .012 * rng.random()) * (.75 + .25 * tip)
        jitter = Vector(tuple(rng.uniform(-1, 1) for _ in range(3))) * .01
        for _ in range(12):
            ic, cc = base + d * off * .5, base + d * (off + .028) + jitter
            if under_helmet(ic, ir * .75) and under_helmet(cc, cr * .8):
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

    # Colour: dark brown on each curl, near black in the gaps, a few lighter curls catching the light.
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3).astype(float)
    C = np.array([c for c, _, _ in curls])
    Rc = np.array([r for _, r, _ in curls])
    tone = np.array([t for _, _, t in curls])
    palette = np.array([hex_rgb(h) for h in ("#2c1f1a", "#3a2a22", "#4a362c", "#5e4739")])
    dark = np.array(hex_rgb("#140d0a"))
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
    me.materials.append(material("Hair", rough=.85, vcol="Col"))

    ob = bpy.data.objects.new("Hair", me)
    bpy.data.collections[COL].objects.link(ob)
    ob["part"], ob["hair"] = "head", True
    tex = bpy.data.textures.get("HairCurls") or bpy.data.textures.new("HairCurls", "STUCCI")
    tex.noise_scale = .035
    m = ob.modifiers.new("Curls", "DISPLACE")
    m.texture, m.strength, m.mid_level = tex, .007, .5
    m = ob.modifiers.new("Decimate", "DECIMATE")
    m.ratio = .75
    return ob


# ---------------------------------------------------------------- printed fabrics
def floral_texture(name, bg, petal, petal_tip, centre, dot, leaf=None, n=22, size=(.06, .1), S=1024, seed=5):
    """Tileable five-petal flowers (with optional leaves) scattered over a plain ground."""
    rng = random.Random(seed)
    img = np.ones((S, S, 3)) * np.array(hex_rgb(bg))
    yy, xx = np.mgrid[0:S, 0:S].astype(float)

    def wrap(dx):
        return (dx + S / 2) % S - S / 2

    def place(k, rmin, rmax, gap, taken):
        for _ in range(4000):
            if k == 0:
                break
            r, x, y = rng.uniform(rmin, rmax) * S, rng.uniform(0, S), rng.uniform(0, S)
            if all(wrap(x - fx) ** 2 + wrap(y - fy) ** 2 > (r + fr + gap) ** 2 for fx, fy, fr in taken):
                taken.append((x, y, r))
                k -= 1
        return taken

    def over(a, color):
        nonlocal img
        img = img * (1 - a[..., None]) + np.array(hex_rgb(color)) * a[..., None]

    flowers = place(n, *size, 14 if leaf else 8, [])
    if leaf:
        for x, y, r in flowers:  # two leaves tucked behind each flower
            for _ in range(2):
                a = rng.uniform(0, 2 * math.pi)
                cx, cy = x + math.cos(a) * r * 1.05, y + math.sin(a) * r * 1.05
                dx, dy = wrap(xx - cx), wrap(yy - cy)
                u, v = dx * math.cos(a) + dy * math.sin(a), -dx * math.sin(a) + dy * math.cos(a)
                over(np.clip((1 - (u / (r * .75)) ** 2 - (v / (r * .32)) ** 2) * r * .3, 0, 1), leaf)
    pin, ptip = np.array(hex_rgb(petal)), np.array(hex_rgb(petal_tip))
    for x, y, r in flowers:
        dx, dy = wrap(xx - x), wrap(yy - y)
        rho, th = np.hypot(dx, dy), np.arctan2(dy, dx)
        shape = r * (.6 + .4 * np.abs(np.cos(2.5 * (th - rng.uniform(0, 2 * math.pi)))))
        a = np.clip(shape - rho + .5, 0, 1)
        c = pin + (ptip - pin) * np.clip(rho / shape, 0, 1)[..., None] ** 1.4
        img = img * (1 - a[..., None]) + c * a[..., None]
        over(np.clip(r * .22 - rho + .5, 0, 1), centre)
    for x, y, r in place(n * 2, .01, .018, 6, list(flowers))[len(flowers):]:
        over(np.clip(r - np.hypot(wrap(xx - x), wrap(yy - y)) + .5, 0, 1), dot)
    return save_image(name, img)


def stripe_texture(W=512, H=8):
    """The bag's weave: broad red stripes, white ones with a thin pink line, repeating across u."""
    u = (np.arange(W) + .5) / W
    c = np.empty((W, 3))
    for a, b, color in ((0, .5, BAG_RED), (.5, .68, BAG_WHITE), (.68, .72, BAG_PINK), (.72, .9, BAG_WHITE), (.9, 1, BAG_RED)):
        c[(u >= a) & (u < b)] = hex_rgb(color)
    return save_image("dama_stripes", np.repeat(c[None], H, axis=0))


# ---------------------------------------------------------------- jacket, skirt, arms, legs
JACKET_PROF = [(.33, .47), (.338, .52), (.348, .60), (.352, .68), (.346, .76), (.33, .83), (.305, .88), (.265, .925),
               (.215, .955), (.17, .975)]
JACKET_SMOOTH = [tuple(p) for p in catmull(JACKET_PROF, 3)]
JACKET_YS = .86
SKIRT_PROF = [(.29, .56), (.305, .47), (.32, .40), (.338, .30), (.355, .21), (.366, .15), (.37, .135)]


def belly(phi, z, r):
    return r * (1 + .08 * math.exp(-(phi / 1.0) ** 2) * math.exp(-((z - .60) / .14) ** 2))


def jacket_point(phi, z, lift=0.0):
    r = belly(phi, z, float(np.interp(z, [p[1] for p in JACKET_SMOOTH], [p[0] for p in JACKET_SMOOTH]))) + lift
    return Vector((math.sin(phi) * r, -math.cos(phi) * r * JACKET_YS, z))


# Arms: elbows out at her sides, forearms coming round her belly to the folded hands.
ARMS = {"L": ((.25, 0, .87), (.43, -.07, .66), (.12, -.40, .58)),
        "R": ((-.25, 0, .87), (-.43, -.07, .66), (-.12, -.40, .58))}
HOOK = Vector(ARMS["L"][1]).lerp(Vector(ARMS["L"][2]), .3) + Vector((0, 0, .08))   # where the bag handles hang


def build_body():
    jacket = material("Jacket", JACKET, rough=.95)
    rib = material("JacketRib", JACKET_RIB, rough=.95)

    body = lathe("Jacket", JACKET_SMOOTH, seg=64, ys=JACKET_YS, rad=belly, mat=jacket)
    m = body.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = .012, -1
    hem = lathe("JacketHem", [(.33, .455), (.336, .47), (.338, .5), (.334, .515)], seg=64, ys=JACKET_YS,
                rad=lambda phi, z, r: belly(phi, z, r) + .006, mat=rib)
    m = hem.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = .01, -1
    collar = lathe("Collar", [(.19, .935), (.196, .965), (.192, .995), (.18, 1.02), (.168, 1.028)], seg=48, ys=.92, mat=jacket)
    m = collar.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = .014, -1

    zip_m = material("Zip", ZIP, rough=.35, metallic=.4)
    front = [jacket_point(0, z, .007) for z in np.linspace(.46, .95, 12)]
    front += [Vector((0, -.196 * .92 - .009, .975)), Vector((0, -.18 * .92 - .009, 1.02))]
    tube("Zip", front, [.008] * len(front), n=3, seg=8, mat=zip_m)
    pull = front[-1] + Vector((0, -.012, -.035))
    G.box("ZipPull", (.022, .01, .045), pull, bevel=.004, mat=zip_m)

    glove = material("Glove", rough=.85, image=floral_texture(
        "dama_glove", "#cdb6e2", "#e07fa5", "#f4bdd0", "#a8528a", "#f2e2f4", n=16, size=(.07, .11), seed=9))
    for side, (sh, el, wr) in ARMS.items():
        sh, el, wr = Vector(sh), Vector(el), Vector(wr)
        tube(f"Sleeve.{side}", [sh, el, wr], [.09, .082, .074], n=6, mat=jacket)
        dirn = (wr - el).normalized()
        tube(f"Cuff.{side}", [wr - dirn * .025, wr + dirn * .03], [.079, .077], n=1, mat=rib)
    # Folded hands: the left one underneath, the right one resting on it, thumbs on top.
    for side, loc, rot in (("L", (.045, -.40, .565), -.12), ("R", (-.04, -.425, .585), .1)):
        s = 1 if side == "L" else -1
        ellipsoid(f"Hand.{side}", (.085, .056, .066), loc=loc, rot=(0, 0, rot), mat=glove, u_rep=2)
        ellipsoid(f"Thumb.{side}", (.025, .025, .038), loc=Vector(loc) + Vector((s * .05, -.034, .05)),
                  rot=(0, s * .5, 0), mat=glove, seg=12, rings=8)

    skirt_tex = floral_texture("dama_skirt", "#474c62", "#e48f8c", "#f7c6be", "#b8565f", "#efd3cf", leaf="#6b7f6a",
                               n=14, size=(.07, .11), seed=4)
    skirt = lathe("Skirt", [tuple(p) for p in catmull(SKIRT_PROF, 3)], seg=72, ys=JACKET_YS,
                  rad=lambda phi, z, r: r * (1 + .022 * math.sin(9 * phi) * smooth(.42, .14, z)),  # soft folds at the hem
                  u_rep=3, v_len=.5, mat=material("Skirt", rough=.85, image=skirt_tex))
    m = skirt.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = .01, -1

    legs, shoe_m, sole_m = material("Legs", LEGS, rough=.8), material("Shoe", SHOE, rough=.6), material("Sole", SOLE, rough=.8)
    for s in (-1, 1):
        side = "L" if s > 0 else "R"
        tube(f"Leg.{side}", [(s * .13, 0, .48), (s * .135, -.01, .3), (s * .14, -.02, .1)], [.1, .095, .085], n=4, mat=legs)
        shoe = ellipsoid(f"Shoe.{side}", (.085, .14, .062), loc=(s * .14, -.085, .048), mat=shoe_m)
        for v in shoe.data.vertices:
            v.co.z = max(v.co.z, -.03)
        sole = ellipsoid(f"Sole.{side}", (.09, .145, .022), loc=(s * .14, -.085, .015), mat=sole_m)
        for v in sole.data.vertices:
            v.co.z = max(v.co.z, -.014)


# ---------------------------------------------------------------- striped bag of spring onions
BAG_C, BAG_YAW = Vector((.44, -.29, .33)), .35   # bag centre and how far it turns out to her left
BAG_TOP = .2                                       # height of the opening above BAG_C


def bag_section(t):
    """Half width, half depth and height at t (0 bottom .. 1 open top) of the soft tote, in its own frame."""
    k = math.sqrt(max(0.0, 1 - (max(0.0, .18 - t) / .18) ** 2))  # rounded bottom
    return (.165 + .03 * math.sin(math.pi * t * .9)) * k, (.068 + .03 * math.sin(math.pi * t * .85)) * k, BAG_TOP * (2 * t - 1)


def build_bag():
    M = Matrix.Translation(BAG_C) @ Matrix.Rotation(BAG_YAW, 4, "Z")
    seg, nrow, ex = 48, 15, 2 / 3.5  # superellipse cross-section
    rows = []
    for i in range(nrow):
        a, b, z = bag_section(i / (nrow - 1))
        row = []
        for j in range(seg):
            th = 2 * math.pi * j / seg
            c, s = math.cos(th), math.sin(th)
            row.append(M @ Vector((a * math.copysign(abs(c) ** ex, c), b * math.copysign(abs(s) ** ex, s), z)))
        rows.append(row)
    red = material("BagRed", BAG_RED, rough=.7)
    bag = grid("Bag", rows, us=[6 * j / seg for j in range(seg + 1)], mat=material("Bag", rough=.75, image=stripe_texture()),
               part="bag")
    m = bag.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = .008, -1
    tube("BagRim", rows[-1] + rows[-1][:1], [.009] * (seg + 1), n=1, seg=8, caps=False, mat=red, part="bag")

    # Handles: one from each face, round the outside / inside of her forearm and over the top of it.
    el, wr = Vector(ARMS["L"][1]), Vector(ARMS["L"][2])
    along = (wr - el).normalized()
    out = along.cross(Vector((0, 0, 1))).normalized()
    if out.dot(Vector((1, -1, 0))) < 0:
        out = -out
    a, b, _ = bag_section(1)
    for k, (face, side) in enumerate(((-1, 1), (1, -1))):
        ends = [M @ Vector((x, face * b, BAG_TOP)) for x in (-.08, .08)]
        top = HOOK + Vector((0, 0, .014)) + along * (.016 * (k - .5) * 2)
        path = [ends[0], ends[0].lerp(top, .55) + out * side * .1, top, ends[1].lerp(top, .55) + out * side * .1, ends[1]]
        tube(f"BagHandle.{k}", path, [.011] * len(path), n=6, seg=8, mat=red, part="bag")

    # A bunch of spring onions: pale stalks in the bag, each opening into two thick green leaves above the rim.
    green, green2, white = material("Onion", ONION, rough=.55), material("Onion2", ONION2, rough=.55), material("OnionWhite", ONION_WHITE, rough=.5)
    T = BAG_TOP
    for k, (x, y, lean, h) in enumerate(((-.07, .015, .03, .32), (-.025, -.02, .07, .38), (.025, .02, .11, .35),
                                         (.07, -.012, .15, .29))):
        tube(f"OnionWhite.{k}", [M @ Vector((x, y, -.05)), M @ Vector((x * 1.05, y, T + .03))], [.027, .026], n=1, seg=14,
             mat=white, part="bag")
        fork = Vector((x * 1.1, y, T + .02))
        mat = green if k % 2 else green2
        for leaf, (dx, dy, hh) in enumerate(((lean, -.04, h), (lean * .3 - .04, .05, h * .78))):
            mid = fork + Vector((dx * .45, dy * .5, hh * .55))
            tip = fork + Vector((dx, dy, hh)) - Vector((0, 0, .05 if leaf else 0))
            tube(f"Onion.{k}.{leaf}", [M @ fork, M @ mid, M @ tip], [.024 if leaf == 0 else .019, .018, .007], n=6, seg=12,
                 mat=mat, part="bag")


# ---------------------------------------------------------------- assembly, preview and entry point
# Pivots the app can turn (glTF node names: no dots). Her arms stay folded, so only the legs and the bag move.
JOINTS = {
    "hip_L": ((.13, 0, .48), ("Leg.L", "Shoe.L", "Sole.L")),
    "hip_R": ((-.13, 0, .48), ("Leg.R", "Shoe.R", "Sole.R")),
}


def assemble():
    """dama -> head_pivot (head, mask, hair, helmet), hip_L/R, bag (hangs from HOOK), and the rest of the body."""
    col = bpy.data.collections[COL]

    def empty(name, loc):
        ob = bpy.data.objects.new(name, None)
        col.objects.link(ob)
        ob.location = loc
        return ob

    root = empty("dama", (0, 0, 0))
    pivot = empty("head_pivot", NECK)
    bag = empty("bag", HOOK)
    joints = {name: empty(name, loc) for name, (loc, _) in JOINTS.items()}
    owner = {part: joints[name] for name, (_, parts) in JOINTS.items() for part in parts}
    holders = {root, pivot, bag, *joints.values()}
    bpy.context.view_layer.update()

    def attach(ob, parent):
        mw = ob.matrix_world.copy()
        ob.parent = parent
        ob.matrix_world = mw

    for ob in list(col.objects):
        if ob in holders:
            continue
        part = ob.get("part")
        attach(ob, pivot if part == "head" else bag if part == "bag" else owner.get(ob.name, root))
    for ob in (pivot, bag, *joints.values()):
        attach(ob, root)
    pivot.rotation_euler = (HEAD_TILT, 0, 0)
    return root


def build():
    if bpy.data.collections.get("Grandma"):
        raise RuntimeError("the grandma is in this file: start from File > New so her materials are left alone")
    G.reset()
    build_head()
    build_mask()
    build_hair()
    build_helmet()
    build_body()
    build_bag()
    assemble()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "dama.blend"))
    return f"built {len(bpy.data.collections[COL].objects)} objects, {G.triangle_count()} triangles"


GLB_PATH = os.path.join(os.path.dirname(HERE), "prototype-3d", "models", "dama.glb")


def export_glb(path=GLB_PATH, image_format="AUTO"):
    """The Dama collection only, modifiers applied, custom properties (hair / headwear / part) kept as glTF extras."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    for ob in bpy.data.collections[COL].all_objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects["dama"]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_extras=True, export_yup=True, export_image_format=image_format,
                              export_jpeg_quality=85, export_vertex_color="MATERIAL", export_animations=False,
                              export_cameras=False, export_lights=False)
    return path, os.path.getsize(path)


VIEWS = {  # direction towards the camera, framing centre, ortho scale
    "front": ((0, -1, 0), (.08, 0, .98), 2.4),
    "side": ((1, 0, 0), (0, 0, .98), 2.4),
    "three_quarter": ((.55, -1, .18), (.05, 0, .95), 2.6),
    "back": ((0, 1, .1), (0, 0, .98), 2.4),
    "face": ((0, -1, .05), (0, 0, 1.42), 1.3),
    "face_three_quarter": ((.5, -1, .1), (0, 0, 1.42), 1.3),
}


def render_previews(views=("front", "side", "three_quarter"), size=(640, 820), sheet="dama_sheet"):
    """Renders each view to previews/dama_<view>.png over the pink backdrop and lays them side by side in one sheet."""
    G.setup_preview()
    scene = bpy.context.scene
    col = bpy.data.collections[PREVIEW]
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    os.makedirs(G.PREVIEW_DIR, exist_ok=True)
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
        scene.render.filepath = os.path.join(G.PREVIEW_DIR, f"dama_{v}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    tiles, pink = [], np.array([*hex_rgb(G.BACKDROP), 1.0], np.float32)
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
    path = os.path.join(G.PREVIEW_DIR, sheet + ".png")
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
