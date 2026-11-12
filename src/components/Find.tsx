"use client";

import { useState } from "react";
import { find } from "@/content";
import { cities } from "./cityMaps";
import s from "./find.module.scss";

// знак «Ягодника» для меток на карте (тот же, что в шапке: ягода из зёрнышек и два листика), 32×32
const DRUPES = [[12, 13.2], [16, 12.6], [20, 13.2], [10, 17.2], [14, 16.8], [18, 16.8], [22, 17.2], [12, 21], [16, 20.8], [20, 21], [14, 24.6], [18, 24.6], [16, 28]];
function Mark() {
  return (
    <g>
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
      <path d="M16 10.4V7" stroke="#3f7a2e" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 9h11M10 4.5 14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Блок «Где найти»: на фоне — стилизованная карта выбранного города, киоски отмечены знаком «Ягодника».
// Смена города: карта мягко проявляется с лёгким приближением, метки падают по очереди.
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
                  {/* метка: белый кружок с хвостиком, внутри знак бренда */}
                  <path className={s.badge} d="M0 0 L-9 -16 A 27 27 0 1 1 9 -16 Z" />
                  <g transform="translate(-21 -62) scale(1.32)">
                    <Mark />
                  </g>
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
