// Рожок в 3D по четырём ракурсам (листы пользователя «Четыре рожка…»): тело вращения по общему профилю,
// видимый бок — из снимка, ближайшего к зрителю (0°, 90°, 180°, 270°); при повороте снимки сменяются растворением.
// Поэтому рожок можно поворачивать широко: сзади настоящая сторона, а не зеркальная копия передней.
// Вкус меняет только джем: атласы public/cone/atlas-<вкус>.webp (собирает scripts/build-cone.py).
// При смене вкуса новый атлас проступает поверх старого. Динамика страницы — в ягодах на фоне.
import * as THREE from "three";
import { stage } from "./stage";
import profile from "./profile.json";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const IDS = ["strawberry", "blackberry", "raspberry"] as const; // порядок как в content.ts
const HW = 3.2; // высота модели в единицах сцены
const K = (profile.w / profile.h) * HW; // доля ширины плитки ракурса → единицы сцены

type Pose = { x: number; y: number; h: number; r: number }; // как в вёрстке: центр в vw/vh, высота в vh, наклон в градусах
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const mix = (a: Pose, b: Pose, k: number): Pose => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), h: lerp(a.h, b.h, k), r: lerp(a.r, b.r, k) });
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const POSES: Record<"desk" | "mob", Record<string, Pose>> = {
  desk: {
    hero: { x: 71, y: 53, h: 86, r: -7 },
    pour: { x: 67, y: 74, h: 128, r: 3 },
    flv: { x: 27, y: 54, h: 86, r: 6 },
    away: { x: 22, y: -70, h: 70, r: 18 },
  },
  mob: {
    hero: { x: 50, y: 27, h: 46, r: -6 },
    pour: { x: 50, y: 29, h: 54, r: 2 },
    flv: { x: 50, y: 27, h: 44, r: 4 },
    away: { x: 50, y: -60, h: 40, r: 14 },
  },
};

