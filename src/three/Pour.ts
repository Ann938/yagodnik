// Налив из видео пользователя (public/pour/000–119.webp, 12 к/с, фон вырезан, носик аппарата растворён).
// Кадры 0–55: пломбир закручивается в рожок — проигрывается при загрузке.
// Кадры 55–119: джем падает и растекается — по скроллу в блоке «Соус из ягод».
// Джем перекрашивается под вкус в шейдере (по яркости, блики сохраняются), пломбир слегка тонируется.
// В финале три рожка — последний кадр в трёх цветах. Поза по разделам — как в вёрстке (vw/vh).
import { stage } from "./stage";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const FRAMES = 120;
const CREAM_END = 55;
const FW = 640,
  FH = 720;
// камера в видео плавно наезжает (вафля на строке 600 px растёт с 226 до 515 px) — компенсируем,
// масштабируя кадр вокруг этой точки: рожок стоит на месте, растут только пломбир и джем
const zoomAt = (i: number) => 1 + 0.0114 * i;
const ANCHOR_Y = 600;

// цвет джема (0..1) и тон пломбира по вкусам: клубника, малина, ежевика
const JAM = [
  [0, 0, 0], // клубника — исходный цвет из видео
  [0.6, 0.05, 0.24],
  [0.17, 0.04, 0.21],
];
const JAM_ON = [0, 1, 1];
const CREAM = [
  [1, 0.985, 0.98],
  [1, 0.94, 0.955],
  [0.975, 0.96, 1],
];

type Pose = { x: number; y: number; h: number; r: number }; // центр в vw/vh, высота кадра в vh, наклон в градусах
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const mix = (a: Pose, b: Pose, k: number): Pose => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), h: lerp(a.h, b.h, k), r: lerp(a.r, b.r, k) });
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const POSES: Record<"desk" | "mob", Record<string, Pose>> = {
  desk: {
    // x, y — где точка привязки (вафля под пломбиром); h — высота кадра без наезда в vh
    hero: { x: 70, y: 52, h: 80, r: -5 },
    pour: { x: 67, y: 60, h: 100, r: 0 },
    flv: { x: 28, y: 52, h: 80, r: 5 },
    away: { x: 22, y: -60, h: 70, r: 12 },
    find: { x: 72, y: 50, h: 62, r: 0 },
  },
  mob: {
    hero: { x: 50, y: 28, h: 40, r: -3 },
    pour: { x: 50, y: 31, h: 46, r: 0 },
    flv: { x: 50, y: 28, h: 38, r: 3 },
    away: { x: 50, y: -60, h: 34, r: 10 },
    find: { x: 50, y: 26, h: 30, r: 0 },
  },
};

const VS = `
attribute vec2 aPos;
uniform vec2 uCenter; // в пикселях канваса
uniform vec2 uSize;
uniform float uRot;
uniform vec2 uView;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x, 1.0 - aPos.y);
  vec2 p = (aPos - 0.5) * uSize;
  float c = cos(uRot), s = sin(uRot);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + uCenter;
  gl_Position = vec4(p / uView * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS = `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uJamA, uJamB; // цвет джема до и после смены вкуса
