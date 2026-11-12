"use client";

import { useEffect, useRef, useState } from "react";
import s from "./product.module.scss";

// Рожок в 3D из фото (src/three/Cone3D.ts). three грузится отдельным чанком, чтобы не тормозить первый экран.
export default function Product() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let dead = false;
    import("@/three/Cone3D").then(({ createCones }) => {
      if (dead || !canvas.current) return;
      dispose = createCones(canvas.current, () => setReady(true));
    });
    return () => {
      dead = true;
      dispose?.();
    };
  }, []);

  return <canvas ref={canvas} className={s.canvas} data-ready={ready || undefined} aria-hidden />;
}
