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

// внешние карты: метка и строка списка → Яндекс Карты с этим местом; кнопка и свободная часть карты → 2ГИС по городу
const yandex = (place: string, city: string) => `https://yandex.ru/maps/?text=${encodeURIComponent(`${place}, ${city}`)}`;
const gis = (slug: string) => `https://2gis.ru/${slug}/search/${encodeURIComponent("мороженое")}`;

// Блок «Киоски»: заголовок и переключатель городов сверху, ниже — карта в рамке со списком киосков поверх.
// Метки пронумерованы и связаны со списком: наведение на строку подсвечивает метку и наоборот.
export default function Find() {
  const [ci, setCi] = useState(0);
  const [hot, setHot] = useState<number | null>(null);
  const city = cities[ci];

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
        <div className={s.mapWrap}>
          {/* клик по свободной части карты — город в 2ГИС */}
          <a className={s.mapLink} href={gis(city.gis)} target="_blank" rel="noopener noreferrer" aria-label={`${city.name} в 2ГИС`} />
          <svg className={s.map} viewBox="0 0 1440 900" preserveAspectRatio="xMaxYMid slice">
            <defs>
              <pattern id={`blocks-${city.id}`} width="64" height="48" patternUnits="userSpaceOnUse" patternTransform={`rotate(${city.rot})`}>
                <rect x="4" y="4" width="56" height="40" rx="9" className={s.block} />
              </pattern>
              <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#a9d0e6" />
                <stop offset="1" stopColor="#c3b9e8" />
              </linearGradient>
              <pattern id="trees" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="6" cy="7" r="3.2" className={s.tree} />
                <circle cx="16" cy="16" r="2.6" className={s.tree} />
              </pattern>
            </defs>
            <g key={city.id} className={s.city}>
              <rect width="1440" height="900" className={s.land} />
              <rect width="1440" height="900" fill={`url(#blocks-${city.id})`} />
              {city.parks.map((p, i) => (
                <g key={i} transform={p.rot ? `rotate(${p.rot} ${p.cx} ${p.cy})` : undefined}>
                  <ellipse className={s.park} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} />
                  <ellipse fill="url(#trees)" cx={p.cx} cy={p.cy} rx={p.rx * 0.86} ry={p.ry * 0.8} />
                </g>
              ))}
              {city.water.map((w, i) =>
                w.w ? (
                  <g key={i}>
                    <path className={s.bank} d={w.d} strokeWidth={w.w + 10} />
                    <path className={s.river} d={w.d} strokeWidth={w.w} />
                  </g>
                ) : (
                  <path key={i} className={s.lake} d={w.d} />
                ),
              )}
              {city.roads.map((r, i) => (
                <g key={i}>
                  <path className={s.roadEdge} d={r.d} strokeWidth={r.main ? 15 : 8} />
                  <path className={s.road} d={r.d} strokeWidth={r.main ? 11 : 5} />
                </g>
              ))}
              <text className={s.watermark} x="1400" y="770" textAnchor="end">
                {city.name}
              </text>
            </g>
            <g key={`pins-${city.id}`}>
              {city.kiosks.map((k, i) => (
                <a key={k.name} href={yandex(k.name, city.name)} target="_blank" rel="noopener noreferrer" aria-label={`${k.name} на Яндекс Картах`}>
                  <g
                    className={s.pin}
                    data-hot={hot === i || undefined}
                    transform={`translate(${k.x} ${k.y})`}
                    style={{ ["--i" as string]: i }}
                    onMouseEnter={() => setHot(i)}
                    onMouseLeave={() => setHot(null)}
                  >
                    <ellipse className={s.pulse} rx="26" ry="9" />
                    <g className={s.drop}>
                      <path className={s.badge} d="M0 0 L-9 -16 A 27 27 0 1 1 9 -16 Z" />
                      <g transform="translate(-21 -62) scale(1.32)">
                        <Mark />
                      </g>
                      <circle className={s.numBg} cx="22" cy="-62" r="12" />
                      <text className={s.num} x="22" y="-57.5" textAnchor="middle">
                        {i + 1}
                      </text>
                      <text className={s.pinLabel} y="28" textAnchor="middle">
                        {k.name}
                      </text>
                    </g>
                  </g>
                </a>
              ))}
            </g>
          </svg>
          {/* роза ветров — для ощущения настоящей карты */}
          <svg className={s.compass} viewBox="0 0 40 40" aria-hidden>
            <circle cx="20" cy="20" r="19" />
            <path d="M20 5 L24 20 L20 18 L16 20 Z" className={s.north} />
            <path d="M20 35 L16 20 L20 22 L24 20 Z" />
          </svg>
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
                  <span className={s.n}>{i + 1}</span>
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
