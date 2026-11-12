"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { find } from "@/content";
import { cities, type CityMap } from "./cityMaps";
import { mapStyle, recolor, type Palette } from "./mapStyle";
import s from "./find.module.scss";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

// знак «Ягодника» для меток на карте (тот же, что в шапке: ягода из зёрнышек и два листика), 32×32
const DRUPES = [[12, 13.2], [16, 12.6], [20, 13.2], [10, 17.2], [14, 16.8], [18, 16.8], [22, 17.2], [12, 21], [16, 20.8], [20, 21], [14, 24.6], [18, 24.6], [16, 28]];
const MARK =
  `<svg viewBox="4 3 24 28" aria-hidden="true">` +
  `<g fill="var(--accent)">${DRUPES.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.45"/>`).join("")}</g>` +
  `<g fill="#fff" opacity=".55">${DRUPES.map(([x, y]) => `<circle cx="${x - 0.8}" cy="${y - 0.8}" r="0.7"/>`).join("")}</g>` +
  `<path d="M16 10.2C14.8 6.6 11.8 5 8.4 5.6c.6 3.6 3.6 5.2 7.6 4.6z" fill="#4f8f3a"/>` +
  `<path d="M16 10.2c1.2-3.8 4.3-5.4 7.8-4.7-.7 3.7-3.8 5.4-7.8 4.7z" fill="#6fae4f"/></svg>`;

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 9h11M10 4.5 14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// внешние карты: метка и строка списка → Яндекс Карты с этим местом; кнопка и клик по карте → 2ГИС по городу
const yandex = (place: string, city: string) => `https://yandex.ru/maps/?text=${encodeURIComponent(`${place}, ${city}`)}`;
const gis = (slug: string) => `https://2gis.ru/${slug}/search/${encodeURIComponent("мороженое")}`;

const palette = (): Palette => {
  const cs = getComputedStyle(document.documentElement);
  const g = (k: string, d: string) => cs.getPropertyValue(k).trim() || d;
  return { bg: g("--bg", "#fbe3dc"), bg2: g("--bg2", "#f6c3b9"), ink: g("--ink", "#4a0d18"), accent: g("--accent", "#d8283f") };
};

