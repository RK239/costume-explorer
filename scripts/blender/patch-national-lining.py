# Patch the hole in the National Costume's cape lining (headless Blender, run from the repo root):
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/patch-national-lining.py
#   npm run models
# Reads the original scan from models-src/originals/ and writes models-src/National Costume.glb.
#
# Why a patch and not Fill Holes: the scan builds the thin lining as a closed shell (front and back
# about 3 mm apart), so the hole is a tunnel through it with no open edge to fill. This lays a new
# piece of lining over it, as you would by hand: a grid seen from a camera facing the hole, set on a
# smooth surface fitted to the lining around it (1.5 mm in front), with its own small texture in
# which the lining's stripes are continued straight across from the real lining on either side.
# CAM, LOOK and OUTLINE were measured in the app (turntable-local metres, and pixels of that view);
# HEIGHT and LIFT are this model's placement in models.config.json.
import bpy, bmesh, os, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(ROOT, "models-src", "originals", "National Costume.glb")
OUT = os.path.join(ROOT, "models-src", "National Costume.glb")
HEIGHT, LIFT = 1.07, 0.4                                 # placement in models.config.json (rotateY 180)
CAM, LOOK = (0.8364, 0.75, 0.1527), (-0.1513, 0.75, -0.0037)  # the app's camera facing the hole (stage)
RES = (1024, 768)
# The patch outline, in pixels of that camera's 1024 x 768 view: around the hole, on intact lining,
# clear of the embroidered border.
OUTLINE = [(300, 185), (345, 190), (385, 240), (410, 300), (415, 380), (410, 470), (400, 560),
           (385, 620), (350, 660), (300, 670), (250, 650), (215, 600), (205, 520), (212, 430),
           (225, 340), (250, 260), (275, 205)]
STEP = 8            # px between patch vertices (about 5 mm on the fabric; the surface is smooth)
LIFT_MM = 1.5       # the patch sits this far in front of the fitted lining
RING = 28           # px: the band outside the outline used to fit the lining's surface

# --- Load the scan -------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
me = bpy.context.view_layer.objects.active.data
faces_before = len(me.polygons)

co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
g = np.stack([co[:, 0], co[:, 2], -co[:, 1]], axis=1); gmin, gmax = g.min(0), g.max(0)
s = HEIGHT / (gmax[1] - gmin[1]); cx, cz = (gmin[0] + gmax[0]) / 2, (gmin[2] + gmax[2]) / 2
to_b = lambda p: Vector((cx - p[0] / s, -(cz - p[2] / s), (p[1] - LIFT) / s + gmin[1]))

verts = [v.co.copy() for v in me.vertices]
polys = [tuple(p.vertices) for p in me.polygons]
bvh = BVHTree.FromPolygons(verts, polys, all_triangles=False)
uv_layer = me.uv_layers.active.data
poly_uvs = [[uv_layer[li].uv.copy() for li in p.loop_indices] for p in me.polygons]

img = next(n.image for n in me.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE')
w, h = img.size
px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px)
px = px.reshape(h, w, 4)[:, :, :3]
texel = lambda uv: px[min(h - 1, max(0, int(uv.y * h))), min(w - 1, max(0, int(uv.x * w)))]

# --- Camera rays ---------------------------------------------------------------------------------
eye = to_b(CAM)
forward = (to_b(LOOK) - eye).normalized()
right = forward.cross(Vector((0, 0, 1))).normalized()
up = right.cross(forward).normalized()
tan_v = math.tan(math.radians(30) / 2)
aspect = RES[0] / RES[1]

def ray_dir(x, y):
    nx = (x / RES[0]) * 2 - 1
    ny = 1 - (y / RES[1]) * 2
    return (forward + right * (nx * tan_v * aspect) + up * (ny * tan_v)).normalized()

def first_hit(d):
    loc, nrm, idx, dist = bvh.ray_cast(eye, d)
    return (loc, idx, dist) if loc is not None else (None, None, None)

def uv_at(loc, idx):
    poly = me.polygons[idx]
    pts = [verts[v] for v in poly.vertices]
    wts = poly_3d_calc(pts, loc)
    return sum((poly_uvs[idx][i] * wts[i] for i in range(len(pts))), Vector((0.0, 0.0)))

