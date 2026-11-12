# Сборка слоёв рожка из фото пользователя (PNG с прозрачным фоном):
# вафля / пломбир (3 вкуса) / джем (3 вкуса) + profile.json для 3D (центр и полуширина каждой строки).
# python -I scripts/build-cone.py <фото.png> <public/cone> <src/three/profile.json> <папка для превью>
import sys, json, numpy as np, cv2
from PIL import Image

src, out_dir, prof_path, dbg = sys.argv[1:5]
im = Image.open(src).convert("RGBA")
a = np.array(im)
ys, xs = np.where(a[:, :, 3] > 20)
PAD = 6
a = a[max(0, ys.min() - PAD) : ys.max() + PAD, max(0, xs.min() - PAD) : xs.max() + PAD].astype(np.float32)
rgb = a[:, :, :3]
A = a[:, :, 3] / 255
H, W = A.shape
fg = A > 0.08
hsv = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
K = W / 520  # масштаб относительно прежнего фото — для размеров ядер
k = lambda n: max(3, int(round(n * K)) | 1)

# --- джем: красный тон
# ядро — только насыщенно-красное (тени вафли рыжеватые: тон 8–12, их не берём)
red = ((((h < 8) | (h > 165)) & (s > 100) & fg)).astype(np.uint8)
red = cv2.morphologyEx(red, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
# семечки и блики внутри полос джема — закрываем, чтобы джем снимался целиком
red = cv2.morphologyEx(red, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k(11), k(11))))
n_, lab_, st_, _ = cv2.connectedComponentsWithStats(red, 8)
for i in range(1, n_):
    if st_[i, cv2.CC_STAT_AREA] < 40 * K * K:  # одиночные рыжие крапинки на вафле — не джем
        red[lab_ == i] = 0
sauce = cv2.dilate(red, np.ones((k(7), k(7)), np.uint8)).astype(bool)

# --- вафля: оранжево-золотистая и насыщенная
waf = ((h >= 8) & (h <= 26) & (s > 95) & fg & ~sauce).astype(np.uint8)
waf = cv2.morphologyEx(waf, cv2.MORPH_CLOSE, np.ones((k(9), k(9)), np.uint8))

# --- кромка рожка: по столбцам — верх сплошной вафли; гладкая парабола по надёжным столбцам
rim = np.full(W, np.nan)
for x in range(W):
    col = waf[:, x]
    yy_ = np.where(fg[:, x])[0]
    if len(yy_) == 0:
        continue
    y = yy_.max()
    win = int(24 * K)
    while y > yy_.min() + win and col[y - win : y].mean() > 0.7:
        y -= 4
    rim[x] = y
xs_ok = np.where(~np.isnan(rim))[0]
fx = xs_ok[(xs_ok > W * 0.2) & (xs_ok < W * 0.8)]
# столбцы, где по кромке стекает джем, сбивают оценку — отбрасываем выбросы в два прохода
for _ in range(2):
    c = np.polyfit(fx, rim[fx], 2)
    res = rim[fx] - np.polyval(c, fx)
    fx = fx[np.abs(res) < max(8 * K, np.std(res) * 1.5)]
c = np.polyfit(fx, rim[fx], 2)
xx_, yy_ = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
# дуга чуть ниже зубчиков кромки: вафля под ней ровная
edge = np.polyval(c, xx_) + 22 * K
print("rim fit", c, "center y", np.polyval(c, W / 2))

# над вафлей (на пломбире) джем бывает полупрозрачным и рыжеватым — там берём шире:
# пломбир почти бесцветный, всё тёплое и насыщенное на нём — джем
cream_area = (yy_ < edge - 4 * K) & fg
red_soft = ((((h < 15) | (h > 150)) & (s > 38) & cream_area)).astype(np.uint8)
red_soft = cv2.morphologyEx(red_soft, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
red = np.maximum(red, red_soft)
red = cv2.morphologyEx(red, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k(7), k(7))))
sauce = cv2.dilate(red, np.ones((k(7), k(7)), np.uint8)).astype(bool)
below = yy_ >= edge
waffle_zone = (below | (waf.astype(bool) & (yy_ > np.polyval(c, xx_) - 120 * K))) & fg

