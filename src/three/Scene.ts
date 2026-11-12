// 3D-сцена «Сугроба»: стаканчик мороженого (этикетка рисуется на canvas),
// крышка, пломбир внутри и ингредиенты вокруг — клубника, шоколад, ежевика.
// Всё строится из геометрии, без моделей и картинок.
// Хореография приходит снаружи через мутабельный `stage` (его пишут ScrollTrigger'ы),
// React в кадре не участвует.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { flavors, type Flavor } from "@/content";

import { stage } from "./stage";

// ---------- утилиты ----------
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// детерминированный «рандом», чтобы сцена была одинаковой при каждой загрузке
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

type Pose = { x: number; y: number; z: number; s: number; rx: number; rz: number };
const mixPose = (a: Pose, b: Pose, k: number): Pose => ({
  x: lerp(a.x, b.x, k),
  y: lerp(a.y, b.y, k),
  z: lerp(a.z, b.z, k),
  s: lerp(a.s, b.s, k),
  rx: lerp(a.rx, b.rx, k),
  rz: lerp(a.rz, b.rz, k),
});

// позы стаканчика по разделам: ДВ и МВ отдельно
const POSES = {
  desk: {
    hero: { x: 1.55, y: -0.2, z: 0, s: 1.12, rx: 0.16, rz: -0.1 },
    open: { x: 1.2, y: -0.55, z: 0.6, s: 1.15, rx: 0.78, rz: 0 },
    flv: { x: -1.75, y: -0.15, z: 0, s: 1.1, rx: 0.12, rz: 0.06 },
    away: { x: -1.9, y: 4.6, z: -1, s: 0.9, rx: 0.5, rz: 0.4 },
    buy: { x: 1.55, y: -0.35, z: 0, s: 0.82, rx: 0.14, rz: 0 },
  },
  mob: {
    hero: { x: 0, y: 1.2, z: 0, s: 0.56, rx: 0.16, rz: -0.08 },
    open: { x: 0, y: 1.05, z: 0.4, s: 0.6, rx: 0.8, rz: 0 },
    flv: { x: 0, y: 1.05, z: 0, s: 0.58, rx: 0.12, rz: 0 },
    away: { x: 0, y: 5, z: -1, s: 0.5, rx: 0.5, rz: 0.4 },
    buy: { x: 0, y: 1.25, z: 0, s: 0.4, rx: 0.14, rz: 0 },
  },
} satisfies Record<string, Record<string, Pose>>;

// ---------- этикетка ----------
const TUB_H = 1.9;
const R_TOP = 1;
const R_BOT = 0.8;

