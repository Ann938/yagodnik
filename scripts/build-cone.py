# Рожок для 3D: три цельных фото пользователя (клубника, ежевика, малина — одинаковый кадр, прозрачный фон).
# Обрезаем по общей рамке → public/cone/full-<вкус>.webp; по объединённому силуэту строим profile.json
# (центр и полуширина каждой строки) для тела вращения в src/three/Cone3D.ts.
# python -I scripts/build-cone.py <папка с png> public/cone src/three/profile.json
import sys, os, json, numpy as np
from PIL import Image

src_dir, out_dir, prof_path = sys.argv[1:4]
os.makedirs(out_dir, exist_ok=True)
FILES = {
    "strawberry": "Ванильный рожок с клубничным соусом.png",
    "blackberry": "Ванильное мороженое с ежевичным джемом-1.png",
    "raspberry": "Ванильное мороженое с малиновым джемом.png",
}
ims = {k: np.array(Image.open(f"{src_dir}/{v}").convert("RGBA")) for k, v in FILES.items()}
Hm = max(a.shape[0] for a in ims.values())
Wm = max(a.shape[1] for a in ims.values())
# выравниваем размер холста (у одного фото на строку меньше)
for k, a in ims.items():
    pad = np.zeros((Hm, Wm, 4), np.uint8)
    pad[: a.shape[0], : a.shape[1]] = a
    ims[k] = pad
union = np.max(np.stack([a[:, :, 3] for a in ims.values()]), 0)
ys, xs = np.where(union > 20)
P = 6
y0, y1, x0, x1 = max(0, ys.min() - P), min(Hm, ys.max() + P), max(0, xs.min() - P), min(Wm, xs.max() + P)
A = union[y0:y1, x0:x1].astype(np.float32) / 255
H, W = A.shape

# «тело» рожка без капель, висящих сбоку в воздухе: при повороте между ними и рожком видна дыра.
# Горизонтальное открытие убирает узкие боковые выступы; макушку (завиток) не трогаем.
import cv2
body = (A > 0.5).astype(np.uint8)
opened = cv2.morphologyEx(body, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (45, 1)))
tip = int(H * 0.07)
opened[:tip] = body[:tip]
n, lab, st, _ = cv2.connectedComponentsWithStats(opened, 8)
core = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
# края вафли — прямые: подгоняем линии по чистой вафле внизу (60–92 % высоты) и продлеваем до кромки.
# Ниже кромки всё, что за этими линиями (капли, свисающие сбоку), отрезаем — иначе при повороте там «дыра».
ry = np.arange(int(H * 0.6), int(H * 0.92))
lx = np.array([np.where(core[y])[0].min() for y in ry])
rx = np.array([np.where(core[y])[0].max() for y in ry])
lfit, rfit = np.polyfit(ry, lx, 1), np.polyfit(ry, rx, 1)
# кромка: самая нижняя точка пломбира по центру рожка (светлое и почти бесцветное)
c0 = ims["strawberry"][y0:y1, x0:x1]
hsv0 = cv2.cvtColor(c0[:, :, :3], cv2.COLOR_RGB2HSV)
cream = (hsv0[:, :, 1] < 70) & (hsv0[:, :, 2] > 170) & (c0[:, :, 3] > 200)
mid = (np.polyval(lfit, H * 0.5) + np.polyval(rfit, H * 0.5)) / 2
band = cream[:, int(mid - W * 0.12) : int(mid + W * 0.12)]
rows_c = np.where(band.sum(1) >= int(W * 0.04))[0]
rows_c = rows_c[rows_c < H * 0.62]  # блики на вафле ниже — не пломбир
rim_y = int(rows_c.max()) if len(rows_c) else int(H * 0.5)
print("rim", rim_y, "of", H)
# сплошная форма: в строке — от левого до правого края тела; ниже кромки — не шире конуса
TAPER = int(H * 0.035)
fill = np.zeros_like(core)
for y in range(H):
    xr = np.where(core[y])[0]
    if not len(xr):
        continue
    a0, a1 = xr.min(), xr.max()
    if y >= rim_y:
        # ниже кромки выступ за край вафли плавно сходит на нет (как закруглённый кончик капли), без ступеньки
        t = min(1.0, (y - rim_y) / TAPER)
        keep = (1 - t) ** 2 * (3 - 2 * (1 - t)) if t < 1 else 0.0  # smoothstep наоборот
        cl, cr = np.polyval(lfit, y) - 1, np.polyval(rfit, y) + 1
        a0 = int(round(max(a0, cl - max(0, cl - a0) * keep)))
        a1 = int(round(min(a1, cr + max(0, a1 - cr) * keep)))
    if a1 > a0:
        fill[y, a0 : a1 + 1] = 1
fill_soft = cv2.GaussianBlur(fill.astype(np.float32), (3, 3), 0)

for k, a in ims.items():
    c = a[y0:y1, x0:x1].copy()
    rgb = cv2.cvtColor(c[:, :, :3], cv2.COLOR_RGB2BGR)
    # пустоты внутри формы (и полупрозрачный край) закрашиваем соседними цветами — без дыр при повороте
    # источник цвета — только непрозрачное фото: прозрачный фон (чёрный в RGB) тоже в маске
    holes = ((c[:, :, 3] < 230) | (fill == 0)).astype(np.uint8)
    rgb = cv2.inpaint(rgb, holes, 5, cv2.INPAINT_TELEA)
    c[:, :, :3] = cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB)
    c[:, :, 3] = np.clip(fill_soft * 255, 0, 255).astype(np.uint8)
    Image.fromarray(c).save(f"{out_dir}/full-{k}.webp", "WEBP", quality=90, method=6)
A = fill.astype(np.float32)

N = 220
l, r = [], []
for i in range(N + 1):
    y = min(H - 1, int(i / N * (H - 1)))
    xr = np.where(A[y] > 0.5)[0]
    l.append(xr.min() if len(xr) else np.nan)
    r.append(xr.max() if len(xr) else np.nan)
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
rows = [{"v": round(1 - i / N, 5), "cx": round(float(cx[i]) / W, 5), "r": round(max(0.002, float(rr[i])) / W, 5)} for i in range(N + 1)]
json.dump({"w": W, "h": H, "rows": rows}, open(prof_path, "w"))
print("ok", W, H)
