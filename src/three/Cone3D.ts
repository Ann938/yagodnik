// Рожок в 3D из фото. Форма — тело вращения по контуру снимка (profile.json: центр и полуширина
// каждой строки), фото натянуто проекцией спереди; задняя сторона получает зеркальную копию передней —
// рожок и пломбир почти круглые, поэтому при повороте это незаметно.
// Слои те же, что на фото: вафля, пломбир (свой на вкус), соус. Налив — отсечение по высоте в шейдере:
// пломбир виден ниже «уровня», соус — выше; струи — цилиндры сверху.
import * as THREE from "three";
import { flavors } from "@/content";
import { stage } from "./stage";
import profile from "./profile.json";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const HW = 3.2; // высота модели в единицах сцены
const K = (profile.w / profile.h) * HW; // доля ширины картинки → единицы
const CREAM_BOTTOM = 0.48; // v кромки рожка (снизу 0, сверху 1)
const SAUCE_BOTTOM = 0.4; // v кончиков капель

type Pose = { x: number; y: number; h: number; r: number }; // как в вёрстке: центр в vw/vh, высота в vh
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const mix = (a: Pose, b: Pose, k: number): Pose => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), h: lerp(a.h, b.h, k), r: lerp(a.r, b.r, k) });
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const POSES: Record<"desk" | "mob", Record<string, Pose>> = {
  desk: {
    hero: { x: 71, y: 53, h: 86, r: -7 },
    pour: { x: 67, y: 74, h: 128, r: 3 },
    flv: { x: 27, y: 54, h: 86, r: 6 },
    away: { x: 22, y: -70, h: 70, r: 18 },
    find: { x: 72, y: 53, h: 66, r: 0 },
  },
  mob: {
    hero: { x: 50, y: 27, h: 46, r: -6 },
    pour: { x: 50, y: 29, h: 54, r: 2 },
    flv: { x: 50, y: 27, h: 44, r: 4 },
    away: { x: 50, y: -60, h: 40, r: 14 },
    find: { x: 50, y: 24, h: 34, r: 0 },
  },
};

// профиль: v сверху вниз → центр и радиус строки
const rows = profile.rows;
function rowAt(v: number) {
  const f = (1 - v) * (rows.length - 1);
  const i = Math.max(0, Math.min(rows.length - 2, Math.floor(f)));
  const t = f - i;
  return { cx: lerp(rows[i].cx, rows[i + 1].cx, t), r: lerp(rows[i].r, rows[i + 1].r, t) };
}