def inside(x, y, poly=OUTLINE):
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c

def dist_to_outline(x, y):
    best = 1e9
    for i in range(len(OUTLINE)):
        (x1, y1), (x2, y2) = OUTLINE[i], OUTLINE[i - 1]
        vx, vy = x2 - x1, y2 - y1
        t = max(0, min(1, ((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy)))
        best = min(best, math.hypot(x - x1 - t * vx, y - y1 - t * vy))
    return best

# --- Fit the lining's front surface around the hole (depth along each ray) -----------------------
xs = [p[0] for p in OUTLINE]; ys = [p[1] for p in OUTLINE]
samples = []
for y in range(min(ys) - RING, max(ys) + RING, 3):
    for x in range(min(xs) - RING, max(xs) + RING, 3):
        if inside(x, y) or dist_to_outline(x, y) > RING:
            continue
        loc, idx, dist = first_hit(ray_dir(x, y))
        if loc is not None:
            samples.append((x, y, dist))
S = np.array(samples, dtype=np.float64)
def design(a):
    x, y = (a[:, 0] - 512) / 512, (a[:, 1] - 384) / 384
    return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], axis=1)
# Robust: the lining is the nearest surface here; the breeches seen past its edge lie centimetres
# behind. Start from the nearest 55% of samples, then keep only those within 5 mm of the fit.
keep = S[:, 2] <= np.percentile(S[:, 2], 55)
for _ in range(8):
    coef, *_ = np.linalg.lstsq(design(S[keep]), S[keep, 2], rcond=None)
    resid = S[:, 2] - design(S) @ coef
    keep = np.abs(resid) < 0.005 / s
print(f"lining fit: {keep.sum()} of {len(S)} ring samples, residual {np.std(resid[keep]) * s * 1000:.2f} mm")
depth = lambda x, y: float(design(np.array([[x, y, 0.0]])) @ coef)

# --- Build the patch grid -------------------------------------------------------------------------
grid = {}
for y in range(min(ys), max(ys) + STEP, STEP):
    for x in range(min(xs), max(xs) + STEP, STEP):
        if inside(x, y):
            d = ray_dir(x, y)
            grid[(x, y)] = eye + d * (depth(x, y) - (LIFT_MM / 1000) / s)
cells = [(x, y) for (x, y) in grid if (x + STEP, y) in grid and (x, y + STEP) in grid and (x + STEP, y + STEP) in grid]
print(f"patch grid: {len(grid)} vertices, {len(cells)} cells")

# --- Texture: continue the lining's stripes across the hole ----------------------------------------
# The stripes run almost level in this view. Measure their exact tilt, read each stripe row's colour
# from the real lining around the patch (left and right of the hole, above and below it), and paint
# every row straight across: the stripes then meet the real lining in step on both sides.
ring = []  # (x, y, colour) on the lining's front, just outside the outline
for y in range(min(ys) - RING, max(ys) + RING, 1):
    for x in range(min(xs) - RING, max(xs) + RING, 2):
        if inside(x, y) or dist_to_outline(x, y) > RING:
            continue
        loc, idx, dist = first_hit(ray_dir(x, y))
        if loc is None or abs(dist - depth(x, y)) > 0.005 / s:
            continue
        c = texel(uv_at(loc, idx))
        hi, lo = c.max(), c.min()
        if hi < 0.3 or (hi - lo) / hi > 0.28:   # not lining: dark, or the embroidery's pink and gold
            continue
        ring.append((x, y, c))
R_ = np.array([(x, y) for x, y, _ in ring], dtype=np.float64)
C_ = np.array([c for *_, c in ring])
lum = C_ @ np.array([0.2126, 0.7152, 0.0722])
xm = (min(xs) + max(xs)) / 2

def profile(tilt):
    r = R_[:, 1] - (R_[:, 0] - xm) * math.tan(tilt)
    bins = np.round(r).astype(int)
    lo = bins.min()
    sums = np.bincount(bins - lo, weights=lum); counts = np.bincount(bins - lo)
    ok = counts > 0
    return lo, bins, ok, sums, counts

