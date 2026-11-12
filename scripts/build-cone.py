# Рожок для 3D из листа «Четыре ракурса ванильного рожка с клубничным джемом.png».
# Вход — 4 ракурса (view0..3.png, уже вырезаны и увеличены: scripts/cone-views.py), выход:
#   public/cone/atlas-<вкус>.webp — 4 ракурса в ряд (клубника как на фото, малина и ежевика — перекрашен только джем);
#   src/three/profile.json — общий профиль тела вращения + для каждого ракурса центр и полуширина каждой строки.
# Внутри силуэта каждого ракурса фото сплошное: капли, свисающие сбоку за край вафли, плавно срезаны,
# пустоты закрашены соседними цветами — при повороте не бывает дыр.
# python -I scripts/build-cone.py <папка с view*.png> public/cone src/three/profile.json <превью>
import sys, json, numpy as np, cv2
from PIL import Image

src, out_dir, prof_path, dbg = sys.argv[1:5]
TH = 1720  # высота ракурса в атласе
views = [np.array(Image.open(f"{src}/view{k}.png").convert("RGBA")) for k in range(4)]
# одинаковая высота от макушки до кончика
views = [np.array(Image.fromarray(v).resize((round(v.shape[1] * TH / v.shape[0]), TH), Image.LANCZOS)) for v in views]
TW = max(v.shape[1] for v in views) + 24

def body_fill(v):
    """Сплошная форма ракурса: строки от края до края тела, ниже кромки — не шире конуса."""
    A = v[:, :, 3] > 128
    H, W = A.shape
    body = A.astype(np.uint8)
    opened = cv2.morphologyEx(body, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (41, 1)))
    opened[: int(H * 0.07)] = body[: int(H * 0.07)]
    n, lab, st, _ = cv2.connectedComponentsWithStats(opened, 8)
    core = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    ry = np.arange(int(H * 0.6), int(H * 0.92))
    lx = np.array([np.where(core[y])[0].min() for y in ry])
    rx = np.array([np.where(core[y])[0].max() for y in ry])
    lfit, rfit = np.polyfit(ry, lx, 1), np.polyfit(ry, rx, 1)
    hsv = cv2.cvtColor(v[:, :, :3], cv2.COLOR_RGB2HSV)
    cream = (hsv[:, :, 1] < 70) & (hsv[:, :, 2] > 170) & A
    mid = (np.polyval(lfit, H * 0.5) + np.polyval(rfit, H * 0.5)) / 2
    band = cream[:, int(mid - W * 0.12) : int(mid + W * 0.12)]
    rows_c = np.where(band.sum(1) >= int(W * 0.04))[0]
    rows_c = rows_c[rows_c < H * 0.62]
    rim = int(rows_c.max()) if len(rows_c) else int(H * 0.5)
    taper = int(H * 0.035)
    fill = np.zeros_like(core)
    for y in range(H):
        xr = np.where(core[y])[0]
        if not len(xr):
            continue
        a0, a1 = xr.min(), xr.max()
        if y >= rim:
            t = min(1.0, (y - rim) / taper)
            keep = (1 - t) ** 2 * (3 - 2 * (1 - t)) if t < 1 else 0.0
            cl, cr = np.polyval(lfit, y) - 1, np.polyval(rfit, y) + 1
            a0 = int(round(max(a0, cl - max(0, cl - a0) * keep)))
            a1 = int(round(min(a1, cr + max(0, a1 - cr) * keep)))
        if a1 > a0:
            fill[y, a0 : a1 + 1] = 1
    return fill, rim

def jam_mask(v, rim):
    hsv = cv2.cvtColor(v[:, :, :3], cv2.COLOR_RGB2HSV).astype(np.float32)
    h, s = hsv[:, :, 0], hsv[:, :, 1]
    rgbf = v[:, :, :3].astype(np.float32)
    fg = v[:, :, 3] > 20
    # джем заметно краснее всего остального: вафля рыжая (R/G ≈ 1.35), тени пломбира тёплые (≈ 1.1), джем — от 1.6
    redness = rgbf[:, :, 0] / np.maximum(rgbf[:, :, 1], 1)
    core = ((h < 9) | (h > 165)) & (s > 95) & fg & (redness > 1.7)
    soft = ((h < 11) | (h > 162)) & (s > 50) & fg & (redness > 1.55)  # полупрозрачный джем на пломбире
    m = (core | soft).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    return np.clip(cv2.GaussianBlur(m.astype(np.float32), (5, 5), 0) * 1.3, 0, 1)

