# Рожок для 3D по листам пользователя «Четыре рожка с … джемом» (по листу на вкус, одинаковый кадр).
# Вход — ракурсы <src>/<вкус>/view0..3.png (вырезаны одними рамками и увеличены: scripts/cone-views.py), выход:
#   public/cone/atlas-<вкус>.webp — 4 ракурса в ряд (джем — как на листе этого вкуса, без перекраски);
#   public/cone/front-<вкус>.webp — лицо рожка (view0) в двойном разрешении, если есть <вкус>/front.png;
#   src/three/profile.json — общий профиль тела вращения + для каждого ракурса центр и полуширина каждой строки.
# Форма одна на все вкусы (по объединённому силуэту): внутри неё фото сплошное, капли, свисающие сбоку за край
# вафли, плавно срезаны, пустоты закрашены соседними цветами — при повороте не бывает дыр, при смене вкуса силуэт не дёргается.
# python -I scripts/build-cone.py <папка> public/cone src/three/profile.json <превью>
import sys, os, json, numpy as np, cv2
from PIL import Image

src, out_dir, prof_path, dbg = sys.argv[1:5]
NAMES = ["strawberry", "blackberry", "raspberry"]
TH = 1720  # высота ракурса в атласе
views = {n: [np.array(Image.open(f"{src}/{n}/view{k}.png").convert("RGBA")) for k in range(4)] for n in NAMES}
for n in NAMES:
    views[n] = [np.array(Image.fromarray(v).resize((round(v.shape[1] * TH / v.shape[0]), TH), Image.LANCZOS)) for v in views[n]]
TW = max(v.shape[1] for n in NAMES for v in views[n]) + 24

def body_fill(A, ref_rgb):
    """Сплошная форма ракурса: строки от края до края тела, ниже кромки — не шире конуса."""
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
    hsv = cv2.cvtColor(ref_rgb, cv2.COLOR_RGB2HSV)
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

tiles = {n: [] for n in NAMES}
prof_views = []
for k in range(4):
    W = max(views[n][k].shape[1] for n in NAMES)
    vs = {}
    for n in NAMES:  # одинаковая ширина холста ракурса у всех вкусов
        v = views[n][k]
        pad = np.zeros((TH, W, 4), np.uint8)
        pad[:, : v.shape[1]] = v
        vs[n] = pad
    A = np.max(np.stack([vs[n][:, :, 3] > 128 for n in NAMES]), 0)
    fill, rim = body_fill(A, vs["strawberry"][:, :, :3])
    alpha = np.clip(cv2.GaussianBlur(fill.astype(np.float32), (3, 3), 0) * 255, 0, 255).astype(np.uint8)
    off = (TW - W) // 2
    for n in NAMES:
        v = vs[n]
        bgr = cv2.cvtColor(v[:, :, :3], cv2.COLOR_RGB2BGR)
        holes = ((v[:, :, 3] < 230) | (fill == 0)).astype(np.uint8)
        rgb = cv2.cvtColor(cv2.inpaint(bgr, holes, 5, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
        t = np.zeros((TH, TW, 4), np.uint8)
        t[:, off : off + W, :3] = rgb
        t[:, off : off + W, 3] = alpha
        tiles[n].append(t)
        # лицо рожка (view0) — отдельно в двойном разрешении (EDSR x4): его видно почти всё время
        if k == 0 and os.path.exists(f"{src}/{n}/front.png"):
            f = np.array(Image.open(f"{src}/{n}/front.png").convert("RGBA"))
            H2, W2 = TH * 2, W * 2
            f = np.array(Image.fromarray(f).resize((round(f.shape[1] * H2 / f.shape[0]), H2), Image.LANCZOS))
            fp = np.zeros((H2, W2, 4), np.uint8)
            fp[:, : min(W2, f.shape[1])] = f[:, :W2]
            fill2 = cv2.resize(fill.astype(np.float32), (W2, H2), interpolation=cv2.INTER_LINEAR) > 0.5
            fb = cv2.cvtColor(fp[:, :, :3], cv2.COLOR_RGB2BGR)
            holes2 = ((fp[:, :, 3] < 230) | ~fill2).astype(np.uint8)
            rgb2 = cv2.cvtColor(cv2.inpaint(fb, holes2, 7, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
            al2 = np.clip(cv2.GaussianBlur(fill2.astype(np.float32), (5, 5), 0) * 255, 0, 255).astype(np.uint8)
            ft = np.zeros((H2, TW * 2, 4), np.uint8)
            ft[:, off * 2 : off * 2 + W2, :3] = rgb2
            ft[:, off * 2 : off * 2 + W2, 3] = al2
            Image.fromarray(ft).save(f"{out_dir}/front-{n}.webp", "WEBP", quality=90, method=6)
            print("front", n, ft.shape, flush=True)
    N = 220
    l, r = [], []
    for i in range(N + 1):
        y = min(TH - 1, int(i / N * (TH - 1)))
        xr = np.where(fill[y])[0]
        l.append(xr.min() + off if len(xr) else np.nan)
        r.append(xr.max() + off if len(xr) else np.nan)
    l, r = np.array(l, float), np.array(r, float)
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
    print("view", k, "rim", rim, flush=True)

for n, ts in tiles.items():
    Image.fromarray(np.hstack(ts)).save(f"{out_dir}/atlas-{n}.webp", "WEBP", quality=90, method=6)
N = 220
mean_r = [round(float(np.mean([pv["r"][i] for pv in prof_views])), 5) for i in range(N + 1)]
json.dump({"w": TW, "h": TH, "v": [round(1 - i / N, 5) for i in range(N + 1)], "r": mean_r, "views": prof_views}, open(prof_path, "w"))

prev = []
for n in NAMES:
    im = Image.open(f"{out_dir}/atlas-{n}.webp").convert("RGBA")
    bg = Image.new("RGBA", im.size, (250, 226, 220, 255))
    prev.append(Image.alpha_composite(bg, im).convert("RGB").resize((im.width // 4, im.height // 4)))
sh = Image.new("RGB", (prev[0].width, prev[0].height * 3))
for i, p in enumerate(prev):
    sh.paste(p, (0, i * prev[0].height))
sh.save(dbg + "/atlas.jpg")
print("ok", TW, TH)
