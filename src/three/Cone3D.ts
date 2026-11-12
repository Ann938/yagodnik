// Рожок в 3D из фото. Форма — тело вращения по контуру снимка (profile.json: центр и полуширина
// каждой строки), фото натянуто проекцией спереди; задняя сторона получает зеркальную копию передней —
// рожок и пломбир почти круглые, поэтому при повороте это незаметно.
// Слои те же, что на фото: вафля, пломбир (свой на вкус), соус.
// Налив как в настоящем аппарате: рожок вращается под неподвижной струёй, пломбир ложится спиралью
// виток за витком (в шейдере: видно то, над чем струя уже прошла). Соус стекает сверху неровно — у каждой
// струйки свой темп, край мягкий. При смене вкуса старый соус тает, пломбир плавно перекрашивается, новый соус льётся.
import * as THREE from "three";
import { stage } from "./stage";
import profile from "./profile.json";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const IDS = ["strawberry", "raspberry", "blackberry"] as const;
const HW = 3.2; // высота модели в единицах сцены
const K = (profile.w / profile.h) * HW; // доля ширины картинки → единицы
const CREAM_BOTTOM = 0.48; // v кромки рожка (снизу 0, сверху 1)
const SAUCE_BOTTOM = 0.4; // v кончиков капель
const TURNS = 5; // витков при наливе; целое число — в конце рожок снова смотрит лицом
const PITCH = (1 - CREAM_BOTTOM) / TURNS;
const PHI_MAX = TURNS * Math.PI * 2;
const STREAM = {
  cream: ["#fbf0e6", "#f9e6ea", "#f6f0f4"],
  sauce: ["#b81428", "#9b0f3b", "#2f0a3a"],
};

