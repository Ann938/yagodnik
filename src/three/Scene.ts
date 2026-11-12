// 3D-сцена «Сугроба»: вафельный рожок, в который струёй закручивается мягкий пломбир,
// а сверху его заливает соус с каплями. Всё процедурное: рожок — тело вращения с вафельной
// текстурой на canvas, пломбир — трубка со звёздчатым сечением вдоль конической спирали.
// Рост пломбира и соуса — drawRange по индексам вдоль спирали.
// Хореография приходит через мутабельный `stage` (его пишут ScrollTrigger'ы), React в кадре не участвует.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { flavors } from "@/content";
import { stage } from "./stage";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

type Pose = { x: number; y: number; z: number; s: number; rx: number; rz: number };
const mixPose = (a: Pose, b: Pose, k: number): Pose => ({
  x: lerp(a.x, b.x, k),
  y: lerp(a.y, b.y, k),
  z: lerp(a.z, b.z, k),
  s: lerp(a.s, b.s, k),
  rx: lerp(a.rx, b.rx, k),
  rz: lerp(a.rz, b.rz, k),
});

// позы рожка по разделам: ДВ и МВ отдельно
const POSES = {
  desk: {
    hero: { x: 1.65, y: -0.1, z: 0, s: 0.78, rx: 0.08, rz: -0.1 },
    pour: { x: 1.35, y: -0.45, z: 0.8, s: 0.92, rx: 0.32, rz: 0.04 },
    flv: { x: -1.9, y: -0.1, z: 0, s: 0.8, rx: 0.1, rz: 0.08 },
    away: { x: -1.9, y: 5, z: -1, s: 0.7, rx: 0.3, rz: 0.3 },
    find: { x: 1.65, y: -0.25, z: 0, s: 0.62, rx: 0.1, rz: 0 },
  },
  mob: {
    hero: { x: 0, y: 1.0, z: 0, s: 0.42, rx: 0.08, rz: -0.08 },
    pour: { x: 0, y: 0.75, z: 0.5, s: 0.5, rx: 0.32, rz: 0 },
    flv: { x: 0, y: 1.05, z: 0, s: 0.42, rx: 0.1, rz: 0 },
    away: { x: 0, y: 5.5, z: -1, s: 0.4, rx: 0.3, rz: 0.3 },
    find: { x: 0, y: 1.25, z: 0, s: 0.32, rx: 0.1, rz: 0 },
  },
} satisfies Record<string, Record<string, Pose>>;

// ---------- размеры ----------
const CONE_H = 2.0; // от кончика до края
const CONE_R = 0.78;
const TURNS = 3.25;
const SWIRL_H = 1.3;
const BASE_Y = 0.16; // нижний виток лежит на «шапке» в рожке
const OFFSET_Y = 0.2; // центрируем модель по высоте

// спираль: радиус и высота пути, толщина трубки (к кончику сходит на нет — «хвостик»)
const pathR = (s: number) => 0.6 * Math.pow(1 - s, 0.85);
const pathY = (s: number) => BASE_Y + s * SWIRL_H + Math.pow(s, 6) * 0.12;
const tubeR = (s: number) => (0.06 + 0.25 * Math.pow(1 - s, 0.55)) * (s > 0.96 ? Math.max(0.05, (1 - s) / 0.04) : 1);
const pathPoint = (s: number, out = new THREE.Vector3()) => {
  const a = s * TURNS * Math.PI * 2;
  return out.set(Math.cos(a) * pathR(s), pathY(s), Math.sin(a) * pathR(s));
};

