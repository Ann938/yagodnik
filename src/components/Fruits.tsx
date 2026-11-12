"use client";

import { useEffect, useRef } from "react";
import { flavors } from "@/content";
import s from "./fruits.module.scss";

// Настоящие ягоды (фото с вырезанным фоном) вокруг рожка, в два слоя:
// дальний — за 3D-сценой, ближний — перед ней, крупный и размытый, как в макросъёмке.
// Наборы всех вкусов лежат в DOM, видимый переключается атрибутом data-on.

// x, y — центр в % экрана; w — ширина в vw (на МВ — mw); r — поворот; d — глубина (параллакс, размытие)
type Slot = { x: number; y: number; w: number; r: number; d: number; mx: number; my: number; mw: number; front?: boolean };
// ДВ: слева текст (до ~55% ширины) — ягоды держим справа и по краям; в блоке вкусов раскладка зеркалится (рожок слева)
const SLOTS: Slot[] = [
  { x: 61, y: 15, w: 7, r: -18, d: 0.7, mx: 12, my: 9, mw: 22 },
  { x: 90, y: 24, w: 11, r: 14, d: 1.0, mx: 86, my: 7, mw: 26 },
  { x: 92, y: 66, w: 12, r: -12, d: 1.1, mx: 92, my: 44, mw: 24 },
  { x: 62, y: 86, w: 9, r: 28, d: 0.8, mx: 8, my: 44, mw: 20 },
  { x: 57, y: 44, w: 5, r: 40, d: 0.45, mx: 70, my: 2, mw: 14 },
  { x: 99, y: 97, w: 16, r: -24, d: 1.7, mx: -6, my: 30, mw: 34, front: true },
  { x: 80, y: -7, w: 17, r: 10, d: 1.8, mx: 104, my: 26, mw: 36, front: true },
];

export default function Fruits({ flavor, layer }: { flavor: number; layer: "back" | "front" }) {
  const root = useRef<HTMLDivElement>(null);

  // параллакс: ближние сильнее реагируют на скролл и курсор
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const st = { mx: 0, my: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      st.tx = e.clientX / window.innerWidth - 0.5;
      st.ty = e.clientY / window.innerHeight - 0.5;
    };
    const tick = () => {
      st.mx += (st.tx - st.mx) * 0.06;
      st.my += (st.ty - st.my) * 0.06;
      const sc = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      el.style.setProperty("--px", st.mx.toFixed(4));
      el.style.setProperty("--py", st.my.toFixed(4));
      el.style.setProperty("--sc", sc.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={root} className={s.layer} data-layer={layer} aria-hidden>
      {flavors.map((f, fi) =>
        SLOTS.map((slot, i) => {
          if (!!slot.front !== (layer === "front")) return null;
          const pic = f.fruits[i % f.fruits.length];
          return (
            <div
              key={`${f.id}-${i}`}
              className={s.fruit}
              data-on={fi === flavor || undefined}
              data-soft={slot.d < 0.6 || undefined}
              style={
                {
                  "--x": slot.x,
                  "--y": slot.y,
                  "--w": slot.w,
                  "--mx": slot.mx,
                  "--my": slot.my,
                  "--mw": slot.mw,
                  "--r": `${slot.r}deg`,
                  "--d": slot.d,
                  "--i": i,
                  "--ar": pic.h / pic.w,
                } as React.CSSProperties
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/${pic.src}`} alt="" loading={fi === 0 ? "eager" : "lazy"} decoding="async" />
            </div>
          );
        }),
      )}
    </div>
  );
}
