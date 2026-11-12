"use client";

import { useEffect, useRef } from "react";
import { flavors } from "@/content";
import { stage } from "@/three/stage";
import s from "./product.module.scss";

// Рожок из настоящего фото, разобранного на слои: вафля, пломбир (свой цвет на каждый вкус), соус.
// Налив — маски: пломбир поднимается из рожка снизу вверх под струёй, соус стекает сверху вниз.
// Поза по разделам и налив считаются в rAF по `stage` (его пишут ScrollTrigger'ы) и уходят в CSS-переменные.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
// геометрия слоёв в долях высоты картинки (520×1462)
export const ASPECT = 520 / 1462;
const CREAM_BOTTOM = 0.52; // кромка рожка
const SAUCE_BOTTOM = 0.6; // кончики капель

type Pose = { x: number; y: number; h: number; r: number }; // центр в vw/vh, высота в vh, поворот в градусах
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const mix = (a: Pose, b: Pose, k: number): Pose => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), h: lerp(a.h, b.h, k), r: lerp(a.r, b.r, k) });
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const POSES: Record<"desk" | "mob", Record<string, Pose>> = {
  desk: {
    hero: { x: 71, y: 53, h: 86, r: -7 },
    pour: { x: 67, y: 74, h: 128, r: 3 }, // крупно: соус стекает по виткам
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

function Cone({ fixedFlavor, refEl }: { fixedFlavor?: number; refEl?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={refEl} className={s.cone} data-f={fixedFlavor ?? 0} aria-hidden>
      <div className={s.tilt}>
        <i className={s.creamStream} />
        <i className={s.sauceStream} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.waffle} src={`${BASE}/cone/cone.webp`} alt="" />
        <div className={s.cream}>
          {flavors.map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f.id} data-i={i} src={`${BASE}/cone/cream-${f.id}.webp`} alt="" />
          ))}
        </div>
        <div className={s.sauce}>
          {flavors.map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f.id} data-i={i} src={`${BASE}/cone/sauce-${f.id}.webp`} alt="" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Product({ onReady }: { onReady?: () => void }) {
  const main = useRef<HTMLDivElement>(null);
  const ex1 = useRef<HTMLDivElement>(null);
  const ex2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = main.current!;
    const extras = [ex1.current!, ex2.current!];
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const P = mobile ? POSES.mob : POSES.desk;

    // ждём картинки, потом начинаем наливать
    const imgs = [...el.querySelectorAll("img")].filter((i) => i.classList.contains(s.waffle) || i.dataset.i === String(stage.flavor));
    let ready = false;
    Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => {})))).then(() => {
      ready = true;
      el.dataset.ready = "";
      onReady?.();
    });

    let intro = reduced ? 1 : 0;
    let shown = stage.flavor,
      target = shown,
      swap = 1;
    const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
    const onMove = (e: PointerEvent) => {
      ptr.x = e.clientX / window.innerWidth - 0.5;
      ptr.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let last = performance.now(),
      raf = 0,
      t = 0;
    const put = (node: HTMLElement, p: Pose, extra = 0) => {
      node.style.setProperty("--cx", `${p.x}vw`);
      node.style.setProperty("--cy", `calc(${p.y}svh - ${extra}px)`);
      node.style.setProperty("--ch", `${p.h}svh`);
      node.style.setProperty("--cr", `${p.r}deg`);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      t += dt;
      if (ready && intro < 1) intro = Math.min(1, intro + dt / 2.6);

      // смена вкуса: соус стекает обратно вверх, пломбир перекрашивается, новый соус льётся сверху
      if (stage.flavor !== target && swap >= 1) {
        target = stage.flavor;
        swap = 0;
      }
      let glazeCap = 1;
      if (swap < 1) {
        swap = Math.min(1, swap + dt / (reduced ? 0.01 : 1.5));
        if (swap < 0.32) glazeCap = 1 - easeOut(swap / 0.32);
        else {
          if (shown !== target) {
            shown = target;
            el.dataset.f = String(shown);
            extras.forEach((x, i) => (x.dataset.f = String((shown + 1 + i) % 3)));
          }
          glazeCap = (swap - 0.32) / 0.68;
        }
      }
      const fill = easeOut(intro);
      // соус: в блоке «Заливаем» по скроллу, дальше остаётся
      const glaze = Math.min(Math.max(stage.pour, stage.flvIn), glazeCap);
      el.style.setProperty("--fill", fill.toFixed(4));
      el.style.setProperty("--glaze", glaze.toFixed(4));
      // струи видны, пока льётся
      el.style.setProperty("--cs", fill > 0 && fill < 0.985 ? "1" : "0");
      const pouringSauce = glaze > 0.01 && glaze < 0.97 && (swap < 1 ? swap > 0.32 : stage.flvIn < 0.02);
      el.style.setProperty("--ss", pouringSauce ? "1" : "0");

      let p = P.hero;
      p = mix(p, P.pour, ease(stage.openIn));
      p = mix(p, P.flv, ease(stage.flvIn));
      p = mix(p, P.away, ease(stage.away));
      p = mix(p, P.find, ease(stage.buyIn));
      const bob = reduced ? 0 : Math.sin(t * 0.9) * 0.6;
      put(el, { ...p, y: p.y + bob }, stage.buyPx);

      ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-4 * dt));
      ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-4 * dt));
      el.style.setProperty("--tx", ptr.sx.toFixed(4));
      el.style.setProperty("--ty", ptr.sy.toFixed(4));

      // финал: два рожка других вкусов выезжают снизу по бокам
      const b = ease(stage.buyIn);
      extras.forEach((x, i) => {
        const dir = i === 0 ? -1 : 1;
        const spread = mobile ? 27 : 13;
        put(x, { x: p.x + dir * spread * b, y: p.y + 3 + (1 - b) * 80, h: p.h * 0.88, r: dir * -9 }, stage.buyPx);
        x.style.opacity = b > 0.01 ? "1" : "0";
        x.style.setProperty("--tx", (ptr.sx * 0.6).toFixed(4));
        x.style.setProperty("--ty", (ptr.sy * 0.6).toFixed(4));
      });
    };
    raf = requestAnimationFrame(tick);
    extras.forEach((x, i) => {
      x.dataset.f = String((shown + 1 + i) % 3);
      x.style.setProperty("--fill", "1");
      x.style.setProperty("--glaze", "1");
    });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [onReady]);

  return (
    <div className={s.stage} style={{ ["--ar" as string]: ASPECT, ["--cb" as string]: CREAM_BOTTOM, ["--sb" as string]: SAUCE_BOTTOM }}>
      <Cone refEl={ex1} fixedFlavor={1} />
      <Cone refEl={ex2} fixedFlavor={2} />
      <Cone refEl={main} />
    </div>
  );
}