function bodyGeometry(grow: number) {
  const J = 128;
  const pos: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const { v, cx, r } = rows[i];
    for (let j = 0; j <= J; j++) {
      const th = -Math.PI + (j / J) * Math.PI * 2;
      const s = Math.sin(th),
        c = Math.cos(th);
      pos.push((cx - 0.5) * K + r * K * s * grow, (v - 0.5) * HW, r * K * c * grow);
      // проекция спереди; сзади — зеркально (sin одинаков для θ и π−θ)
      // чуть внутрь контура: край снимка полупрозрачный и с ореолом
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

// материал-фото: без освещения (свет уже «в снимке»), с отсечением по высоте и тёмной изнанкой
function photoMat(map: THREE.Texture, inside = false) {
  // изнанка нужна только вафле (видна, пока рожок пустой)
  const m = new THREE.MeshBasicMaterial({ map, alphaTest: 0.35, side: inside ? THREE.DoubleSide : THREE.FrontSide });
  const u = { uLo: { value: 0 }, uHi: { value: 1 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace("void main() {", "uniform float uLo;\nuniform float uHi;\nvoid main() {")
      .replace(
        "#include <map_fragment>",
        "#include <map_fragment>\n  if (vMapUv.y < uLo || vMapUv.y > uHi) discard;\n  if (!gl_FrontFacing) diffuseColor.rgb *= 0.5;",
      );
  };
  return { m, u };
}

type Cone = {
  root: THREE.Group;
  turn: THREE.Group;
  cream: ReturnType<typeof photoMat>;
  sauce: ReturnType<typeof photoMat>;
  f: number;
};

export function createCones(canvas: HTMLCanvasElement, onReady?: () => void) {
  const mobile = window.matchMedia("(max-width: 1023px)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 9);
  scene.add(new THREE.HemisphereLight("#ffffff", "#d9b8a8", 1.6));

  const loader = new THREE.TextureLoader();
  const tex = (name: string) => {
    const t = loader.load(`${BASE}/cone/${name}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const waffle = tex("cone");
  const creams = flavors.map((f) => tex(`cream-${f.id}`));
  const sauces = flavors.map((f) => tex(`sauce-${f.id}`));

  const geoCone = bodyGeometry(1);
  const geoCream = bodyGeometry(1.004);
  const geoSauce = bodyGeometry(1.012);

  function makeCone(fi: number): Cone {
    const root = new THREE.Group();
    const turn = new THREE.Group();
    root.add(turn);
    turn.add(new THREE.Mesh(geoCone, photoMat(waffle, true).m));
    const cream = photoMat(creams[fi]);
    const sauce = photoMat(sauces[fi]);
    turn.add(new THREE.Mesh(geoCream, cream.m), new THREE.Mesh(geoSauce, sauce.m));
    scene.add(root);
    return { root, turn, cream, sauce, f: fi };
  }
  const setFlavor = (c: Cone, fi: number) => {
    c.f = fi;
    c.cream.m.map = creams[fi];
    c.sauce.m.map = sauces[fi];
  };

  const main = makeCone(stage.flavor);
  const extra = [makeCone((stage.flavor + 1) % 3), makeCone((stage.flavor + 2) % 3)];

  // струи: пломбир из аппарата и соус на макушку
  const streamGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
  const creamStreamMat = new THREE.MeshStandardMaterial({ color: "#fbf1e6", roughness: 0.5 });
  const sauceStreamMat = new THREE.MeshStandardMaterial({ color: "#c0182c", roughness: 0.15, metalness: 0 });
  const creamStream = new THREE.Mesh(streamGeo, creamStreamMat);
  const sauceStream = new THREE.Mesh(streamGeo, sauceStreamMat);
  main.turn.add(creamStream, sauceStream);
  const key = new THREE.DirectionalLight("#ffffff", 1.4);
  key.position.set(2, 4, 5);
  scene.add(key);
  const STREAM = {
    cream: ["#fbf1e6", "#c79874", "#f6f0f4"],
    sauce: ["#b81428", "#3a1a0c", "#2f0a3a"],
  };

  // ждём текстуры
  let ready = false;
  const all = [waffle, creams[main.f], sauces[main.f]];
  const check = () => {
    if (all.every((t) => t.image && (t.image as HTMLImageElement).complete)) {
      ready = true;
      onReady?.();
    } else setTimeout(check, 50);
  };
  check();

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

  // поза из координат вёрстки (vw/vh) в мир
  const visH = () => 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const place = (c: Cone, p: Pose, px: number) => {
    const vh = visH(),
      vw = vh * camera.aspect;
    c.root.position.set((p.x / 100 - 0.5) * vw, (0.5 - p.y / 100) * vh + (px / canvas.clientHeight) * vh, 0);
    c.root.scale.setScalar(((p.h / 100) * vh) / HW);
    c.root.rotation.z = THREE.MathUtils.degToRad(-p.r);
  };

  const P = mobile ? POSES.mob : POSES.desk;
  let intro = reduced ? 1 : 0,
    target = main.f,
    swap = 1,
    t = 0,
    raf = 0,
    last = performance.now();

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    t += dt;
    if (ready && intro < 1) intro = Math.min(1, intro + dt / 2.6);

    // смена вкуса: соус уходит вверх, затем новый льётся сверху
    if (stage.flavor !== target && swap >= 1) {
      target = stage.flavor;
      swap = 0;
    }
    let cap = 1;
    if (swap < 1) {
      swap = Math.min(1, swap + dt / (reduced ? 0.01 : 1.5));
      if (swap < 0.32) cap = 1 - easeOut(swap / 0.32);
      else {
        if (main.f !== target) {
          setFlavor(main, target);
          extra.forEach((c, i) => setFlavor(c, (target + 1 + i) % 3));
          creamStreamMat.color.set(STREAM.cream[target]);
          sauceStreamMat.color.set(STREAM.sauce[target]);
        }
        cap = (swap - 0.32) / 0.68;
      }
    }
    const fill = easeOut(intro);
    const glaze = Math.min(Math.max(stage.pour, stage.flvIn), cap);
    // пломбир виден ниже уровня, соус — выше
    const level = CREAM_BOTTOM + fill * (1 - CREAM_BOTTOM) + (fill >= 1 ? 0.02 : 0);
    main.cream.u.uHi.value = level;
    main.sauce.u.uLo.value = 1 - glaze * (1 - SAUCE_BOTTOM) - (glaze >= 1 ? 0.02 : 0);

    // струи
    const cs = fill > 0 && fill < 0.985;
    creamStream.visible = cs;
    if (cs) {
      const row = rowAt(level);
      creamStream.position.set((row.cx - 0.5) * K, (level - 0.5) * HW, 0);
      creamStream.scale.set(0.09, 10, 0.09);
    }
    const ss = glaze > 0.01 && glaze < 0.97 && (swap < 1 ? swap > 0.32 : stage.flvIn < 0.02);
    sauceStream.visible = ss;
    if (ss) {
      const tip = rows[2];
      sauceStream.position.set((tip.cx - 0.5) * K + 0.05, (tip.v - 0.5) * HW - 0.05, 0);
      sauceStream.scale.set(0.028, 10, 0.028);
    }

    // поза и поворот: рожок медленно поворачивается туда-обратно, мышь добавляет поворот и наклон
    let p = P.hero;
    p = mix(p, P.pour, ease(stage.openIn));
    p = mix(p, P.flv, ease(stage.flvIn));
    p = mix(p, P.away, ease(stage.away));
    p = mix(p, P.find, ease(stage.buyIn));
    place(main, { ...p, y: p.y + (reduced ? 0 : Math.sin(t * 0.9) * 0.6) }, stage.buyPx);
    ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-4 * dt));
    ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-4 * dt));
    const swing = reduced ? 0 : Math.sin(t * 0.45) * 0.38;
    main.turn.rotation.y = swing + ptr.sx * 0.7;
    main.turn.rotation.x = ptr.sy * 0.25;

    const b = ease(stage.buyIn);
    extra.forEach((c, i) => {
      c.root.visible = b > 0.01;
      const dir = i === 0 ? -1 : 1;
      place(c, { x: p.x + dir * (mobile ? 27 : 13) * b, y: p.y + 3 + (1 - b) * 80, h: p.h * 0.88, r: dir * -9 }, stage.buyPx);
      c.root.position.z = -0.6;
      c.turn.rotation.y = dir * 0.35 + Math.sin(t * 0.4 + i * 2) * 0.3 + ptr.sx * 0.5;
    });

    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("resize", resize);
    renderer.dispose();
  };
}