// трубка вдоль спирали; сегменты идут по порядку, поэтому drawRange = «сколько уже налито»
// fFrom..fTo — какая часть сечения строится (соус лежит только сверху витка и стекает по внешней стороне)
function swirlGeometry(s0: number, s1: number, rScale: number, ridge: number, reverse: boolean, fFrom = 0, fTo = Math.PI * 2) {
  const SEG = 360,
    M = 36;
  const pos: number[] = [],
    idx: number[] = [];
  const p = new THREE.Vector3(),
    p2 = new THREE.Vector3(),
    T = new THREE.Vector3(),
    N = new THREE.Vector3(),
    B = new THREE.Vector3(),
    v = new THREE.Vector3(),
    n = new THREE.Vector3();
  for (let i = 0; i <= SEG; i++) {
    const k = i / SEG;
    const s = reverse ? lerp(s1, s0, k) : lerp(s0, s1, k);
    pathPoint(s, p);
    pathPoint(Math.min(1, s + 0.002), p2);
    T.subVectors(p2, p);
    if (T.lengthSq() < 1e-10) T.set(0, 1, 0);
    T.normalize();
    const a = s * TURNS * Math.PI * 2;
    N.set(Math.cos(a), 0, Math.sin(a));
    N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
    B.crossVectors(T, N).normalize();
    const r = tubeR(s) * rScale;
    for (let j = 0; j <= M; j++) {
      const f = fFrom + (j / M) * (fTo - fFrom);
      const rr = r * (1 + ridge * Math.cos(f * 8)); // звёздчатая насадка — рёбра вдоль витка
      n.copy(N).multiplyScalar(Math.cos(f)).addScaledVector(B, Math.sin(f));
      v.copy(p).addScaledVector(n, rr);
      pos.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < SEG; i++)
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j,
        b = a + M + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geo: g, seg: SEG, perSeg: M * 6 };
}

