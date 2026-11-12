# Шаг 1 (в окружении с opencv-contrib): вырезаем 4 ракурса из листа, чистим фон, увеличиваем EDSR x4 → x2.
# python views.py <лист.png> <EDSR_x4.pb> <out dir>
import sys, os, numpy as np, cv2
from PIL import Image

sheet, model, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
a = np.array(Image.open(sheet).convert("RGBA"))
al = a[:, :, 3]
col = (al > 128).sum(0)
empty = col < 3
# границы ракурсов — по пустым столбцам
spans, inside, start = [], False, 0
for x in range(len(col)):
    if not empty[x] and not inside:
        inside, start = True, x
    elif empty[x] and inside:
        inside = False
        if x - start > 80:
            spans.append((start, x))
if inside:
    spans.append((start, len(col)))
print("views", spans)

sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(model)
sr.setModel("edsr", 4)

def upscale(bgr):
    H, W = bgr.shape[:2]
    T, O = 96, 8
    acc = np.zeros((H * 4, W * 4, 3), np.float32)
    ws = np.zeros((H * 4, W * 4, 1), np.float32)
    for y in range(0, H, T):
        for x in range(0, W, T):
            ya, xa, yb, xb = max(0, y - O), max(0, x - O), min(H, y + T + O), min(W, x + T + O)
            tile = sr.upsample(bgr[ya:yb, xa:xb]).astype(np.float32)
            th, tw = tile.shape[:2]
            wy = np.minimum(np.arange(th) + 1, th - np.arange(th))[:, None]
            wx = np.minimum(np.arange(tw) + 1, tw - np.arange(tw))[None, :]
            w = np.minimum(np.minimum(wy, 32), np.minimum(wx, 32)).astype(np.float32)[:, :, None]
            acc[ya * 4 : yb * 4, xa * 4 : xb * 4] += tile * w
            ws[ya * 4 : yb * 4, xa * 4 : xb * 4] += w
    return np.clip(acc / np.maximum(ws, 1e-6), 0, 255).astype(np.uint8)

for k, (x0, x1) in enumerate(spans):
    v = a[:, max(0, x0 - 4) : x1 + 4].copy()
    m = (v[:, :, 3] > 128).astype(np.uint8)
    # только сам рожок: крупнейшая связная область (вокруг на листе — красные крапинки)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    big = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    big = cv2.dilate(big, np.ones((5, 5), np.uint8))
    v[:, :, 3] = (v[:, :, 3] * big).astype(np.uint8)
    ys, xs = np.where(v[:, :, 3] > 20)
    v = v[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    bgr = cv2.cvtColor(v[:, :, :3], cv2.COLOR_RGB2BGR)
    up = upscale(bgr)
    up = cv2.resize(up, (v.shape[1] * 2, v.shape[0] * 2), interpolation=cv2.INTER_AREA)
    al2 = cv2.resize(v[:, :, 3], (v.shape[1] * 2, v.shape[0] * 2), interpolation=cv2.INTER_CUBIC)
    Image.fromarray(np.dstack([cv2.cvtColor(up, cv2.COLOR_BGR2RGB), al2])).save(f"{out}/view{k}.png")
    print("view", k, v.shape, "->", up.shape)
