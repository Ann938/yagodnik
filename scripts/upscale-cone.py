# Повышение чёткости фото рожка в 4 раза (EDSR x4) по плиткам — чтобы не съесть всю память.
# Вход: исходник пользователя (кроп вокруг рожка), выход: sr4.png (RGB) и альфа из cut.png, увеличенная тем же масштабом.
import sys, numpy as np, cv2
from PIL import Image

d, model = sys.argv[1], sys.argv[2]
src = Image.open(d + "/src.jpg").convert("RGB")
# тот же кроп, что у cut.png (bbox из rembg: 562,21,822,752) с запасом по краям
X0, Y0, X1, Y1 = 552, 11, 832, 762
img = np.array(src.crop((X0, Y0, X1, Y1)))[:, :, ::-1].copy()  # BGR
sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(model)
sr.setModel("edsr", 4)
H, W = img.shape[:2]
T, O = 96, 8
out = np.zeros((H * 4, W * 4, 3), np.float32)
wsum = np.zeros((H * 4, W * 4, 1), np.float32)
for y in range(0, H, T):
    for x in range(0, W, T):
        ya, xa = max(0, y - O), max(0, x - O)
        yb, xb = min(H, y + T + O), min(W, x + T + O)
        tile = sr.upsample(img[ya:yb, xa:xb]).astype(np.float32)
        # мягкие веса по краям плитки — швов не видно
        th, tw = tile.shape[:2]
        wy = np.minimum(np.arange(th) + 1, th - np.arange(th))[:, None].astype(np.float32)
        wx = np.minimum(np.arange(tw) + 1, tw - np.arange(tw))[None, :].astype(np.float32)
        w = np.minimum(np.minimum(wy, 32), np.minimum(wx, 32))[:, :, None]
        out[ya * 4 : yb * 4, xa * 4 : xb * 4] += tile * w
        wsum[ya * 4 : yb * 4, xa * 4 : xb * 4] += w
    print("row", y, H, flush=True)
out = np.clip(out / np.maximum(wsum, 1e-6), 0, 255).astype(np.uint8)
cv2.imwrite(d + "/sr4_full.png", out)
# обрезаем до кадра cut.png (562,21)-(822,752) ×4
cx0, cy0 = (562 - X0) * 4, (21 - Y0) * 4
out = out[cy0 : cy0 + 731 * 4, cx0 : cx0 + 260 * 4]
cut = Image.open(d + "/cut.png").convert("RGBA")
alpha = np.array(cut)[:, :, 3]
alpha4 = cv2.resize(alpha, (out.shape[1], out.shape[0]), interpolation=cv2.INTER_CUBIC)
Image.fromarray(np.dstack([out[:, :, ::-1], alpha4])).save(d + "/cut4.png")
print("done", out.shape)