best_tilt, best_score = 0.0, -1
for deg in np.arange(-12, 12.01, 0.25):
    lo, bins, ok, sums, counts = profile(math.radians(deg))
    means = sums[ok] / counts[ok]
    score = np.average((means - means.mean()) ** 2, weights=counts[ok])
    if score > best_score:
        best_tilt, best_score = math.radians(deg), score
lo, bins, ok, *_ = profile(best_tilt)
# Per stripe row, the lining samples sorted along the row, so each point of the patch can take its
# colour from the nearest real lining on its left and right (keeps the local shading, matches both
# borders), instead of one median per row, which washes out to grey.
rows = {}
for (x, y), c, b in zip(R_, C_, bins):
    rows.setdefault(b, []).append((x, c))
rows = {b: (np.array([x for x, _ in v]), np.array([c for _, c in v])) for b, v in rows.items()
        if len(v) >= 2}
for b in rows:
    order = np.argsort(rows[b][0]); rows[b] = (rows[b][0][order], rows[b][1][order])
known = np.array(sorted(rows))
print(f"lining samples {len(ring)}, stripe tilt {math.degrees(best_tilt):.2f} deg, rows {len(known)}")

def row_at(b, x):
    if b not in rows:
        b = int(known[np.argmin(np.abs(known - b))])
    xsr, cs = rows[b]
    k = np.searchsorted(xsr, x)
    left = cs[max(0, k - 3):k]; right = cs[k:k + 3]
    if len(left) and len(right):
        dl, dr = x - xsr[k - 1], xsr[k] - x
        return (np.median(left, axis=0) * dr + np.median(right, axis=0) * dl) / (dl + dr)
    return np.median(left if len(left) else right, axis=0)

def colour_at_row(r, x):
    r0 = int(math.floor(r)); t = r - r0
    return row_at(r0, x) * (1 - t) + row_at(r0 + 1, x) * t

x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
TW, TH = 256, 512
baked = np.empty((TH, TW, 3), dtype=np.float32)
for j in range(TH):
    y = y1 - (j + 0.5) / TH * (y1 - y0)      # image rows run bottom-up in Blender
    for i in range(TW):
        x = x0 + (i + 0.5) / TW * (x1 - x0)
        baked[j, i] = colour_at_row(y - (x - xm) * math.tan(best_tilt), x)
patch_img = bpy.data.images.new("lining_patch", TW, TH, alpha=False)
patch_img.colorspace_settings.name = img.colorspace_settings.name
rgba = np.concatenate([baked, np.ones((TH, TW, 1), dtype=np.float32)], axis=2)
patch_img.pixels.foreach_set(rgba.ravel())
patch_img.pack()

patch_mat = me.materials[0].copy()
patch_mat.name = "lining_patch"
next(n for n in patch_mat.node_tree.nodes if n.type == 'TEX_IMAGE').image = patch_img
me.materials.append(patch_mat)
PATCH_SLOT = len(me.materials) - 1
patch_uv = lambda k: Vector(((k[0] - x0) / (x1 - x0), 1 - (k[1] - y0) / (y1 - y0)))

# --- Add it to the mesh ---------------------------------------------------------------------------
bm = bmesh.new(); bm.from_mesh(me)
uvl = bm.loops.layers.uv.active
bverts = {k: bm.verts.new(p) for k, p in grid.items()}
for (x, y) in cells:
    quad = [(x, y), (x, y + STEP), (x + STEP, y + STEP), (x + STEP, y)]  # wound to face the camera
    for tri in ([quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]):
        f = bm.faces.new([bverts[k] for k in tri])
        f.material_index = PATCH_SLOT
        for loop, k in zip(f.loops, tri):
            loop[uvl].uv = patch_uv(k)
bm.normal_update()
bm.to_mesh(me); bm.free(); me.update()
print(f"added {2 * len(cells)} triangles with their own {TW}x{TH} texture; faces {faces_before} -> {len(me.polygons)}")
print("valid:", not me.validate(verbose=False, clean_customdata=False))

co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
g2 = np.stack([co[:, 0], co[:, 2], -co[:, 1]], axis=1)
print(f"bounds unchanged: {np.allclose(g2.min(0), gmin) and np.allclose(g2.max(0), gmax)}")
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True,
                          export_image_format='AUTO', export_materials='EXPORT')
print("wrote", OUT)
