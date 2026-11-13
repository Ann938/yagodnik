# Шаг 1 (в окружении с opencv-contrib): из листов «Четыре рожка…» (по листу на вкус, одинаковый кадр)
# вырезаем 4 ракурса ОДНИМИ рамками — вафля и пломбир совпадают пиксель в пиксель, отличается только джем;
# чистим фон (на листах вокруг рожков крапинки), увеличиваем EDSR x4 → x2.
# python cone-views.py <EDSR_x4.pb> <out dir> strawberry=<лист.png> blackberry=<лист.png> raspberry=<лист.png> [--front]
# --front: только передний ракурс (view0) в полном x4 → <вкус>/front.png — для чёткой текстуры лица рожка.
import sys, os, numpy as np, cv2
from PIL import Image

args = [a for a in sys.argv[1:] if a != "--front"]
FRONT = "--front" in sys.argv
model, out = args[:2]
sheets = dict(a.split("=", 1) for a in args[2:])
arr = {k: np.array(Image.open(v).convert("RGBA")) for k, v in sheets.items()}
H = max(a.shape[0] for a in arr.values())
W = max(a.shape[1] for a in arr.values())
for k, a in arr.items():
    pad = np.zeros((H, W, 4), np.uint8)
    pad[: a.shape[0], : a.shape[1]] = a
    arr[k] = pad
union = np.max(np.stack([(a[:, :, 3] > 128) for a in arr.values()]), 0)
col = union.sum(0)
spans, inside, start = [], False, 0
for x in range(W):
    if col[x] >= 3 and not inside:
        inside, start = True, x
    elif col[x] < 3 and inside:
        inside = False
        if x - start > 80:
            spans.append((start, x))
if inside:
    spans.append((start, W))
print("views", spans)

sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(model)
sr.setModel("edsr", 4)

def upscale(bgr):
    h, w = bgr.shape[:2]
    T, O = 96, 8
    acc = np.zeros((h * 4, w * 4, 3), np.float32)
    ws = np.zeros((h * 4, w * 4, 1), np.float32)
    for y in range(0, h, T):
        for x in range(0, w, T):
            ya, xa, yb, xb = max(0, y - O), max(0, x - O), min(h, y + T + O), min(w, x + T + O)
            tile = sr.upsample(bgr[ya:yb, xa:xb]).astype(np.float32)
            th, tw = tile.shape[:2]
            wy = np.minimum(np.arange(th) + 1, th - np.arange(th))[:, None]
            wx = np.minimum(np.arange(tw) + 1, tw - np.arange(tw))[None, :]
            w_ = np.minimum(np.minimum(wy, 32), np.minimum(wx, 32)).astype(np.float32)[:, :, None]
            acc[ya * 4 : yb * 4, xa * 4 : xb * 4] += tile * w_
            ws[ya * 4 : yb * 4, xa * 4 : xb * 4] += w_
    return np.clip(acc / np.maximum(ws, 1e-6), 0, 255).astype(np.uint8)

def clean_alpha(al):
    m = (al > 128).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    big = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    return (al * cv2.dilate(big, np.ones((5, 5), np.uint8))).astype(np.uint8)

for i, (x0, x1) in enumerate(spans):
    if FRONT and i != 0:
        continue
    xa, xb = max(0, x0 - 4), min(W, x1 + 4)
    # общая рамка ракурса по всем вкусам
    masks = {k: clean_alpha(a[:, xa:xb, 3]) for k, a in arr.items()}
    um = np.max(np.stack([m > 20 for m in masks.values()]), 0)
    ys, xs = np.where(um)
    y0, y1, c0, c1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    for k, a in arr.items():
        v = a[:, xa:xb].copy()
        v[:, :, 3] = masks[k]
        v = v[y0:y1, c0:c1]
        up = upscale(cv2.cvtColor(v[:, :, :3], cv2.COLOR_RGB2BGR))
        sc = 4 if FRONT else 2
        if sc != 4:
            up = cv2.resize(up, (v.shape[1] * sc, v.shape[0] * sc), interpolation=cv2.INTER_AREA)
        al2 = cv2.resize(v[:, :, 3], (v.shape[1] * sc, v.shape[0] * sc), interpolation=cv2.INTER_CUBIC)
        os.makedirs(f"{out}/{k}", exist_ok=True)
        name = "front" if FRONT else f"view{i}"
        Image.fromarray(np.dstack([cv2.cvtColor(up, cv2.COLOR_BGR2RGB), al2])).save(f"{out}/{k}/{name}.png")
        print(k, "view", i, v.shape, flush=True)