// ---- геометрия: тело вращения; для каждой вершины — координаты в каждом из 4 ракурсов и насколько ракурс её видит
function bodyGeometry() {
  const J = 160;
  const N = profile.v.length;
  const pos: number[] = [],
    uvA: number[] = [],
    uvB: number[] = [],
    cov: number[] = [],
    idx: number[] = [];
  for (let i = 0; i < N; i++) {
    const v = profile.v[i];
    const r = profile.r[i];
    for (let j = 0; j <= J; j++) {
      const a = (j / J) * Math.PI * 2;
      pos.push(r * K * Math.sin(a), (v - 0.5) * HW, r * K * Math.cos(a));
      const uv: number[] = [];
      for (let k = 0; k < 4; k++) {
        const rel = a - (k * Math.PI) / 2;
        const pv = profile.views[k];
        // ракурс k смотрит на сторону с углом k·90°; точка видна в нём со смещением sin(rel) от оси
        uv.push((k + pv.cx[i] + pv.r[i] * 0.985 * Math.sin(rel)) / 4, v);
        cov.push(Math.cos(rel)); // > 0 — точка на видимой ракурсу стороне
      }
      uvA.push(uv[0], uv[1], uv[2], uv[3]);
      uvB.push(uv[4], uv[5], uv[6], uv[7]);
    }
  }
  for (let i = 0; i < N - 1; i++)
    for (let j = 0; j < J; j++) {
      const a = i * (J + 1) + j,
        b = a + J + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aUvA", new THREE.Float32BufferAttribute(uvA, 4));
  g.setAttribute("aUvB", new THREE.Float32BufferAttribute(uvB, 4));
  g.setAttribute("aCov", new THREE.Float32BufferAttribute(cov, 4));
  g.setIndex(idx);
  return g;
}

// Фото без освещения (свет уже «в снимке»). Весь видимый бок рожка берётся из ОДНОГО снимка — того, что ближе
// всего к зрителю (uCam), поэтому посередине нет швов и двоения. Соседний снимок подхватывает только самый край,
// которого основной не видит. При повороте снимки сменяются быстрым растворением.
const VS = `
attribute vec4 aUvA;
attribute vec4 aUvB;
attribute vec4 aCov;
uniform vec4 uCam;
varying vec4 vUvA;
varying vec4 vUvB;
varying vec4 vW;
void main() {
  vUvA = aUvA; vUvB = aUvB;
  vec4 c = max(aCov, 0.0);
  vec4 w = uCam * smoothstep(0.1, 0.38, c) + 1e-4 * pow(c, vec4(8.0));
  vW = w / max(w.x + w.y + w.z + w.w, 1e-6);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FS = `
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uFA;
uniform sampler2D uFB;
uniform float uHA;
uniform float uHB;
uniform float uMix;
varying vec4 vUvA;
varying vec4 vUvB;
varying vec4 vW;
// лицо (ракурс 0) берём из отдельной текстуры двойного разрешения, когда она загружена
vec4 views(sampler2D t, sampler2D f, float hasF) {
  vec4 c0 = hasF > 0.5 ? texture2D(f, vec2(vUvA.x * 4.0, vUvA.y)) : texture2D(t, vUvA.xy);
  vec4 c1 = texture2D(t, vUvA.zw), c2 = texture2D(t, vUvB.xy), c3 = texture2D(t, vUvB.zw);
  vec3 rgb = c0.rgb * c0.a * vW.x + c1.rgb * c1.a * vW.y + c2.rgb * c2.a * vW.z + c3.rgb * c3.a * vW.w;
  float a = c0.a * vW.x + c1.a * vW.y + c2.a * vW.z + c3.a * vW.w;
  return vec4(rgb, a);
}
void main() {
  vec4 p = views(uA, uFA, uHA);
  vec4 q = views(uB, uFB, uHB);
  vec4 c = mix(p, q, uMix);
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb / c.a, 1.0);
}`;

export function createCones(canvas: HTMLCanvasElement, onReady?: () => void) {
  const mobile = window.matchMedia("(max-width: 1023px)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 9);

  // атласы вкусов: сначала текущий, остальные — когда первый экран уже показан
  const loader = new THREE.TextureLoader();
  const tex: (THREE.Texture | null)[] = IDS.map(() => null);
  const pending: (Promise<THREE.Texture> | null)[] = IDS.map(() => null);
  const load = (i: number) =>
    (pending[i] ??= new Promise<THREE.Texture>((res) => {
      loader.load(`${BASE}/cone/atlas-${IDS[i]}.webp`, (t) => {
        // цвета передаём как есть: шейдер свой, без пересчёта цветового пространства
        t.colorSpace = THREE.NoColorSpace;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex[i] = t;
        res(t);
      });
    }));

  // лицо рожка в двойном разрешении — только на ДВ (на телефоне рожок мельче, хватает атласа), после первого экрана
  const front: (THREE.Texture | null)[] = IDS.map(() => null);
  const loadFront = (i: number) => {
    if (mobile || front[i]) return;
    loader.load(`${BASE}/cone/front-${IDS[i]}.webp`, (t) => {
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      front[i] = t;
    });
  };

  const uniforms = {
    uA: { value: null as THREE.Texture | null },
    uB: { value: null as THREE.Texture | null },
    uFA: { value: null as THREE.Texture | null },
    uFB: { value: null as THREE.Texture | null },
    uHA: { value: 0 },
    uHB: { value: 0 },
    uMix: { value: 0 },
    uCam: { value: new THREE.Vector4(1, 0, 0, 0) },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms, side: THREE.FrontSide });
  const root = new THREE.Group();
  const turn = new THREE.Group();
  root.add(turn);
  turn.add(new THREE.Mesh(bodyGeometry(), mat));
  scene.add(root);
  root.visible = false;

  let current = stage.flavor;
  load(current).then((t) => {
    uniforms.uA.value = t;
    uniforms.uB.value = t;
    root.visible = true;
    onReady?.();
    setTimeout(() => {
      loadFront(current);
      IDS.forEach((_, i) => i !== current && load(i));
      setTimeout(() => IDS.forEach((_, i) => loadFront(i)), 1500);
    }, 300);
  });

  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = (e: PointerEvent) => {
    ptr.x = e.clientX / window.innerWidth - 0.5;
    ptr.y = e.clientY / window.innerHeight - 0.5;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  let lastW = 0;
  const resize = () => {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (mobile && w === lastW) return; // МВ: адресная строка меняет только высоту
    lastW = w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const visH = () => 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const place = (p: Pose) => {
    const vh = visH(),
      vw = vh * camera.aspect;
    root.position.set((p.x / 100 - 0.5) * vw, (0.5 - p.y / 100) * vh, 0);
    root.scale.setScalar(((p.h / 100) * vh) / HW);
    root.rotation.z = THREE.MathUtils.degToRad(-p.r);
  };

  const P = { ...(mobile ? POSES.mob : POSES.desk) };
  // МВ: рожок встаёт в места, оставленные в вёрстке (первый экран и блок вкусов)
  const fitSpot = () => {
    if (!mobile) return;
    const vh = window.innerHeight;
    const el = document.querySelector<HTMLElement>("[data-cone-spot]");
    if (el) {
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      P.hero = { ...POSES.mob.hero, y: ((top + r.height / 2) / vh) * 100, h: (r.height / vh) * 100 };
    }
    const fs = document.querySelector<HTMLElement>("[data-flv-spot]");
    if (fs && fs.offsetHeight > 0) {
      P.flv = { ...POSES.mob.flv, y: ((fs.offsetTop + fs.offsetHeight / 2) / vh) * 100, h: (fs.offsetHeight / vh) * 100 * 0.96 };
    }
  };
  fitSpot();
  window.addEventListener("resize", fitSpot);

  let swap = 1,
    target = current,
    t = 0,
    raf = 0,
    last = performance.now();

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    t += dt;

    // ---- смена вкуса: новый атлас проступает поверх старого, цвет джема перетекает
    if (stage.flavor !== target && swap >= 1 && tex[stage.flavor]) {
      target = stage.flavor;
      swap = 0;
      uniforms.uB.value = tex[target];
    } else if (stage.flavor !== target && !tex[stage.flavor]) load(stage.flavor);
    if (swap < 1) {
      swap = Math.min(1, swap + dt / (reduced ? 0.01 : 0.7));
      uniforms.uMix.value = swap * swap * (3 - 2 * swap);
      if (swap >= 1) {
        current = target;
        uniforms.uA.value = tex[current];
        uniforms.uMix.value = 0;
      }
    }

    // ---- поза по разделам
    let p = P.hero;
    p = mix(p, P.pour, ease(stage.openIn));
    p = mix(p, P.flv, ease(stage.flvIn));
    p = mix(p, P.away, ease(stage.away));
    place({ ...p, y: p.y + (reduced ? 0 : Math.sin(t * 0.9) * 0.6) });
    turn.visible = stage.away < 0.999;
    ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-4 * dt));
    ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-4 * dt));
    // рожок не прокручивается: лицом к зрителю (снимок 0), только чуть поворачивается вправо-влево (±13°);
    // в этих пределах весь видимый бок — из одного снимка, без швов
    turn.rotation.set(0, reduced ? 0 : Math.sin(t * 0.6) * 0.22, 0);
    // какой снимок смотрит на зрителя: зритель в координатах рожка — под углом −rotation.y
    const cam = [0, 1, 2, 3].map((k) => Math.pow(Math.max(0, Math.cos(-turn.rotation.y - (k * Math.PI) / 2)), 24));
    const cs = cam[0] + cam[1] + cam[2] + cam[3];
    uniforms.uCam.value.set(cam[0] / cs, cam[1] / cs, cam[2] / cs, cam[3] / cs);

    // лицо высокого разрешения для обоих смешиваемых вкусов (пока не загружено — берётся из атласа)
    const fa = front[current],
      fb = front[target];
    uniforms.uFA.value = fa ?? uniforms.uA.value;
    uniforms.uHA.value = fa ? 1 : 0;
    uniforms.uFB.value = fb ?? uniforms.uB.value;
    uniforms.uHB.value = fb ? 1 : 0;

    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("resize", resize);
    window.removeEventListener("resize", fitSpot);
    renderer.dispose();
  };
}
