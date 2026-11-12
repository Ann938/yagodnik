"use client";

import { useEffect, useRef, useState } from "react";
import { flavors } from "@/content";
import s from "./preloader.module.scss";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
// что нужно первому экрану: слои рожка текущего вкуса и фото ягод вокруг
const FIRST = [
  "cone/full-strawberry.webp",
  ...Array.from(new Set(flavors[0].fruits.map((f) => f.src))),
];

// знак бренда — ягода, которая едет по линии загрузки
const DRUPES = [[12, 13.2], [16, 12.6], [20, 13.2], [10, 17.2], [14, 16.8], [18, 16.8], [22, 17.2], [12, 21], [16, 20.8], [20, 21], [14, 24.6], [18, 24.6], [16, 28]];
function Berry() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <g fill="var(--accent)">
        {DRUPES.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.45" />
        ))}
      </g>
      <g fill="#fff" opacity=".55">
        {DRUPES.map(([x, y], i) => (
          <circle key={i} cx={x - 0.8} cy={y - 0.8} r="0.7" />
        ))}
      </g>
      <path d="M16 10.2C14.8 6.6 11.8 5 8.4 5.6c.6 3.6 3.6 5.2 7.6 4.6z" fill="#4f8f3a" />
      <path d="M16 10.2c1.2-3.8 4.3-5.4 7.8-4.7-.7 3.7-3.8 5.4-7.8 4.7z" fill="#6fae4f" />
    </svg>
  );
}

// Экран загрузки: линия с ягодкой, пока грузятся картинки первого экрана и 3D-рожок.
// Рожок сообщает о готовности событием `yg:ready` (Product.tsx). Страховка — 9 секунд.
export default function Preloader() {
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let loaded = 0;
    let coneReady = false;
    let shown = 0;
    let raf = 0;
    const total = FIRST.length + 2; // + шрифты + рожок
    const start = performance.now();
    const step = () => loaded++;
    FIRST.forEach((src) => {
      const im = new Image();
      im.onload = im.onerror = step;
      im.src = `${BASE}/${src}`;
    });
    document.fonts?.ready.then(step);
    const onReady = () => {
      if (!coneReady) {
        coneReady = true;
        step();
      }
    };
    window.addEventListener("yg:ready", onReady);
    if ((window as unknown as { __ygReady?: boolean }).__ygReady) onReady();
    document.documentElement.style.overflow = "hidden";

    const tick = (now: number) => {
      const target = Math.min(1, loaded / total);
      // плавно догоняем реальный прогресс; не дольше 9 с на всякий случай
      shown += (target - shown) * 0.12;
      const timeout = now - start > 9000;
      bar.current?.style.setProperty("--p", (timeout ? 1 : shown).toFixed(4));
      if ((target >= 1 && shown > 0.985 && now - start > 700) || timeout) {
        bar.current?.style.setProperty("--p", "1");
        setDone(true);
        document.documentElement.style.overflow = "";
        window.setTimeout(() => setGone(true), 900);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("yg:ready", onReady);
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (gone) return null;
  return (
    <div className={s.pre} data-done={done || undefined} aria-hidden>
      <div className={s.brand}>
        <span className={s.mark}>
          <Berry />
        </span>
        Ягодник
      </div>
      <div className={s.track} ref={bar}>
        <i className={s.fill} />
        <span className={s.rider}>
          <Berry />
        </span>
      </div>
    </div>
  );
}