// Блок «Киоски»: заголовок и переключатель городов сверху, ниже — настоящая карта (OpenStreetMap) в рамке, белая панель со списком.
// Карта грузится, только когда блок близко к экрану; страницу колесо не перехватывает (масштаб — Ctrl + колесо или кнопки).
export default function Find() {
  const [ci, setCi] = useState(0);
  const [hot, setHot] = useState<number | null>(null);
  const city = cities[ci];
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const cityRef = useRef(city);
  useEffect(() => {
    cityRef.current = city;
  }, [city]);
  const [ready, setReady] = useState(false);
  const [mapTick, setMapTick] = useState(0);

  // кадр города: все киоски в поле зрения, на ДВ — правее белой панели
  const frameCity = (m: MLMap, c: CityMap, animate: boolean) => {
    const desk = window.matchMedia("(min-width: 1024px)").matches;
    const lng = c.kiosks.map((k) => k.lng),
      lat = c.kiosks.map((k) => k.lat);
    const panel = desk ? (box.current?.parentElement?.querySelector<HTMLElement>(`.${s.panel}`)?.offsetWidth ?? 380) + 40 : 0;
    m.fitBounds(
      [
        [Math.min(...lng), Math.min(...lat)],
        [Math.max(...lng), Math.max(...lat)],
      ],
      { padding: { top: 90, bottom: 70, left: panel + 70, right: desk ? 90 : 40 }, maxZoom: 15, duration: animate ? 1600 : 0, essential: true },
    );
  };

  // подписи меток не наезжают друг на друга: у близко стоящих видна только первая (остальные — при наведении)
  const declutter = () => {
    const m = mapRef.current;
    if (!m) return;
    const shown: { x: number; y: number }[] = [];
    markers.current.forEach((mk) => {
      const pt = m.project(mk.getLngLat());
      const clash = shown.some((q) => Math.abs(q.x - pt.x) < 150 && Math.abs(q.y - pt.y) < 104);
      mk.getElement().toggleAttribute("data-quiet", clash);
      if (!clash) shown.push(pt);
    });
  };

  // создание карты при подлёте к блоку
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let map: MLMap | null = null;
    let mo: MutationObserver | null = null;
    let dead = false;
    const io = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting || map) return;
        io.disconnect();
        const ml = await import("maplibre-gl");
        if (dead) return;
        ml.setWorkerUrl(`${BASE}/vendor/maplibre-gl-worker.mjs`);
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        map = new ml.Map({
          container: el,
          style: mapStyle(palette()),
          center: [cityRef.current.kiosks[0].lng, cityRef.current.kiosks[0].lat],
          zoom: 12,
          attributionControl: false,
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          fadeDuration: reduced ? 0 : 300,
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText": "Чтобы приблизить карту, зажмите Ctrl и крутите колёсико",
            "CooperativeGesturesHandler.MacHelpText": "Чтобы приблизить карту, зажмите ⌘ и крутите колёсико",
            "CooperativeGesturesHandler.MobileHelpText": "Двигайте карту двумя пальцами",
            "NavigationControl.ZoomIn": "Приблизить",
            "NavigationControl.ZoomOut": "Отдалить",
          },
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new ml.AttributionControl({ compact: true }), "bottom-right");
        // клик по свободному месту карты (не перетаскивание) — город в 2ГИС
        map.on("click", (ev) => {
          if ((ev.originalEvent.target as HTMLElement).closest("a")) return;
          window.open(gis(cityRef.current.gis), "_blank", "noopener");
        });
        mapRef.current = map;
        frameCity(map, cityRef.current, false);
        map.on("moveend", declutter);
        map.once("load", () => {
          setReady(true);
          // атрибуция OSM — свёрнутой кнопкой «i», чтобы не закрывать метки
          el.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
        });
        // смена вкуса — карта перекрашивается в новые оттенки
        mo = new MutationObserver(() => map?.isStyleLoaded() && recolor(map, palette()));
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
        setMapTick((t) => t + 1); // метки ставит следующий эффект
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => {
      dead = true;
      io.disconnect();
      mo?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // метки-логотипы города: ссылка на Яндекс Карты, наведение связано со списком
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    let cancelled = false;
    import("maplibre-gl").then((ml) => {
      if (cancelled) return;
      markers.current.forEach((mk) => mk.remove());
      markers.current = city.kiosks.map((k, i) => {
        const a = document.createElement("a");
        a.className = s.pin;
        a.href = yandex(k.name, city.name);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.setAttribute("aria-label", `${k.name} на Яндекс Картах`);
        a.style.setProperty("--i", String(i));
        a.innerHTML = `<span class="${s.drop}"><span class="${s.badge}">${MARK}</span><span class="${s.pinLabel}">${k.name}</span></span><i class="${s.pulse}"></i>`;
        a.addEventListener("mouseenter", () => setHot(i));
        a.addEventListener("mouseleave", () => setHot(null));
        return new ml.Marker({ element: a, anchor: "bottom" }).setLngLat([k.lng, k.lat]).addTo(m);
      });
      declutter();
    });
    return () => {
      cancelled = true;
    };
  }, [city, mapTick]);

  // смена города — плавный перелёт
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    const m = mapRef.current;
    if (m) frameCity(m, city, !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, [city]);

  useEffect(() => {
    markers.current.forEach((mk, i) => mk.getElement().toggleAttribute("data-hot", hot === i));
  }, [hot]);

  return (
    <section id="find" className={s.find}>
      <div className={s.head}>
        <div>
          <p className={s.label} data-reveal>
            {find.label}
          </p>
          <h2 className={s.h2} data-reveal style={{ ["--d" as string]: 1 }}>
            {find.title}
          </h2>
          <p className={s.body} data-reveal style={{ ["--d" as string]: 2 }}>
            {find.text}
          </p>
        </div>
        <div className={s.tabs} role="tablist" aria-label="Город" data-reveal style={{ ["--d" as string]: 3, ["--n" as string]: cities.length } as React.CSSProperties}>
          {cities.map((c, i) => (
            <button key={c.id} type="button" role="tab" aria-selected={i === ci} onClick={() => (setCi(i), setHot(null))}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className={s.frame} data-reveal style={{ ["--d" as string]: 2 }}>
        <div className={s.mapWrap} data-ready={ready || undefined}>
          <div ref={box} className={s.map} />
        </div>

        <div className={s.panel}>
          <p className={s.panelTitle}>
            {city.name} · {city.kiosks.length} киосков
          </p>
          <ol className={s.list} key={city.id}>
            {city.kiosks.map((k, i) => (
              <li key={k.name} style={{ ["--i" as string]: i }}>
                <a
                  href={yandex(k.name, city.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-hot={hot === i || undefined}
                  onMouseEnter={() => setHot(i)}
                  onMouseLeave={() => setHot(null)}
                  onFocus={() => setHot(i)}
                  onBlur={() => setHot(null)}
                >
                  <i className={s.dot} />
                  {k.name}
                  <Arrow />
                </a>
              </li>
            ))}
          </ol>
          <a href={gis(city.gis)} target="_blank" rel="noopener noreferrer" className={s.btn}>
            {find.cta}
            <Arrow />
          </a>
        </div>
      </div>
    </section>
  );
}
