# Сборка слоёв рожка из фото: вафля / пломбир (3 вкуса) / соус (3 вкуса).
# python -I build.py <scratch cone dir> <public/cone dir>
import sys, numpy as np, cv2
from PIL import Image

d, o = sys.argv[1], sys.argv[2]
cut = Image.open(d + "/cut.png").convert("RGBA")
W, H = cut.size
a = np.array(cut.resize((W * 2, H * 2), Image.LANCZOS)).astype(np.float32)
rgb = a[:, :, :3]
A = a[:, :, 3] / 255
H2, W2 = A.shape
fg = A > 0.08
hsv = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]

# --- маска соуса (с розовым ореолом)
red = ((((h < 11) | (h > 155)) & (s > 38) & fg)).astype(np.uint8)
red = cv2.morphologyEx(red, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
sauce = cv2.dilate(red, np.ones((7, 7), np.uint8)).astype(bool)

# --- кромка рожка: дуга
y0 = 760
row = np.where(A[y0] > 0.5)[0]
cx, hw = (row.min() + row.max()) / 2, (row.max() - row.min()) / 2
yy, xx = np.mgrid[0:H2, 0:W2].astype(np.float32)
edge = y0 + 18 * ((xx - cx) / hw) ** 2 - 6

# --- что есть вафля: цвет вафли или всё ниже дуги
waf_col = (h >= 8) & (h <= 28) & (s > 70) & fg
below = yy >= edge
waffle_zone = (below | (waf_col & (yy > y0 - 120))) & fg

out = rgb.copy()
bgr = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2BGR)
# фон тоже закрашиваем, чтобы у края силуэта дорисовка не тянула чёрный из прозрачной области
tel = cv2.cvtColor(cv2.inpaint(bgr, (sauce | ~fg).astype(np.uint8), 9, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB).astype(np.float32)

# 1) пломбир под соусом: построчная интерполяция между краями полосы; у силуэта — telea
for y in range(H2):
    xs = np.where(sauce[y] & ~waffle_zone[y])[0]
    if len(xs) == 0:
        continue
    for r in np.split(xs, np.where(np.diff(xs) > 1)[0] + 1):
        x0, x1 = r[0] - 3, r[-1] + 3
        inside = x0 >= 0 and x1 < W2 and fg[y, x0] and fg[y, x1] and not sauce[y, x0] and not sauce[y, x1]
        if not inside:
            out[y, r[0] : r[-1] + 1] = tel[y, r[0] : r[-1] + 1]
            continue
        c0 = out[y, max(0, x0 - 2) : x0 + 1].mean(0)
        c1 = out[y, x1 : x1 + 3].mean(0)
        t = np.linspace(0, 1, len(r))[:, None]
        out[y, r[0] : r[-1] + 1] = c0 * (1 - t) + c1 * t
# лёгкий вертикальный blur в зоне заплаток — убирает «лесенку» между строками
m = sauce & ~waffle_zone
bl = cv2.GaussianBlur(out, (1, 9), 0)
w = cv2.GaussianBlur(m.astype(np.float32), (9, 9), 0)[:, :, None]
out = out * (1 - w * 0.7) + bl * (w * 0.7)
out[m] += np.random.default_rng(1).normal(0, 2.0, (m.sum(), 1))

# 2) вафля под соусом и потёками пломбира: копия узора со сдвигом на период клетки
cream_drip = (s < 75) & (v > 165) & fg & below
sauce_w = cv2.dilate(red, np.ones((13, 13), np.uint8)).astype(bool)  # на вафле ореол соуса шире
bad = ((sauce_w & waffle_zone) | cv2.dilate(cream_drip.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)) & waffle_zone
P = 52
left = bad.copy()
for sx, sy in [(P, 0), (-P, 0), (2 * P, 0), (-2 * P, 0), (P // 2, P // 2), (-P // 2, P // 2), (P // 2, -P // 2), (-P // 2, -P // 2), (0, P), (0, -P), (3 * P, 0), (-3 * P, 0)]:
    ys, xs = np.where(left)
    if len(ys) == 0:
        break
    ny, nx = ys + sy, xs + sx
    ok = (nx >= 0) & (nx < W2) & (ny >= 0) & (ny < H2)
    i = np.where(ok)[0]
    good = ~bad[ny[i], nx[i]] & (A[ny[i], nx[i]] > 0.9) & waffle_zone[ny[i], nx[i]]
    i = i[good]
    out[ys[i], xs[i]] = rgb[ny[i], nx[i]]
    left[ys[i], xs[i]] = False
out[left] = tel[left]
sb = cv2.GaussianBlur(bad.astype(np.float32), (7, 7), 0)
fix = cv2.GaussianBlur(out, (3, 3), 0)
ww = (sb * (1 - sb) * 4)[:, :, None]
out = out * (1 - ww) + fix * ww
clean = np.clip(out, 0, 255)

def save(name, col, alpha):
    Image.fromarray(np.dstack([np.clip(col, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)).save(o + "/" + name + ".webp", "WEBP", quality=90, method=6)

# --- вафля: всё ниже дуги
save("cone", clean, A * np.clip((yy - edge) / 2.5, 0, 1))

# --- пломбир: всё выше дуги (+4 px нахлёст); тонируем только сливочные пиксели
top = np.clip((edge + 4 - yy) / 2.5, 0, 1)
hc = cv2.cvtColor(clean.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
cr = np.clip((90 - hc[:, :, 1]) / 40, 0, 1) * np.clip((hc[:, :, 2] - 120) / 50, 0, 1)
cr = cv2.GaussianBlur(cr, (5, 5), 0)[:, :, None]
tints = {"strawberry": np.array([1.0, 0.955, 0.95]), "raspberry": np.array([1.0, 0.9, 0.93]), "blackberry": np.array([0.97, 0.94, 1.0])}
for k, t in tints.items():
    save("cream-" + k, clean * t * cr + clean * (1 - cr), A * top)

# --- соус: мягкая альфа по красной маске; клубника как на фото, остальные — по яркости с бликами
sa = np.clip(cv2.GaussianBlur(red.astype(np.float32), (5, 5), 0) * 1.4, 0, 1) * A
SL = (rgb @ np.array([0.299, 0.587, 0.114]))[:, :, None] / 255
spec = np.clip((SL - 0.62) / 0.3, 0, 1)
def tint(base, g=1.2):
    c = np.power(SL / 0.45, g) * np.array(base)
    return c * (1 - spec) + 255 * spec * 0.85 + c * spec * 0.15
save("sauce-strawberry", rgb, sa)
save("sauce-raspberry", tint([150, 14, 60], 1.15), sa)
save("sauce-blackberry", tint([44, 10, 52]), sa)

# превью
bg = np.full((H2, W2, 3), (250, 226, 220), np.float32)
tiles = []
for k in ["strawberry", "raspberry", "blackberry"]:
    t = bg.copy()
    for n in ["cone", "cream-" + k] + (["sauce-" + k] if k != "strawberry" else []):
        im = np.array(Image.open(o + "/" + n + ".webp")).astype(np.float32)
        al = im[:, :, 3:] / 255
        t = im[:, :, :3] * al + t * (1 - al)
    tiles.append(t)
Image.fromarray(np.hstack(tiles).astype(np.uint8)).resize((780, 731)).save(d + "/flavors.jpg")
print("ok")