// ---------- вафля ----------
function waffleTexture() {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, "#e2ad66");
  grad.addColorStop(1, "#cf9450");
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // ромбы: тёмные бороздки и светлый край
  const step = S / 4;
  g.lineCap = "round";
  for (const dir of [1, -1]) {
    for (let k = -S; k <= S * 2; k += step) {
      g.strokeStyle = "#9b5d26";
      g.lineWidth = 16;
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + dir * S, S);
      g.stroke();
      g.strokeStyle = "rgba(255,226,170,.45)";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(k + 10, 0);
      g.lineTo(k + 10 + dir * S, S);
      g.stroke();
    }
  }
  // пористость теста
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? "120,70,30" : "255,230,190"},${rnd() * 0.12})`;
    g.fillRect(rnd() * S, rnd() * S, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 3);
  t.anisotropy = 8;
  return t;
}

// ---------- рожок целиком ----------
type ConeModel = {
  root: THREE.Group;
  spin: THREE.Group;
  creamMat: THREE.MeshPhysicalMaterial;
  glazeMat: THREE.MeshPhysicalMaterial;
  swirl: THREE.Mesh;
  glaze: THREE.Mesh;
  head: THREE.Mesh;
  drips: { m: THREE.Mesh; len: number; delay: number }[];
  swirlSeg: number;
  swirlPer: number;
  glazeSeg: number;
  glazePer: number;
};

function makeCone(waffle: THREE.Texture, fi: number): ConeModel {
  const root = new THREE.Group();
  const spin = new THREE.Group();
  spin.position.y = OFFSET_Y;
  root.add(spin);

  // тело рожка: кончик внизу, наверху — скруглённый бортик
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    pts.push(new THREE.Vector2(0.004 + CONE_R * Math.pow(k, 0.95), -CONE_H + k * CONE_H));
  }
  pts.push(new THREE.Vector2(CONE_R + 0.05, 0.02), new THREE.Vector2(CONE_R + 0.07, 0.1), new THREE.Vector2(CONE_R + 0.01, 0.14), new THREE.Vector2(CONE_R - 0.06, 0.1));
  const waffleMat = new THREE.MeshPhysicalMaterial({ map: waffle, bumpMap: waffle, bumpScale: 2.2, roughness: 0.72, color: "#ffffff", sheen: 0.4, sheenColor: new THREE.Color("#ffd9a0") });
  spin.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 72), waffleMat));

  const f = flavors[fi];
  const creamMat = new THREE.MeshPhysicalMaterial({ color: f.cream, roughness: 0.62, sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color("#ffffff") });
  const glazeMat = new THREE.MeshPhysicalMaterial({ color: f.glaze, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide });

  // «шапка» пломбира, на которой лежит нижний виток
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(CONE_R * 0.98, 0.22, CONE_R * 0.98), creamMat);
  cap.position.y = 0.04;
  spin.add(cap);

  const sw = swirlGeometry(0, 1, 1, 0.13, false);
  const swirl = new THREE.Mesh(sw.geo, creamMat);
  spin.add(swirl);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), creamMat);
  spin.add(head);

  // соус: та же спираль, чуть толще и глаже, растёт от макушки вниз
  // сечение: верх витка и внутренняя сторона; внешний бок остаётся пломбирным, по нему бегут капли
  const gl = swirlGeometry(0.3, 1, 1.045, 0.02, true, 0.3, Math.PI * 0.97);
  const glaze = new THREE.Mesh(gl.geo, glazeMat);
  spin.add(glaze);

  // капли: висят с нижней кромки соуса и вытягиваются вниз
  const drips: ConeModel["drips"] = [];
  // капля: у кромки толще, к низу тоньше и с круглой бусиной на конце; высота 1 — растягиваем по y
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const k = i / 20; // 0 — верх, 1 — низ
    const r = k < 0.78 ? 0.06 - 0.028 * k : 0.032 + Math.sin(((k - 0.78) / 0.22) * Math.PI) * 0.026;
    prof.push(new THREE.Vector2(k === 1 ? 0.0005 : r, -k));
  }
  prof.reverse();
  const dripGeo = new THREE.LatheGeometry(prof, 16);
  const pp = new THREE.Vector3();
  for (let i = 0; i < 9; i++) {
    const s = 0.3 + (i / 9) * 0.3; // по нижнему витку соуса
    pathPoint(s, pp);
    const a = s * TURNS * Math.PI * 2;
    const r = tubeR(s) * 1.05;
    const m = new THREE.Mesh(dripGeo, glazeMat);
    // на внешней стороне нижнего витка соуса, чуть ниже середины
    m.position.set(pp.x + Math.cos(a) * r * 0.8, pp.y + r * 0.45, pp.z + Math.sin(a) * r * 0.8);
    m.scale.set(1, 0.001, 1);
    spin.add(m);
    drips.push({ m, len: 0.22 + (((i * 53) % 7) / 7) * 0.38, delay: (((i * 31) % 9) / 9) * 0.35 });
  }
  return { root, spin, creamMat, glazeMat, swirl, glaze, head, drips, swirlSeg: sw.seg, swirlPer: sw.perSeg, glazeSeg: gl.seg, glazePer: gl.perSeg };
}

// сколько налито: пломбир 0..1, соус 0..1
function setFill(c: ConeModel, cream: number, glaze: number) {
  const s = clamp(cream);
  const n = Math.round(s * c.swirlSeg);
  c.swirl.geometry.setDrawRange(0, n * c.swirlPer);
  c.swirl.visible = n > 0;
  // голова струи закрывает открытый торец трубки, пока пломбир льётся
  c.head.position.copy(pathPoint(s));
  c.head.scale.setScalar(tubeR(s));
  c.head.visible = s > 0.001 && s < 0.97;

  const g = clamp(glaze);
  const gn = Math.round(easeOut(g) * c.glazeSeg);
  c.glaze.geometry.setDrawRange(0, gn * c.glazePer);
  c.glaze.visible = gn > 0;
  for (const d of c.drips) {
    const k = clamp((g - 0.55 - d.delay * 0.4) / 0.45);
    d.m.visible = k > 0.01;
    d.m.scale.set(1, Math.max(0.001, easeOut(k) * d.len), 1);
  }
}

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

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 7.5);
  const key = new THREE.DirectionalLight("#fff3e6", 1.8);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#ffffff", 1.1);
  rim.position.set(-4, 3, -3);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight("#ffffff", "#e8cfc6", 0.45));

  const waffle = waffleTexture();
  const main = makeCone(waffle, stage.flavor);
  scene.add(main.root);
  // ещё два рожка для финала — с другими вкусами, сразу полные
  const extra = [makeCone(waffle, 1), makeCone(waffle, 2)];
  extra.forEach((c) => {
    setFill(c, 1, 1);
    c.root.visible = false;
    scene.add(c.root);
  });

  // струи сверху: пломбир из аппарата, потом соус
  const streamGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0);
  const creamStream = new THREE.Mesh(streamGeo, main.creamMat);
  const glazeStream = new THREE.Mesh(streamGeo, main.glazeMat);
  main.spin.add(creamStream, glazeStream);

  // ----- состояние наливания -----
  let intro = reduced ? 1 : 0; // пломбир при загрузке
  let fl = stage.flavor;
  let target = fl;
  let swap = 1; // смена вкуса: соус уходит, пломбир перекрашивается, соус льётся заново
  const creamFrom = new THREE.Color(),
    creamTo = new THREE.Color();
  const extraColors = (fi: number) =>
    extra.forEach((c, i) => {
      const f = flavors[(fi + 1 + i) % 3];
      c.creamMat.color.set(f.cream);
      c.glazeMat.color.set(f.glaze);
    });
  extraColors(fl);

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
  let lastW = 0;
  const onResize = () => {
    if (mobile && canvas.clientWidth === lastW) return; // МВ: адресная строка меняет только высоту
    lastW = canvas.clientWidth;
    resize();
  };
  resize();
  lastW = canvas.clientWidth;
  window.addEventListener("resize", onResize);

  const P = mobile ? POSES.mob : POSES.desk;
  const clock = new THREE.Clock();
  let time = 0,
    raf = 0,
    visible = true,
    ready = false,
    turn = 0;
  const tmp = new THREE.Vector3();

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    // наливание считаем по реальному времени: на слабом устройстве оно не растягивается
    const rdt = Math.min(raw, 0.5);
    time += dt;

    // пломбир наливается при загрузке
    if (ready && intro < 1) intro = Math.min(1, intro + rdt / 2.4);

    // смена вкуса
    if (stage.flavor !== target && swap >= 1) {
      target = stage.flavor;
      swap = 0;
      creamFrom.copy(main.creamMat.color);
      creamTo.set(flavors[target].cream);
    }
    let glazeOverride = 1;
    if (swap < 1) {
      swap = Math.min(1, swap + rdt / (reduced ? 0.01 : 1.3));
      main.creamMat.color.copy(creamFrom).lerp(creamTo, ease(clamp(swap / 0.45)));
      if (swap < 0.35) glazeOverride = 1 - swap / 0.35;
      else {
        if (fl !== target) {
          fl = target;
          main.glazeMat.color.set(flavors[target].glaze);
          extraColors(target);
        }
        glazeOverride = (swap - 0.35) / 0.65;
      }
    }

    // соус: в блоке «Заливаем» — по скроллу; дальше остаётся налитым
    const pourK = clamp(stage.pour);
    const glazeBase = Math.max(pourK, stage.flvIn);
    const glazeK = Math.min(glazeBase, glazeOverride);
    setFill(main, easeOut(intro), glazeK);

    // струи: строго вертикальные над точкой, куда льётся
    const cs = intro > 0 && intro < 1;
    creamStream.visible = cs;
    if (cs) {
      pathPoint(easeOut(intro), tmp);
      creamStream.position.copy(tmp);
      creamStream.scale.set(0.1, 8, 0.1);
    }
    const pouringGlaze = glazeK > 0.01 && glazeK < 0.97 && (swap < 1 ? swap > 0.35 : stage.flvIn < 0.02);
    glazeStream.visible = pouringGlaze;
    if (pouringGlaze) {
      pathPoint(1, tmp);
      glazeStream.position.set(tmp.x, tmp.y + 0.04, tmp.z);
      glazeStream.scale.set(0.045, 8, 0.045);
    }

    // поза по разделам
    let pose = P.hero;
    pose = mixPose(pose, P.pour, ease(stage.openIn));
    pose = mixPose(pose, P.flv, ease(stage.flvIn));
    pose = mixPose(pose, P.away, ease(stage.away));
    pose = mixPose(pose, P.find, ease(stage.buyIn));
    // в финале рожки прокручиваются вместе с блоком: пиксели → единицы сцены на глубине z=0
    const worldPerPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z) / canvas.clientHeight;
    pose = { ...pose, y: pose.y + stage.buyPx * worldPerPx };

    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-3 * dt));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-3 * dt));
    const float = reduced ? 0 : Math.sin(time * 0.9) * 0.05;
    main.root.position.set(pose.x, pose.y + float, pose.z);
    main.root.scale.setScalar(pose.s);
    main.root.rotation.set(pose.rx + pointer.sy * 0.1, 0, pose.rz - pointer.sx * 0.05);
    // рожок медленно вращается, как на витрине
    if (!reduced) turn += dt * 0.32;
    main.spin.rotation.y = turn + pointer.sx * 0.4;

    const b = ease(stage.buyIn);
    extra.forEach((c, i) => {
      c.root.visible = b > 0.01;
      const dir = i === 0 ? -1 : 1;
      const spread = mobile ? 0.85 : 1.25;
      c.root.position.set(pose.x + dir * spread * b, pose.y - 0.12 + (1 - b) * -4, pose.z - 0.6);
      c.root.scale.setScalar(pose.s * 0.9);
      c.root.rotation.set(pose.rx, 0, dir * -0.12);
      c.spin.rotation.y = turn * 0.8 + i * 2;
    });

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

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVis);
    renderer.dispose();
    pmrem.dispose();
  };
}
