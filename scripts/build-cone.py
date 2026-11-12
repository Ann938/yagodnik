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
# сплошная форма: всё между левым и правым краем тела в каждой строке
fill = np.zeros_like(core)
for y in range(H):
    xr = np.where(core[y])[0]
    if len(xr):
        fill[y, xr.min() : xr.max() + 1] = 1
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