function fontFamily(varName: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

// маленькие рисунки ингредиентов для этикетки
function drawStrawberry(g: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  g.fillStyle = "#e23a4e";
  g.beginPath();
  g.moveTo(0, 46);
  g.bezierCurveTo(-30, 30, -44, 0, -36, -20);
  g.bezierCurveTo(-28, -38, 28, -38, 36, -20);
  g.bezierCurveTo(44, 0, 30, 30, 0, 46);
  g.fill();
  g.fillStyle = "#ffe08a";
  const r = rng(7);
  for (let i = 0; i < 16; i++) {
    const px = (r() - 0.5) * 50,
      py = -18 + r() * 52;
    if (Math.abs(px) > 34 - (py + 18) * 0.42) continue;
    g.beginPath();
    g.ellipse(px, py, 2.2, 3.4, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#3f9b45";
  for (let i = 0; i < 5; i++) {
    g.save();
    g.translate(0, -30);
    g.rotate(-1.2 + i * 0.6);
    g.beginPath();
    g.ellipse(0, -12, 7, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.restore();
}
function drawBlackberry(g: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  const rows = [3, 4, 5, 4, 3];
  rows.forEach((n, ri) => {
    for (let i = 0; i < n; i++) {
      const px = (i - (n - 1) / 2) * 13,
        py = (ri - 2) * 12;
      g.fillStyle = "#2a1338";
      g.beginPath();
      g.arc(px, py, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(190,150,255,.55)";
      g.beginPath();
      g.arc(px - 2.5, py - 2.5, 2.4, 0, Math.PI * 2);
      g.fill();
    }
  });
  g.fillStyle = "#4f8c3a";
  g.beginPath();
  g.ellipse(-10, -36, 6, 14, -0.9, 0, Math.PI * 2);
  g.ellipse(10, -36, 6, 14, 0.9, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
function drawChocolate(g: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 3; j++) {
      const px = -26 + i * 28,
        py = -40 + j * 28;
      g.fillStyle = "#4a2414";
      g.beginPath();
      g.roundRect(px, py, 25, 25, 5);
      g.fill();
      g.fillStyle = "#6e3a22";
      g.beginPath();
      g.roundRect(px + 4, py + 4, 17, 17, 3);
      g.fill();
    }
  g.restore();
}
const ICON = { strawberry: drawStrawberry, chocolate: drawChocolate, blackberry: drawBlackberry };

function labelTexture(f: Flavor, display: string, sans: string) {
  const W = 2048,
    H = 680;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  // фон — цвет вкуса, снизу «сугроб» из сливок волнистой линией
  g.fillStyle = f.accent;
  g.fillRect(0, 0, W, H);
  const band = H * 0.6;
  g.fillStyle = "#fff7f1";
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) {
    // период кратен ширине — шов на обороте не виден
    const y = band + Math.sin((x / W) * Math.PI * 2 * 7) * 16 + Math.sin((x / W) * Math.PI * 2 * 3) * 10;
    g.lineTo(x, y);
  }
  g.lineTo(W, H);
  g.fill();

  const cx = W / 2; // лицевая сторона — центр развёртки
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillStyle = "rgba(255,247,241,.85)";
  g.font = `600 26px ${sans}`;
  g.letterSpacing = "7px";
  g.fillText("ПЛОМБИР НА СЛИВКАХ 33%", cx, 142);
  g.fillStyle = "#fff7f1";
  g.font = `800 124px ${display}`;
  g.letterSpacing = "-4px";
  g.fillText("СУГРОБ", cx, 280);
  // снежинка-знак над буквой «О»
  g.strokeStyle = "#fff7f1";
  g.lineWidth = 5;
  g.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    g.beginPath();
    g.moveTo(cx + 290 - Math.cos(a) * 18, 300 - 112 - Math.sin(a) * 18);
    g.lineTo(cx + 290 + Math.cos(a) * 18, 300 - 112 + Math.sin(a) * 18);
    g.stroke();
  }

  g.fillStyle = f.accent;
  g.font = `700 74px ${display}`;
  g.letterSpacing = "0px";
  g.fillText(f.name.toUpperCase(), cx, band + 140);
  g.fillStyle = f.ink;
  g.font = `600 30px ${sans}`;
  g.letterSpacing = "6px";
  g.fillText("450 МЛ · 240 Г", cx, band + 200);

  // рисунки по бокам названия
  const icon = ICON[f.id];
  icon(g, cx - 330, band + 112, 1.25, -0.25);
  icon(g, cx + 330, band + 112, 1.25, 0.25);
  icon(g, cx - 450, band + 150, 0.85, 0.3);
  icon(g, cx + 450, band + 150, 0.85, -0.3);

  // оборот: состав и штрихкод
  g.textAlign = "left";
  g.fillStyle = "rgba(255,247,241,.9)";
  g.font = `600 26px ${sans}`;
  g.letterSpacing = "3px";
  g.fillText("СОСТАВ", 80, 120);
  g.font = `400 24px ${sans}`;
  g.letterSpacing = "0px";
  ["Сливки 33%, молоко цельное,", "сахар тростниковый,", f.inside.toLowerCase() + ",", "сухое молоко, камедь", "рожкового дерева."].forEach(
    (l, i) => g.fillText(l, 80, 168 + i * 36),
  );
  g.fillStyle = f.ink;
  const r = rng(11);
  let bx = W - 420;
  for (let i = 0; i < 46; i++) {
    const w = 2 + Math.floor(r() * 6);
    g.fillRect(bx, band + 70, w, 130);
    bx += w + 2 + Math.floor(r() * 4);
  }
  g.font = `500 22px ${sans}`;
  g.fillText("4 607 012 345 678", W - 420, band + 236);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function lidTexture(f: Flavor, display: string) {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff7f1";
  g.fillRect(0, 0, S, S);
  g.fillStyle = f.accent;
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff7f1";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `800 64px ${display}`;
  g.fillText("СУГРОБ", S / 2, S / 2 + 6);
  g.strokeStyle = "rgba(255,247,241,.6)";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- пломбир внутри ----------
const CREAM: Record<string, [string, string]> = {
  strawberry: ["#ffe6e2", "#cf2741"],
  chocolate: ["#8d5a3b", "#3a1b0e"],
  blackberry: ["#f1e6f6", "#4b1b6f"],
};
function iceCreamGeometry() {
  // купол с завитком: полярная сетка, высота и рябь от угла и радиуса
  const RS = 40,
    AS = 120,
    R = R_TOP * 0.95;
  const pos: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= RS; i++) {
    const r = (i / RS) * R;
    for (let j = 0; j <= AS; j++) {
      const a = (j / AS) * Math.PI * 2;
      const k = r / R;
      const y = 0.16 * (1 - k * k) + 0.045 * Math.sin(3 * a + k * 12) * k * (1 - k * 0.6) + 0.02 * Math.sin(9 * a - k * 5) * k;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  for (let i = 0; i < RS; i++)
    for (let j = 0; j < AS; j++) {
      const a = i * (AS + 1) + j,
        b = a + AS + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(new Array(pos.length).fill(1), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
function paintIceCream(geo: THREE.BufferGeometry, id: string) {
  const [base, sauce] = CREAM[id].map((c) => new THREE.Color(c));
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  const col = geo.getAttribute("color") as THREE.BufferAttribute;
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    const r = Math.hypot(x, z),
      a = Math.atan2(z, x);
    // спираль соуса
    const s = Math.sin(a * 2 + r * 11 + Math.sin(r * 23) * 0.6);
    const t = THREE.MathUtils.smoothstep(s, 0.55, 0.85);
    c.copy(base).lerp(sauce, t * 0.9);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

// ---------- ингредиенты ----------
function strawberryGeometries() {
  // профиль снизу (кончик) вверх: конус с округлыми «плечами» и плоской макушкой под чашелистиком
  const prof = (t: number) => 0.5 * Math.pow(t, 0.72) * Math.pow(1 - Math.pow(t, 6), 0.5);
  const y0 = -0.56,
    hgt = 1.0;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    pts.push(new THREE.Vector2(Math.max(0.0005, prof(t)), y0 + t * hgt));
  }
  const body = new THREE.LatheGeometry(pts, 56);
  const seed = new THREE.SphereGeometry(0.016, 6, 4).scale(1, 1.7, 0.6);
  // плоский заострённый листик, лежит в плоскости XZ и смотрит по +X
  const leaf = new THREE.CircleGeometry(0.5, 14).scale(0.34, 0.11, 1).translate(0.16, 0, 0).rotateX(-Math.PI / 2);
  return { body, seed, leaf, prof, y0, hgt };
}
function makeStrawberry(G: ReturnType<typeof strawberryGeometries>, mats: Record<string, THREE.Material>, seed: number) {
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(G.body, mats.berry));
  // семечки рядами по поверхности, в шахматном порядке, чуть утоплены
  const r = rng(seed);
  const spots: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion(),
    one = new THREE.Vector3(1, 1, 1);
  const ROWS = 13;
  for (let row = 0; row < ROWS; row++) {
    const t = 0.07 + (row / (ROWS - 1)) * 0.8;
    const rad = G.prof(t);
    const dr = (G.prof(t + 0.01) - G.prof(t - 0.01)) / (0.02 * G.hgt); // наклон профиля
    const count = Math.max(4, Math.round((Math.PI * 2 * rad) / 0.085));
    for (let i = 0; i < count; i++) {
      const a = ((i + (row % 2) * 0.5) / count) * Math.PI * 2 + (r() - 0.5) * 0.12;
      // семечко вытянуто вдоль профиля, тонкая ось (z) — по нормали к поверхности
      const v = new THREE.Vector3(Math.cos(a) * rad * 0.985, G.y0 + t * G.hgt, Math.sin(a) * rad * 0.985);
      q.setFromEuler(new THREE.Euler(-Math.atan(dr) * 0.8, Math.PI / 2 - a, 0, "YXZ"));
      spots.push(new THREE.Matrix4().compose(v, q, one));
    }
  }
  const inst = new THREE.InstancedMesh(G.seed, mats.seed, spots.length);
  spots.forEach((m, i) => inst.setMatrixAt(i, m));
  grp.add(inst);
  // чашелистик: плоские листики звездой, кончики чуть опущены
  const top = G.y0 + G.hgt;
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(G.leaf, mats.leaf);
    // макушка почти плоская — листики кладём поверх и чуть свешиваем за край
    l.position.y = top + 0.012;
    l.rotation.order = "YZX";
    l.rotation.y = (i / 8) * Math.PI * 2 + r() * 0.2;
    l.rotation.z = -0.12 - r() * 0.22;
    l.scale.set(1.15 + r() * 0.35, 1, 1.3);
    grp.add(l);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.16, 6), mats.leaf);
  stem.position.y = top + 0.06;
  stem.rotation.z = 0.25;
  grp.add(stem);
  return grp;
}

function blackberryGeometries() {
  return {
    drupe: new THREE.SphereGeometry(0.085, 12, 8),
    leaf: new THREE.ConeGeometry(0.05, 0.26, 4).rotateZ(Math.PI / 2).translate(0.15, 0, 0).scale(1, 0.25, 1),
  };
}
function makeBlackberry(G: ReturnType<typeof blackberryGeometries>, mats: Record<string, THREE.Material>) {
  const grp = new THREE.Group();
  // зёрнышки по эллипсоиду (спираль Фибоначчи)
  const N = 72;
  const inst = new THREE.InstancedMesh(G.drupe, mats.drupe, N);
  const m = new THREE.Matrix4();
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rr = Math.sqrt(1 - y * y);
    const a = i * golden;
    const j = 1 + (((i * 37) % 11) / 11 - 0.5) * 0.12; // зёрна чуть разного размера
    m.makeScale(j, j, j).setPosition(Math.cos(a) * rr * 0.27, y * 0.4, Math.sin(a) * rr * 0.27);
    inst.setMatrixAt(i, m);
  }
  grp.add(inst);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12).scale(0.26, 0.38, 0.26), mats.drupe);
  grp.add(core);
  for (let i = 0; i < 5; i++) {
    const l = new THREE.Mesh(G.leaf, mats.leaf);
    l.position.y = 0.38;
    l.rotation.y = (i / 5) * Math.PI * 2;
    l.rotation.z = -0.5;
    grp.add(l);
  }
  return grp;
}

function chocolateGeometries() {
  return {
    base: new RoundedBoxGeometry(1, 0.12, 1, 2, 0.03),
    cell: new RoundedBoxGeometry(0.42, 0.14, 0.42, 3, 0.06),
  };
}
function makeChocolate(G: ReturnType<typeof chocolateGeometries>, mats: Record<string, THREE.Material>, cols: number, rows: number) {
  const grp = new THREE.Group();
  const base = new THREE.Mesh(G.base, mats.choc);
  base.scale.set(cols * 0.46, 1, rows * 0.46);
  grp.add(base);
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const c = new THREE.Mesh(G.cell, mats.choc);
      c.position.set((i - (cols - 1) / 2) * 0.46, 0.09, (j - (rows - 1) / 2) * 0.46);
      grp.add(c);
    }
  grp.scale.setScalar(0.85);
  return grp;
}

// места ингредиентов вокруг стаканчика: [x, y, z, масштаб, глубина параллакса]
// координаты относительно стаканчика (облако летит вместе с ним из раздела в раздел)
const SLOTS_D: number[][] = [
  [-1.7, 1.7, -1.8, 0.6, 1.0],
  [-1.6, -1.6, -0.8, 0.6, 1.5],
  [-0.2, 2.3, -2.6, 0.55, 0.8],
  [0.5, -2.0, -1.2, 0.6, 1.6],
  [2.0, 1.25, -1.0, 0.75, 1.2],
  [1.8, -1.4, 0.8, 0.8, 2.2],
  [-1.25, 0.4, 1.0, 0.5, 2.0],
  [1.15, 2.3, 0.6, 0.55, 2.6],
  [-1.7, -1.75, 2.1, 0.8, 3.0], // крупная у камеры, внизу кадра
]
const SLOTS_M: number[][] = [
  [-1.0, 1.4, -1.2, 0.55, 1.4],
  [1.05, 1.1, -0.6, 0.5, 1.8],
  [-1.0, -1.1, 0.4, 0.5, 2.2],
  [1.0, -0.9, -1.4, 0.55, 1.2],
  [0.2, 2.0, -2.4, 0.45, 0.9],
  [-1.2, -2.9, -1, 0.5, 1.4],
  [1.1, -2.6, 0.5, 0.55, 2.4],
  [0.6, -3.9, -2.2, 0.4, 1],
  [-0.7, 0.4, 1.8, 0.55, 3],
]

// ---------- сцена ----------
export function createScene(canvas: HTMLCanvasElement, onReady?: () => void) {
  const mobile = window.matchMedia("(max-width: 1023px)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 2 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.fog = new THREE.Fog(new THREE.Color(flavors[0].bg), 9, 19);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 7.5);

  const key = new THREE.DirectionalLight("#fff4ea", 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#ffffff", 0.8);
  rim.position.set(-4, 2, -3);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight("#ffffff", "#f3d7d2", 0.5));

  const display = fontFamily("--font-display", "sans-serif");
  const sans = fontFamily("--font-sans", "sans-serif");

  // ----- стаканчики -----
  const sideGeo = new THREE.CylinderGeometry(R_TOP, R_BOT, TUB_H, 96, 1, true, Math.PI);
  const innerGeo = new THREE.CylinderGeometry(R_TOP * 0.97, R_BOT * 0.97, TUB_H, 64, 1, true);
  const bottomGeo = new THREE.CircleGeometry(R_BOT, 48).rotateX(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(R_TOP, 0.045, 12, 96).rotateX(Math.PI / 2);
  const lidGeo = new THREE.CylinderGeometry(R_TOP * 1.05, R_TOP * 1.05, 0.16, 96, 1, false, Math.PI);
  const lidRimGeo = new THREE.TorusGeometry(R_TOP * 1.05, 0.08, 12, 96).rotateX(Math.PI / 2);

  let labels: THREE.CanvasTexture[] = [];
  let lids: THREE.CanvasTexture[] = [];
  const buildTextures = () => {
    labels.forEach((t) => t.dispose());
    lids.forEach((t) => t.dispose());
    labels = flavors.map((f) => labelTexture(f, display, sans));
    lids = flavors.map((f) => lidTexture(f, display));
  };
  buildTextures();

  const paper = (map?: THREE.Texture) =>
    new THREE.MeshPhysicalMaterial({ map, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, color: "#ffffff" });

  type Tub = {
    root: THREE.Group;
    body: THREE.Group;
    lid: THREE.Group;
    side: THREE.MeshPhysicalMaterial;
    lidTop: THREE.MeshPhysicalMaterial;
    rimMat: THREE.MeshPhysicalMaterial;
    cream?: THREE.BufferGeometry;
    f: number;
  };
  function makeTub(fi: number, withCream: boolean): Tub {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const side = paper(labels[fi]);
    body.add(new THREE.Mesh(sideGeo, side));
    const innerMat = new THREE.MeshStandardMaterial({ color: "#f6efe9", roughness: 0.7, side: THREE.BackSide });
    body.add(new THREE.Mesh(innerGeo, innerMat));
    const bottom = new THREE.Mesh(bottomGeo, innerMat);
    bottom.position.y = -TUB_H / 2;
    body.add(bottom);
    const rimMat = new THREE.MeshPhysicalMaterial({ color: flavors[fi].accent, roughness: 0.35, clearcoat: 0.8 });
    const rimM = new THREE.Mesh(rimGeo, rimMat);
    rimM.position.y = TUB_H / 2;
    body.add(rimM);
    let cream: THREE.BufferGeometry | undefined;
    if (withCream) {
      cream = iceCreamGeometry();
      paintIceCream(cream, flavors[fi].id);
      const m = new THREE.Mesh(cream, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, clearcoat: 0.25, sheen: 0.6, sheenColor: new THREE.Color("#ffffff") }));
      m.position.y = TUB_H / 2 - 0.12;
      body.add(m);
    }
    // крышка: бок цвета вкуса, верх с логотипом
    const lid = new THREE.Group();
    const lidTop = paper(lids[fi]);
    const lidSide = rimMat;
    const lm = new THREE.Mesh(lidGeo, [lidSide, lidTop, lidSide]);
    lid.add(lm);
    const lr = new THREE.Mesh(lidRimGeo, rimMat);
    lr.position.y = -0.04;
    lid.add(lr);
    lid.position.y = TUB_H / 2 + 0.06;
    body.add(lid);
    return { root, body, lid, side, lidTop, rimMat, cream, f: fi };
  }
  function setTubFlavor(t: Tub, fi: number) {
    t.f = fi;
    t.side.map = labels[fi];
    t.lidTop.map = lids[fi];
    t.side.needsUpdate = t.lidTop.needsUpdate = true;
    t.rimMat.color.set(flavors[fi].accent);
    if (t.cream) paintIceCream(t.cream, flavors[fi].id);
  }

  const main = makeTub(0, true);
  scene.add(main.root);
  // ещё два стаканчика для финального набора
  const extra = [makeTub(1, false), makeTub(2, false)];
  extra.forEach((t) => {
    t.root.visible = false;
    scene.add(t.root);
  });

  // ----- ингредиенты -----
  const mats: Record<string, THREE.Material> = {
    berry: new THREE.MeshPhysicalMaterial({ color: "#c8122b", roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 }),
    seed: new THREE.MeshStandardMaterial({ color: "#e9b949", roughness: 0.45 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#3f8f3a", roughness: 0.6, side: THREE.DoubleSide }),
    drupe: new THREE.MeshPhysicalMaterial({ color: "#1e0628", roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.5, sheenColor: new THREE.Color("#7a3fb0") }),
    choc: new THREE.MeshPhysicalMaterial({ color: "#2e1209", roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  };
  const SG = strawberryGeometries();
  const BG = blackberryGeometries();
  const CG = chocolateGeometries();

  const slots = mobile ? SLOTS_M : SLOTS_D;
  type Piece = { obj: THREE.Group; slot: number[]; spin: THREE.Vector3; phase: number; set: number };
  const pieces: Piece[] = [];
  const sets = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  sets.forEach((s) => scene.add(s));
  const r = rng(42);
  for (let fi = 0; fi < 3; fi++) {
    slots.forEach((slot, i) => {
      let obj: THREE.Group;
      if (fi === 0) obj = makeStrawberry(SG, mats, 100 + i);
      else if (fi === 1) obj = makeChocolate(CG, mats, 1 + (i % 2), 2 + (i % 3 === 0 ? 1 : 0));
      else obj = makeBlackberry(BG, mats);
      obj.rotation.set(r() * 6, r() * 6, r() * 6);
      sets[fi].add(obj);
      pieces.push({ obj, slot, spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.5), phase: r() * 10, set: fi });
    });
  }
  const weights = [1, 0, 0];

  // ----- снег: лёгкие хлопья на фоне -----
  const SN = mobile ? 140 : 260;
  const snowPos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) {
    snowPos[i * 3] = (r() - 0.5) * 12;
    snowPos[i * 3 + 1] = (r() - 0.5) * 8;
    snowPos[i * 3 + 2] = -1 - r() * 5;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  const dot = document.createElement("canvas");
  dot.width = dot.height = 32;
  const dg = dot.getContext("2d")!;
  const grad = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  dg.fillStyle = grad;
  dg.fillRect(0, 0, 32, 32);
  const snow = new THREE.Points(
    snowGeo,
    new THREE.PointsMaterial({ size: 0.07, map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.85, depthWrite: false, fog: false }),
  );
  scene.add(snow);

  // ----- смена вкуса: стаканчик делает оборот, этикетка меняется на развороте -----
  let shown = 0;
  let spin = 0; // 0..1 прогресс оборота
  let spinFrom = 0;
  let spinning = false;
  let pendingFlavor = 0;
  const fogFrom = new THREE.Color(flavors[0].bg),
    fogTo = new THREE.Color(flavors[0].bg);
  let fogK = 1;

  // ----- указатель: стаканчик слегка поворачивается за курсором -----
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  function resize() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  // на МВ высота меняется от адресной строки — пересчитываем только при смене ширины
  let lastW = 0;
  const onResize = () => {
    if (mobile && canvas.clientWidth === lastW) return;
    lastW = canvas.clientWidth;
    resize();
  };
  resize();
  lastW = canvas.clientWidth;
  window.addEventListener("resize", onResize);

  const P = mobile ? POSES.mob : POSES.desk;
  const clock = new THREE.Clock();
  let time = 0;
  let raf = 0;
  let visible = true;
  let ready = false;

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    time += reduced ? 0 : dt;

    // вкус
    const target = stage.flavor;
    if (target !== shown && !spinning) {
      spinning = true;
      spin = 0;
      spinFrom = shown;
      pendingFlavor = target;
      fogFrom.copy((scene.fog as THREE.Fog).color);
      fogTo.set(flavors[target].bg);
      fogK = 0;
    }
    if (spinning) {
      spin = Math.min(1, spin + dt / 0.95);
      if (spin >= 0.5 && main.f !== pendingFlavor) setTubFlavor(main, pendingFlavor);
      if (spin >= 1) {
        spinning = false;
        shown = pendingFlavor;
        void spinFrom;
      }
    }
    fogK = Math.min(1, fogK + dt / 0.8);
    (scene.fog as THREE.Fog).color.copy(fogFrom).lerp(fogTo, ease(fogK));
    for (let i = 0; i < 3; i++) {
      const w = i === (spinning && spin < 0.5 ? spinFrom : spinning ? pendingFlavor : shown) ? 1 : 0;
      weights[i] += (w - weights[i]) * (1 - Math.exp(-6 * dt));
    }

    // поза стаканчика по разделам
    let pose = P.hero;
    pose = mixPose(pose, P.open, ease(stage.openIn));
    pose = mixPose(pose, P.flv, ease(stage.flvIn));
    pose = mixPose(pose, P.away, ease(stage.away));
    pose = mixPose(pose, P.buy, ease(stage.buyIn));
    // в финале стаканчики прокручиваются вместе с блоком: пиксели → единицы сцены на глубине z=0
    const worldPerPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z) / canvas.clientHeight;
    pose = { ...pose, y: pose.y + stage.buyPx * worldPerPx };
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-3 * dt));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-3 * dt));
    const float = Math.sin(time * 0.9) * 0.06;
    main.root.position.set(pose.x, pose.y + float, pose.z);
    main.root.scale.setScalar(pose.s);
    main.root.rotation.set(pose.rx + pointer.sy * 0.12, 0, pose.rz);
    // медленное вращение + оборот при смене вкуса; в блоке вкусов этикетка смотрит в камеру
    const idleSpin = Math.sin(time * 0.35) * 0.35 * (1 - stage.flvIn * (1 - stage.away)) * (1 - stage.buyIn);
    main.body.rotation.y = idleSpin + pointer.sx * 0.35 + ease(spin) * Math.PI * 2 * (spinning ? 1 : 0);

    // крышка: поднимается, отлетает вправо-вверх и поворачивается
    const L = ease(stage.lid);
    main.lid.position.set(L * 1.6, TUB_H / 2 + 0.06 + L * 1.7, L * -0.6);
    main.lid.rotation.set(L * -0.5, 0, L * -1.1);

    // набор из трёх
    const b = ease(stage.buyIn);
    extra.forEach((t, i) => {
      t.root.visible = b > 0.01;
      const fi = (main.f + 1 + i) % 3;
      if (t.f !== fi) setTubFlavor(t, fi);
      const dir = i === 0 ? -1 : 1;
      const spread = mobile ? 0.82 : 1.35;
      t.root.position.set(pose.x + dir * spread * b, pose.y - 0.15 + float * -0.6 + (1 - b) * -3, pose.z - 0.5);
      t.root.scale.setScalar(pose.s * 0.92);
      t.root.rotation.set(pose.rx, dir * -0.35 + Math.sin(time * 0.3 + i) * 0.1, dir * 0.05);
    });

    // ингредиенты: дрейф, вращение, параллакс по скроллу; невидимые наборы уходят в ноль
    const away = ease(stage.away) * (1 - ease(stage.buyIn));
    for (const p of pieces) {
      const w = weights[p.set];
      const [x, y, z, s, depth] = p.slot;
      const vis = w * (1 - away * 0.85);
      p.obj.visible = vis > 0.01;
      if (!p.obj.visible) continue;
      p.obj.position.set(
        pose.x + x + Math.sin(time * 0.4 + p.phase) * 0.12,
        // покачивание по скроллу: ближние (depth больше) двигаются сильнее — ощущение глубины
        (mobile ? pose.y : 0) + y + Math.sin(time * 0.7 + p.phase) * 0.15 + Math.sin(stage.scroll * Math.PI * 8 + p.phase) * depth * 0.35,
        z + pose.z * 0.5,
      );
      p.obj.rotation.x += p.spin.x * dt;
      p.obj.rotation.y += p.spin.y * dt;
      p.obj.rotation.z += p.spin.z * dt;
      p.obj.scale.setScalar(s * ease(clamp(vis)));
    }
    // снег медленно падает
    const sp = snowGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < SN; i++) {
      let y = sp.getY(i) - dt * (0.12 + (i % 5) * 0.03);
      if (y < -4) y = 4;
      sp.setY(i, y);
      sp.setX(i, sp.getX(i) + Math.sin(time + i) * dt * 0.03);
    }
    sp.needsUpdate = true;

    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      onReady?.();
    }
  }
  frame();

  const onVis = () => {
    visible = document.visibilityState === "visible";
    clock.getDelta();
  };
  document.addEventListener("visibilitychange", onVis);

  // шрифты могли догрузиться позже — перерисуем этикетки
  document.fonts?.ready.then(() => {
    buildTextures();
    setTubFlavor(main, main.f);
    extra.forEach((t) => setTubFlavor(t, t.f));
  });

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVis);
    renderer.dispose();
    pmrem.dispose();
  };
}
