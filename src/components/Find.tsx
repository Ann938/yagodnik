"use client";

import { useState } from "react";
import { find } from "@/content";
import { cities } from "./cityMaps";
import s from "./find.module.scss";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
// метки киосков — ягоды из мороженого по очереди
const PINS = ["straw-whole", "bb-whole", "rasp-whole"];

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 9h11M10 4.5 14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Блок «Где найти»: на фоне — стилизованная карта выбранного города, киоски отмечены ягодами.
// Смена города: карта мягко проявляется с лёгким приближением, ягоды падают по очереди.
export default function Find() {
  const [ci, setCi] = useState(0);
  const city = cities[ci];

  return (
    <section id="find" className={s.find}>
      <div className={s.mapWrap} aria-hidden>
        <svg className={s.map} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id={`blocks-${city.id}`} width="64" height="48" patternUnits="userSpaceOnUse" patternTransform={`rotate(${city.rot})`}>
              <rect x="4" y="4" width="56" height="40" rx="7" className={s.block} />
            </pattern>
            <radialGradient id="mapFade" cx="62%" cy="50%" r="70%">
              <stop offset="0.55" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </radialGradient>
            <mask id="mapMask">
              <rect width="1440" height="900" fill="url(#mapFade)" />
            </mask>
          </defs>
          <g key={city.id} className={s.city} mask="url(#mapMask)">
            <rect width="1440" height="900" fill={`url(#blocks-${city.id})`} />
            {city.parks.map((p, i) => (
              <ellipse key={i} className={s.park} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} transform={p.rot ? `rotate(${p.rot} ${p.cx} ${p.cy})` : undefined} />
            ))}
            {city.water.map((w, i) =>
              w.w ? <path key={i} className={s.river} d={w.d} strokeWidth={w.w} /> : <path key={i} className={s.lake} d={w.d} />,
            )}
            {city.roads.map((r, i) => (
              <path key={i} className={r.main ? s.roadMain : s.road} d={r.d} />
            ))}
          </g>
          <g key={`pins-${city.id}`}>
            {city.kiosks.map((k, i) => (
              <g key={k.name} className={s.pin} transform={`translate(${k.x} ${k.y})`} style={{ ["--i" as string]: i }}>
                <ellipse className={s.pulse} rx="26" ry="9" />
                <g className={s.drop}>
                  <image href={`${BASE}/fruit/${PINS[i % 3]}.webp`} x="-30" y="-58" width="60" height="60" preserveAspectRatio="xMidYMid meet" />
                  <text className={s.label} y="28" textAnchor="middle">
                    {k.name}
                  </text>
                </g>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <div className={s.card}>
        <p className={s.label2} data-reveal>
          {find.label}
        </p>
        <h2 className={s.h2} data-reveal style={{ ["--d" as string]: 1 }}>
          {find.title}
        </h2>
        <p className={s.body} data-reveal style={{ ["--d" as string]: 2 }}>
          {find.text}
        </p>
        <div className={s.cities} role="group" aria-label="Город" data-reveal style={{ ["--d" as string]: 3 }}>
          {cities.map((c, i) => (
            <button key={c.id} type="button" aria-pressed={i === ci} onClick={() => setCi(i)}>
              {c.name}
            </button>
          ))}
        </div>
        <ul className={s.list} key={city.id}>
          {city.kiosks.map((k, i) => (
            <li key={k.name} style={{ ["--i" as string]: i }}>
              <i />
              {k.name}
            </li>
          ))}
        </ul>
        <div className={s.bottom} data-reveal style={{ ["--d" as string]: 4 }}>
          <div className={s.price}>
            <b>{find.price}</b>
            <span>{find.priceNote}</span>
          </div>
          <a href="#top" className={s.btn}>
            {find.cta}
            <Arrow />
          </a>
        </div>
      </div>
    </section>
  );
}