uniform float uOnA, uOnB, uMix; // перекрашивать ли (клубника — исходный цвет)
uniform vec3 uCreamA, uCreamB;
uniform float uAlpha;
uniform float uClip; // низ рожка с фото: виден только ниже этой доли высоты (стык с видео)
varying vec2 vUv;
vec3 recolor(vec3 c, vec3 jam, float on, vec3 cream) {
  float mx = max(c.g, c.b);
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float jw = smoothstep(0.1, 0.28, c.r - mx) * smoothstep(0.18, 0.32, c.r);
  float spec = smoothstep(0.6, 0.92, lum);
  vec3 j = jam * pow(lum / 0.42, 1.15);
  j = mix(j, vec3(0.97), spec * 0.8);
  vec3 outc = mix(c, j, jw * on);
  // пломбир: светлые малонасыщенные пиксели
  float sat = (max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)));
  float cw = (1.0 - jw) * smoothstep(0.55, 0.8, lum) * (1.0 - smoothstep(0.12, 0.3, sat));
  return outc * mix(vec3(1.0), cream, cw);
}
void main() {
  vec4 t = texture2D(uTex, vUv);
  t *= smoothstep(uClip, uClip + 0.035, vUv.y);
  if (t.a < 0.004) discard;
  vec3 c = t.rgb / max(t.a, 0.001);
  vec3 a = recolor(c, uJamA, uOnA, uCreamA);
  vec3 b = recolor(c, uJamB, uOnB, uCreamB);
  vec3 col = mix(a, b, uMix);
  gl_FragColor = vec4(col * t.a * uAlpha, t.a * uAlpha);
}`;

export function createPour(canvas: HTMLCanvasElement, onReady?: () => void) {
  const mobile = window.matchMedia("(max-width: 1023px)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: true, alpha: true })!;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = {
    center: U("uCenter"),
    size: U("uSize"),
    rot: U("uRot"),
    view: U("uView"),
    jamA: U("uJamA"),
    jamB: U("uJamB"),
    onA: U("uOnA"),
    onB: U("uOnB"),
    mix: U("uMix"),
    creamA: U("uCreamA"),
    creamB: U("uCreamB"),
    alpha: U("uAlpha"),
    clip: U("uClip"),
  };
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  const makeTex = () => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const texMain = makeTex();
  const texLast = makeTex();
  // нижняя часть рожка — с фото пользователя: в видео рожок обрезан снизу кадра.
  // Сужение вафли на фото и в видео совпадает: строка 1110 фото = строка 640 кадра без наезда, ось x: +79 px
  const texBase = makeTex();
  let baseReady = false;
  const baseImg = new Image();
  baseImg.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texBase);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, baseImg);
    baseReady = true;
  };
  baseImg.src = `${BASE}/pour/cone-base.webp`;
  const BW = 520,
    BH = 1462,
    BASE_DX = 79,
    BASE_DY = -470,
    BASE_CLIP = 0.7;

  // ---- кадры: грузим по порядку, первые нужны сразу
  const frames: (HTMLImageElement | null)[] = new Array(FRAMES).fill(null);
  let loaded = 0;
  let dead = false;
  const load = (i: number) =>
    new Promise<void>((res) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        frames[i] = im;
        loaded++;
        res();
      };
      im.onerror = () => res();
      im.src = `${BASE}/pour/${String(i).padStart(3, "0")}.webp`;
    });
  (async () => {
    for (let i = 0; i < FRAMES && !dead; i += 6) await Promise.all(Array.from({ length: Math.min(6, FRAMES - i) }, (_, k) => load(i + k)));
  })();
  let lastUploaded = -1;
  let lastTexReady = false;
  const nearest = (i: number) => {
    for (let k = i; k >= 0; k--) if (frames[k]) return k;
    return -1;
  };

  // ---- размер
  let lastW = 0;
  const resize = () => {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (mobile && w === lastW) return;
    lastW = w;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener("resize", resize);

  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = (e: PointerEvent) => {
    ptr.x = e.clientX / window.innerWidth - 0.5;
    ptr.y = e.clientY / window.innerHeight - 0.5;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  // ---- смена вкуса: плавный переход цвета джема и пломбира
  let fA = stage.flavor,
    fB = stage.flavor,
    mixK = 1;

  // p.x/p.y — где на экране точка привязки (вафля, строка ANCHOR_Y); zoom — наезд камеры в этом кадре
  const draw = (tex: WebGLTexture, p: Pose, px: number, fa: number, fb: number, m: number, alpha: number, zoom: number) => {
    const W = canvas.width,
      H = canvas.height,
      vh = H / 100,
      vw = W / 100;
    const hh = (p.h * vh) / zoom;
    // центр кадра выше точки привязки на (ANCHOR_Y − FH/2) пикселей кадра (с учётом наклона)
    const off = ((ANCHOR_Y - FH / 2) / FH) * hh;
    const rot = (-p.r * Math.PI) / 180;
    const ax = p.x * vw,
      ay = H - p.y * vh + (px / canvas.clientHeight) * H;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform2f(u.view, W, H);
    gl.uniform2f(u.center, ax - Math.sin(rot) * off, ay + Math.cos(rot) * off);
    gl.uniform2f(u.size, (hh * FW) / FH, hh);
    gl.uniform1f(u.rot, rot);
    gl.uniform3fv(u.jamA, JAM[fa]);
    gl.uniform3fv(u.jamB, JAM[fb]);
    gl.uniform1f(u.onA, JAM_ON[fa]);
    gl.uniform1f(u.onB, JAM_ON[fb]);
    gl.uniform3fv(u.creamA, CREAM[fa]);
    gl.uniform3fv(u.creamB, CREAM[fb]);
    gl.uniform1f(u.mix, m);
    gl.uniform1f(u.alpha, alpha);
    gl.uniform1f(u.clip, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  // вафля с фото под кадром: та же точка привязки, но без наезда — рожок неподвижен
  const NO_JAM = [0, 0, 0];
  const drawBase = (p: Pose, px: number) => {
    if (!baseReady) return;
    const W = canvas.width,
      H = canvas.height,
      vh = H / 100,
      vw = W / 100;
    const k = (p.h * vh) / FH; // экранных пикселей на пиксель кадра
    const rot = (-p.r * Math.PI) / 180;
    const ax = p.x * vw,
      ay = H - p.y * vh + (px / canvas.clientHeight) * H;
    // центр фото относительно точки привязки (строка ANCHOR_Y, центр кадра по x), в пикселях кадра; y вверх
    const dx = (BASE_DX + BW / 2 - FW / 2) * k,
      dy = -(BASE_DY + BH / 2 - ANCHOR_Y) * k;
    const c = Math.cos(rot),
      s = Math.sin(rot);
    gl.bindTexture(gl.TEXTURE_2D, texBase);
    gl.uniform2f(u.view, W, H);
    gl.uniform2f(u.center, ax + dx * c - dy * s, ay + dx * s + dy * c);
    gl.uniform2f(u.size, BW * k, BH * k);
    gl.uniform1f(u.rot, rot);
    gl.uniform3fv(u.jamA, NO_JAM);
    gl.uniform3fv(u.jamB, NO_JAM);
    gl.uniform1f(u.onA, 0);
    gl.uniform1f(u.onB, 0);
    gl.uniform3fv(u.creamA, [1, 1, 1]);
    gl.uniform3fv(u.creamB, [1, 1, 1]);
    gl.uniform1f(u.mix, 0);
    gl.uniform1f(u.alpha, 1);
    gl.uniform1f(u.clip, BASE_CLIP);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const P = mobile ? POSES.mob : POSES.desk;
  let intro = reduced ? 1 : 0,
    started = false,
    t = 0,
    raf = 0,
    last = performance.now();

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    t += dt;
    // старт, когда загружена первая часть
    if (!started && frames.slice(0, CREAM_END + 1).every(Boolean)) {
      started = true;
      onReady?.();
    }
    if (started && intro < 1) intro = Math.min(1, intro + dt / 3.4);

    // какой кадр: налив пломбира → джем по скроллу → после блока — налитый
    const jam = Math.max(clamp(stage.pour), stage.flvIn > 0.02 ? 1 : 0);
    let fi = Math.round(intro * CREAM_END);
    if (intro >= 1) fi = Math.round(CREAM_END + jam * (FRAMES - 1 - CREAM_END));
    const have = nearest(fi);
    if (have >= 0 && have !== lastUploaded) {
      gl.bindTexture(gl.TEXTURE_2D, texMain);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frames[have]!);
      lastUploaded = have;
    }
    if (!lastTexReady && frames[FRAMES - 1]) {
      gl.bindTexture(gl.TEXTURE_2D, texLast);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frames[FRAMES - 1]!);
      lastTexReady = true;
    }

    if (stage.flavor !== fB && mixK >= 1) {
      fA = fB;
      fB = stage.flavor;
      mixK = 0;
    }
    if (mixK < 1) mixK = Math.min(1, mixK + dt / (reduced ? 0.01 : 0.7));

    let p = P.hero;
    p = mix(p, P.pour, ease(stage.openIn));
    p = mix(p, P.flv, ease(stage.flvIn));
    p = mix(p, P.away, ease(stage.away));
    p = mix(p, P.find, ease(stage.buyIn));
    ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-4 * dt));
    ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-4 * dt));
    const bob = reduced ? 0 : Math.sin(t * 0.9) * 0.5;
    const main = { x: p.x + ptr.sx * 1.2, y: p.y + bob + ptr.sy * 0.8, h: p.h, r: p.r + ptr.sx * 3 };

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // финал: два рожка других вкусов по бокам (последний кадр)
    const b = ease(stage.buyIn);
    if (b > 0.01 && lastTexReady) {
      [-1, 1].forEach((dir, i) => {
        const f = (fB + 1 + i) % 3;
        const ep = { x: p.x + dir * (mobile ? 27 : 13) * b, y: p.y + 3 + (1 - b) * 70, h: p.h * 0.86, r: dir * -8 };
        drawBase(ep, stage.buyPx);
        draw(texLast, ep, stage.buyPx, f, f, 1, 1, zoomAt(FRAMES - 1));
      });
    }
    if (lastUploaded >= 0) {
      drawBase(main, stage.buyPx);
      draw(texMain, main, stage.buyPx, fA, fB, mixK, 1, zoomAt(lastUploaded));
    }
  }
  raf = requestAnimationFrame(frame);

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onMove);
  };
}
