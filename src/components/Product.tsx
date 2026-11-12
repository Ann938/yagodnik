"use client";

import { useEffect, useRef, useState } from "react";
import s from "./product.module.scss";

// Рожок с наливом из видео (src/three/Pour.ts). Код грузится отдельным чанком, чтобы не тормозить первый экран.
export default function Product() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let dead = false;
    import("@/three/Pour").then(({ createPour }) => {
      if (dead || !canvas.current) return;
      dispose = createPour(canvas.current, () => setReady(true));
    });
    return () => {
      dead = true;
      dispose?.();
    };
  }, []);

  return <canvas ref={canvas} className={s.canvas} data-ready={ready || undefined} aria-hidden />;
}