type Pose = { x: number; y: number; h: number; r: number }; // как в вёрстке: центр в vw/vh, высота в vh, наклон в градусах
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const mix = (a: Pose, b: Pose, k: number): Pose => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), h: lerp(a.h, b.h, k), r: lerp(a.r, b.r, k) });
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

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
    th: number[] = [],
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
      th.push(a);
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
  g.setAttribute("aTheta", new THREE.Float32BufferAttribute(th, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

type Mode = "cone" | "cream" | "sauce";
// материал-фото без освещения (свет уже «в снимке»); режим задаёт, как слой наливается
function photoMat(map: THREE.Texture, mode: Mode) {
  const m = new THREE.MeshBasicMaterial({
    map,
    alphaTest: mode === "sauce" ? 0.02 : 0.35,
    transparent: mode !== "cone",
    side: mode === "cone" ? THREE.DoubleSide : THREE.FrontSide,
  });
  const u = {
    uPhi: { value: PHI_MAX }, // сколько струя уже прошла по кругу
    uLo: { value: 0 }, // соус: виден выше этого v
    uOpacity: { value: 1 },
  };
  // у слоёв разный код шейдера при одинаковом тексте функции — без своего ключа three склеит программы
  m.customProgramCacheKey = () => `photo-${mode}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("void main() {", "attribute float aTheta;\nvarying float vTheta;\nvoid main() {\n  vTheta = aTheta;")
    let frag = `
      if (!gl_FrontFacing) diffuseColor.rgb *= 0.5;`;
    if (mode === "cream")
      frag = `
      {
        // последний проход струи над этим углом и высота, до которой там уже налито
        float d = mod(uPhi - vTheta, 6.2831853);
        float h = ${CREAM_BOTTOM.toFixed(4)} + ${PITCH.toFixed(5)} * (uPhi - d) / 6.2831853;
        if (vMapUv.y > h + ${(PITCH * 1.02).toFixed(5)}) discard;
      }`;
    if (mode === "sauce")
      frag = `
      {
        // у каждой струйки свой темп: неровный фронт по горизонтали
        float n = sin(vMapUv.x * 83.0) * 0.012 + sin(vMapUv.x * 31.0 + 1.7) * 0.02 + sin(vMapUv.x * 13.0 + 0.4) * 0.015;
        float lo = uLo + n;
        if (vMapUv.y < lo) discard;
        diffuseColor.a *= smoothstep(lo, lo + 0.018, vMapUv.y) * uOpacity;
      }`;
    sh.fragmentShader = sh.fragmentShader
      .replace("void main() {", "uniform float uPhi;\nuniform float uLo;\nuniform float uOpacity;\nvarying float vTheta;\nvoid main() {")
      .replace("#include <map_fragment>", "#include <map_fragment>" + frag);
  };
  return { m, u };
}

// струя с рёбрами, как из звёздчатой насадки
function streamGeometry(ribs: number, depth: number) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 64, 1, true).translate(0, 0.5, 0);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + depth * Math.cos(a * ribs);
    p.setXYZ(i, x * k, p.getY(i), z * k);
  }
  g.computeVertexNormals();
  return g;
}

type Cone = {
  root: THREE.Group;
  turn: THREE.Group;
  cream: ReturnType<typeof photoMat>;
  creamNext: ReturnType<typeof photoMat>;
  creamNextMesh: THREE.Mesh;
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
  scene.add(new THREE.HemisphereLight("#ffffff", "#d9b8a8", 1.4));
  const key = new THREE.DirectionalLight("#ffffff", 1.6);
  key.position.set(-2, 3, 5);
  scene.add(key);

  const loader = new THREE.TextureLoader();
  const tex = (name: string) => {
    const t = loader.load(`${BASE}/cone/${name}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const waffle = tex("cone");
  const creams = IDS.map((id) => tex(`cream-${id}`));
  const sauces = IDS.map((id) => tex(`sauce-${id}`));

  const geoCone = bodyGeometry(1);
  const geoCream = bodyGeometry(1.004);
  const geoCream2 = bodyGeometry(1.007);
  const geoSauce = bodyGeometry(1.012);

  function makeCone(fi: number): Cone {
    const root = new THREE.Group();
    const turn = new THREE.Group();
    root.add(turn);
    turn.add(new THREE.Mesh(geoCone, photoMat(waffle, "cone").m));
    const cream = photoMat(creams[fi], "cream");
    const creamNext = photoMat(creams[fi], "cone"); // для плавной перекраски при смене вкуса
    creamNext.m.side = THREE.FrontSide;
    creamNext.m.transparent = true;
    creamNext.m.opacity = 0;
    const creamNextMesh = new THREE.Mesh(geoCream2, creamNext.m);
    creamNextMesh.visible = false;
    const sauce = photoMat(sauces[fi], "sauce");
    const sauceMesh = new THREE.Mesh(geoSauce, sauce.m);
    sauceMesh.renderOrder = 2;
    creamNextMesh.renderOrder = 1;
    turn.add(new THREE.Mesh(geoCream, cream.m), creamNextMesh, sauceMesh);
    scene.add(root);
    return { root, turn, cream, creamNext, creamNextMesh, sauce, f: fi };
  }

  const main = makeCone(stage.flavor);
  const extra = [makeCone((stage.flavor + 1) % 3), makeCone((stage.flavor + 2) % 3)];
  extra.forEach((c) => (c.sauce.u.uLo.value = SAUCE_BOTTOM - 0.06));

  // струи: пломбир из аппарата (с рёбрами) и тонкий соус на макушку — не вращаются вместе с рожком
  // струи светятся изнутри собственным цветом — иначе на светлом фоне они кажутся серыми
  const creamStreamMat = new THREE.MeshStandardMaterial({ color: STREAM.cream[main.f], emissive: STREAM.cream[main.f], emissiveIntensity: 0.55, roughness: 0.6 });
  const sauceStreamMat = new THREE.MeshStandardMaterial({ color: STREAM.sauce[main.f], emissive: STREAM.sauce[main.f], emissiveIntensity: 0.35, roughness: 0.12 });
  const creamStream = new THREE.Mesh(streamGeometry(8, 0.14), creamStreamMat);
  const sauceStream = new THREE.Mesh(streamGeometry(1, 0), sauceStreamMat);
  main.root.add(creamStream, sauceStream);

  let ready = false;
  const need = [waffle, creams[main.f], sauces[main.f]];
  const check = () => {
    if (need.every((t) => t.image && (t.image as HTMLImageElement).complete)) {
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
    if (ready && intro < 1) intro = Math.min(1, intro + dt / 3.6);

    // ---- пломбир: струя неподвижна, рожок крутится, витки ложатся снизу вверх
    const phi = easeInOut(intro) * PHI_MAX;
    main.cream.u.uPhi.value = phi;

    // ---- смена вкуса: старый соус тает, пломбир перетекает в новый цвет, новый соус льётся сверху
    if (stage.flavor !== target && swap >= 1) {
      target = stage.flavor;
      swap = 0;
      main.creamNext.m.map = creams[target];
      main.creamNextMesh.visible = true;
    }
    let cap = 1,
      sauceOpacity = 1;
    if (swap < 1) {
      swap = Math.min(1, swap + dt / (reduced ? 0.01 : 1.6));
      const a = Math.min(1, swap / 0.3);
      sauceOpacity = 1 - a;
      main.creamNext.m.opacity = a;
      if (swap >= 0.3) {
        if (main.f !== target) {
          main.f = target;
          main.cream.m.map = creams[target];
          main.sauce.m.map = sauces[target];
          main.creamNextMesh.visible = false;
          main.creamNext.m.opacity = 0;
          extra.forEach((c, i) => {
            const fi = (target + 1 + i) % 3;
            c.f = fi;
            c.cream.m.map = creams[fi];
            c.sauce.m.map = sauces[fi];
          });
          creamStreamMat.color.set(STREAM.cream[target]);
          creamStreamMat.emissive.set(STREAM.cream[target]);
          sauceStreamMat.color.set(STREAM.sauce[target]);
          sauceStreamMat.emissive.set(STREAM.sauce[target]);
        }
        sauceOpacity = 1;
        cap = (swap - 0.3) / 0.7;
      }
    }
    // соус: в блоке «Заливаем» по скроллу, дальше остаётся налитым
    const glaze = Math.min(Math.max(stage.pour, stage.flvIn), cap);
    main.sauce.u.uLo.value = 1.02 - glaze * (1.08 - SAUCE_BOTTOM);
    main.sauce.u.uOpacity.value = sauceOpacity;

    // ---- струи
    const pouringCream = intro > 0.002 && intro < 0.995;
    creamStream.visible = pouringCream;
    if (pouringCream) {
      // точка, куда сейчас ложится пломбир: спереди, на высоте текущего витка
      const hv = Math.min(0.995, CREAM_BOTTOM + (PITCH * phi) / (Math.PI * 2) + PITCH * 0.6);
      const row = rowAt(hv);
      const w = 0.075 + Math.sin(t * 23) * 0.003;
      creamStream.position.set((row.cx - 0.5) * K, (hv - 0.5) * HW, row.r * K * 0.55);
      creamStream.scale.set(w, 12, w);
      creamStream.rotation.y = t * 2;
    }
    const pouringSauce = glaze > 0.01 && glaze < 0.96 && (swap < 1 ? swap > 0.3 : stage.flvIn < 0.02);
    sauceStream.visible = pouringSauce;
    if (pouringSauce) {
      const tip = rows[2];
      sauceStream.position.set((tip.cx - 0.5) * K + 0.04 + Math.sin(t * 9) * 0.004, (tip.v - 0.5) * HW - 0.06, 0.02);
      sauceStream.scale.set(0.024, 12, 0.024);
    }

    // ---- поза: после налива рожок мягко покачивается, мышь добавляет поворот и наклон
    let p = P.hero;
    p = mix(p, P.pour, ease(stage.openIn));
    p = mix(p, P.flv, ease(stage.flvIn));
    p = mix(p, P.away, ease(stage.away));
    p = mix(p, P.find, ease(stage.buyIn));
    place(main, { ...p, y: p.y + (reduced ? 0 : Math.sin(t * 0.9) * 0.6) }, stage.buyPx);
    ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-4 * dt));
    ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-4 * dt));
    const settled = Math.min(1, Math.max(0, (intro - 0.9) / 0.1));
    const swing = reduced ? 0 : Math.sin(t * 0.45) * 0.38 * settled;
    main.turn.rotation.y = -phi + swing + ptr.sx * 0.7 * settled;
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