out = rgb.copy()
bgr = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2BGR)
tel = cv2.cvtColor(cv2.inpaint(bgr, (sauce | ~fg).astype(np.uint8), int(9 * K), cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB).astype(np.float32)

# 1) пломбир под джемом: построчная интерполяция (витки идут горизонтальными полосами); у силуэта — telea
for y in range(H):
    xs2 = np.where(sauce[y] & ~waffle_zone[y])[0]
    if len(xs2) == 0:
        continue
    for r in np.split(xs2, np.where(np.diff(xs2) > 1)[0] + 1):
        x0, x1 = r[0] - 3, r[-1] + 3
        inside = x0 >= 0 and x1 < W and fg[y, x0] and fg[y, x1] and not sauce[y, x0] and not sauce[y, x1]
        if not inside:
            out[y, r[0] : r[-1] + 1] = tel[y, r[0] : r[-1] + 1]
            continue
        c0 = out[y, max(0, x0 - 2) : x0 + 1].mean(0)
        c1 = out[y, x1 : x1 + 3].mean(0)
        t = np.linspace(0, 1, len(r))[:, None]
        out[y, r[0] : r[-1] + 1] = c0 * (1 - t) + c1 * t
m = sauce & ~waffle_zone
bl = cv2.GaussianBlur(out, (1, k(9)), 0)
w = cv2.GaussianBlur(m.astype(np.float32), (k(9), k(9)), 0)[:, :, None]
out = out * (1 - w * 0.7) + bl * (w * 0.7)
out[m] += np.random.default_rng(1).normal(0, 2.0, (m.sum(), 1))

# 2) вафля под каплями: джем на сайте всегда лежит сверху (вкусы меняются перетеканием цвета),
#    поэтому под ним достаточно гладкой дорисовки в цвет вафли
bad = cv2.dilate(red, np.ones((k(9), k(9)), np.uint8)).astype(bool) & waffle_zone
out[bad] = tel[bad]
clean = np.clip(out, 0, 255)

def save(name, col, alpha):
    Image.fromarray(np.dstack([np.clip(col, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)).save(f"{out_dir}/{name}.webp", "WEBP", quality=90, method=6)

soft = 2.5 * K
save("cone", clean, A * np.clip((yy_ - edge) / soft, 0, 1))
top = np.clip((edge + 4 * K - yy_) / soft, 0, 1)
hc = cv2.cvtColor(clean.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
cr = np.clip((90 - hc[:, :, 1]) / 40, 0, 1) * np.clip((hc[:, :, 2] - 120) / 50, 0, 1)
cr = cv2.GaussianBlur(cr, (k(5), k(5)), 0)[:, :, None]
tints = {"strawberry": np.array([1.0, 0.97, 0.965]), "raspberry": np.array([1.0, 0.92, 0.94]), "blackberry": np.array([0.975, 0.955, 1.0])}
for name, t in tints.items():
    save("cream-" + name, clean * t * cr + clean * (1 - cr), A * top)

sa = np.clip(cv2.GaussianBlur(red.astype(np.float32), (k(5), k(5)), 0) * 1.4, 0, 1) * A
SL = (rgb @ np.array([0.299, 0.587, 0.114]))[:, :, None] / 255
spec = np.clip((SL - 0.62) / 0.3, 0, 1)
def tint(base, g=1.2):
    cc = np.power(SL / 0.45, g) * np.array(base)
    return cc * (1 - spec) + 255 * spec * 0.85 + cc * spec * 0.15
save("sauce-strawberry", rgb, sa)
save("sauce-raspberry", tint([150, 14, 60], 1.15), sa)
save("sauce-blackberry", tint([44, 10, 52]), sa)

# --- профиль для 3D: центр и полуширина силуэта по строкам (доли ширины картинки)
N = 220
x0r, x1r = [], []
for i in range(N + 1):
    y = min(H - 1, int(i / N * (H - 1)))
    xr = np.where(A[y] > 0.5)[0]
    x0r.append(xr.min() if len(xr) else np.nan)
    x1r.append(xr.max() if len(xr) else np.nan)
x0r, x1r = np.array(x0r, float), np.array(x1r, float)
idx = np.arange(N + 1)
for arr in (x0r, x1r):
    ok = ~np.isnan(arr)
    arr[~ok] = np.interp(idx[~ok], idx[ok], arr[ok])
kern = np.ones(5) / 5
cxs = np.convolve((x0r + x1r) / 2, kern, "same")
rs = np.convolve((x1r - x0r) / 2, kern, "same")
cxs[:2] = ((x0r + x1r) / 2)[:2]; cxs[-2:] = ((x0r + x1r) / 2)[-2:]
rs[:2] = ((x1r - x0r) / 2)[:2]; rs[-2:] = ((x1r - x0r) / 2)[-2:]
rows = [{"v": round(1 - i / N, 5), "cx": round(float(cxs[i]) / W, 5), "r": round(max(0.002, float(rs[i])) / W, 5)} for i in range(N + 1)]
json.dump({"w": W, "h": H, "rows": rows}, open(prof_path, "w"))

# превью трёх вкусов
bg = np.full((H, W, 3), (250, 226, 220), np.float32)
tiles = []
for name in ["strawberry", "raspberry", "blackberry"]:
    t = bg.copy()
    for n in ["cone", "cream-" + name] + (["sauce-" + name] if name != "strawberry" else []):
        q = np.array(Image.open(f"{out_dir}/{n}.webp")).astype(np.float32)
        al = q[:, :, 3:] / 255
        t = q[:, :, :3] * al + t * (1 - al)
    tiles.append(t)
Image.fromarray(np.hstack(tiles).astype(np.uint8)).resize((3 * 360, int(H * 360 / W))).save(dbg + "/new-flavors.jpg")
print("ok", W, H)
