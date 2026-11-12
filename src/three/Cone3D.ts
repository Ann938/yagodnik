// Рожок в 3D из фото. Форма — тело вращения по контуру снимка (profile.json: центр и полуширина
// каждой строки), фото натянуто проекцией спереди; задняя сторона получает зеркальную копию передней —
// рожок и пломбир почти круглые, поэтому при повороте это незаметно.
// На каждый вкус — своё цельное фото (public/cone/full-<вкус>.webp, одинаковый кадр): без слоёв и швов.
// При смене вкуса новое фото проступает поверх старого. Динамика страницы — в ягодах на фоне.
import * as THREE from "three";
import { stage } from "./stage";
import profile from "./profile.json";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const IDS = ["strawberry", "blackberry", "raspberry"] as const; // порядок как в content.ts
const HW = 3.2; // высота модели в единицах сцены
const K = (profile.w / profile.h) * HW; // доля ширины картинки → единицы

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

const rows = profile.rows;

function bodyGeometry(grow: number) {
  const J = 128;
  const pos: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const { v, cx, r } = rows[i];
    for (let j = 0; j <= J; j++) {
      const a = -Math.PI + (j / J) * Math.PI * 2;
      const s = Math.sin(a),
        c = Math.cos(a);
      pos.push((cx - 0.5) * K + r * K * s * grow, (v - 0.5) * HW, r * K * c * grow);
      // проекция спереди; сзади — зеркально; чуть внутрь контура — край снимка полупрозрачный
      uv.push(cx + r * 0.955 * s, v);
    }
  }
  for (let i = 0; i < rows.length - 1; i++)
    for (let j = 0; j < J; j++) {
      const a = i * (J + 1) + j,
        b = a + J + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// фото без освещения: свет уже «в снимке»
const photoMat = (map: THREE.Texture | null, fade = false) =>
  new THREE.MeshBasicMaterial({ map, alphaTest: 0.35, transparent: fade, opacity: fade ? 0 : 1, side: THREE.FrontSide });

export function createCones(canvas: HTMLCanvasElement, onReady?: () => void) {
  const mobile = window.matchMedia("(max-width: 1023px)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 9);

  // фото вкусов: сначала текущий, остальные — когда первый экран уже показан
  const loader = new THREE.TextureLoader();
  const tex: (THREE.Texture | null)[] = IDS.map(() => null);
  const pending: (Promise<THREE.Texture> | null)[] = IDS.map(() => null);
  const load = (i: number) =>
    (pending[i] ??= new Promise<THREE.Texture>((res) => {
      loader.load(`${BASE}/cone/full-${IDS[i]}.webp`, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex[i] = t;
        res(t);
      });
    }));

  const geo = bodyGeometry(1);
  const geoNext = bodyGeometry(1.004);
  const root = new THREE.Group();
  const turn = new THREE.Group();
  root.add(turn);
  const mat = photoMat(null);
  const matNext = photoMat(null, true); // новое фото проступает поверх старого
  const mesh = new THREE.Mesh(geo, mat);
  const meshNext = new THREE.Mesh(geoNext, matNext);
  meshNext.visible = false;
  meshNext.renderOrder = 1;
  turn.add(mesh, meshNext);
  scene.add(root);
  root.visible = false;

  let current = stage.flavor;
  load(current).then((t) => {
    mat.map = t;
    mat.needsUpdate = true;
    root.visible = true;
    onReady?.();
    setTimeout(() => IDS.forEach((_, i) => i !== current && load(i)), 300);
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
    // блок вкусов: место внутри закреплённого экрана — считаем от его верха (sticky стоит на top: 0)
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

    // ---- смена вкуса: новое фото проступает поверх старого, цвет джема перетекает
    if (stage.flavor !== target && swap >= 1 && tex[stage.flavor]) {
      target = stage.flavor;
      swap = 0;
      matNext.map = tex[target];
      matNext.needsUpdate = true;
      meshNext.visible = true;
    } else if (stage.flavor !== target && !tex[stage.flavor]) load(stage.flavor);
    if (swap < 1) {
      swap = Math.min(1, swap + dt / (reduced ? 0.01 : 0.7));
      matNext.opacity = swap * swap * (3 - 2 * swap);
      if (swap >= 1) {
        current = target;
        mat.map = tex[current];
        mat.needsUpdate = true;
        meshNext.visible = false;
        matNext.opacity = 0;
      }
    }

    // ---- поза по разделам; рожок мягко покачивается, мышь добавляет поворот и наклон
    let p = P.hero;
    p = mix(p, P.pour, ease(stage.openIn));
    p = mix(p, P.flv, ease(stage.flvIn));
    p = mix(p, P.away, ease(stage.away));
    place({ ...p, y: p.y + (reduced ? 0 : Math.sin(t * 0.9) * 0.6) });
    turn.visible = stage.away < 0.999;
    ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-4 * dt));
    ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-4 * dt));
    const swing = reduced ? 0 : Math.sin(t * 0.45) * 0.38;
    turn.rotation.y = swing + ptr.sx * 0.7;
    turn.rotation.x = ptr.sy * 0.25;

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