# перекраска джема: палитра с настоящих фото пользователя (малина, ежевика) — по яркости.
# Каждому пикселю клубничного джема даём цвет той же «доли яркости» из настоящего джема: тени, семечки, блики сохраняются.
REF = {
    "raspberry": "C:/Users/slida/Downloads/Ванильное мороженое с малиновым джемом.png",
    "blackberry": "C:/Users/slida/Downloads/Ванильное мороженое с ежевичным джемом-1.png",
}
def ref_palette(path):
    r = np.array(Image.open(path).convert("RGBA"))
    hsv = cv2.cvtColor(r[:, :, :3], cv2.COLOR_RGB2HSV).astype(np.float32)
    h, s_, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    # джем на фото: пурпурно-малиновый, насыщенный (вафля — оранжевая, пломбир — бесцветный)
    m = (r[:, :, 3] > 200) & (((h >= 130) & (s_ > 60)) | ((h < 6) & (s_ > 90) & (v < 200)))
    px = r[:, :, :3][m].astype(np.float32)
    lum = px @ np.array([0.299, 0.587, 0.114])
    order = np.argsort(lum)
    px = px[order]
    # 256 ступеней по доле яркости: средний цвет каждой
    bins = np.array_split(np.arange(len(px)), 256)
    return np.array([px[b].mean(0) for b in bins])
PAL = {k: ref_palette(v) for k, v in REF.items()}

tiles = {k: [] for k in ["strawberry", "raspberry", "blackberry"]}
prof_views = []
for k, v in enumerate(views):
    fill, rim = body_fill(v)
    H, W = fill.shape
    rgb = cv2.cvtColor(v[:, :, :3], cv2.COLOR_RGB2BGR)
    holes = ((v[:, :, 3] < 230) | (fill == 0)).astype(np.uint8)
    rgb = cv2.cvtColor(cv2.inpaint(rgb, holes, 5, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    alpha = np.clip(cv2.GaussianBlur(fill.astype(np.float32), (3, 3), 0) * 255, 0, 255).astype(np.uint8)
    jm = jam_mask(v, rim)[:, :, None]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    off = (TW - W) // 2
    for name in tiles:
        if name == "strawberry":
            col = rgb.astype(np.float32)
        else:
            # доля яркости пикселя среди всего джема этого ракурса → цвет той же доли у настоящего джема
            lum = rgb.astype(np.float32) @ np.array([0.299, 0.587, 0.114])
            sel = jm[:, :, 0] > 0.3
            ranks = np.zeros_like(lum)
            vals = np.sort(lum[sel])
            ranks = np.searchsorted(vals, lum) / max(1, len(vals))
            idx = np.clip((ranks * 255).astype(int), 0, 255)
            jamc = PAL[name][idx]
            col = rgb.astype(np.float32) * (1 - jm) + jamc * jm
        t = np.zeros((TH, TW, 4), np.uint8)
        t[:, off : off + W, :3] = np.clip(col, 0, 255).astype(np.uint8)
        t[:, off : off + W, 3] = alpha
        tiles[name].append(t)
    # профиль ракурса: центр и полуширина по строкам (в долях ширины плитки)
    N = 220
    rows = []
    for i in range(N + 1):
        y = min(TH - 1, int(i / N * (TH - 1)))
        xr = np.where(fill[y])[0]
        rows.append((xr.min() + off, xr.max() + off) if len(xr) else (np.nan, np.nan))
    l = np.array([r[0] for r in rows], float)
    r = np.array([r[1] for r in rows], float)
    idx = np.arange(N + 1)
    for arr in (l, r):
        ok = ~np.isnan(arr)
        arr[~ok] = np.interp(idx[~ok], idx[ok], arr[ok])
    k5 = np.ones(5) / 5
    cx = np.convolve((l + r) / 2, k5, "same")
    rr = np.convolve((r - l) / 2, k5, "same")
    cx[:2], cx[-2:] = ((l + r) / 2)[:2], ((l + r) / 2)[-2:]
    rr[:2], rr[-2:] = ((r - l) / 2)[:2], ((r - l) / 2)[-2:]
    prof_views.append({"cx": [round(float(c) / TW, 5) for c in cx], "r": [round(max(0.002, float(x)) / TW, 5) for x in rr]})
    print("view", k, "rim", rim, "of", H)

for name, ts in tiles.items():
    Image.fromarray(np.hstack(ts)).save(f"{out_dir}/atlas-{name}.webp", "WEBP", quality=90, method=6)
N = 220
mean_r = [round(float(np.mean([pv["r"][i] for pv in prof_views])), 5) for i in range(N + 1)]
json.dump({"w": TW, "h": TH, "v": [round(1 - i / N, 5) for i in range(N + 1)], "r": mean_r, "views": prof_views}, open(prof_path, "w"))

# превью
prev = []
for name in tiles:
    im = Image.open(f"{out_dir}/atlas-{name}.webp").convert("RGBA")
    bg = Image.new("RGBA", im.size, (40, 80, 160, 255))
    prev.append(Image.alpha_composite(bg, im).convert("RGB").resize((im.width // 4, im.height // 4)))
sh = Image.new("RGB", (prev[0].width, prev[0].height * 3))
for i, p in enumerate(prev):
    sh.paste(p, (0, i * prev[0].height))
sh.save(dbg + "/atlas.jpg")
print("ok", TW, TH)
