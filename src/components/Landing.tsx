"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { buy, flavors, footer, hero, inside, nav, open, ritual } from "@/content";
import { stage } from "@/three/stage";
import s from "./landing.module.scss";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 9h11M10 4.5 14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Logo() {
  return (
    <span className={s.logo}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path d="M7 21c3-3 5-3 9 0s6 3 9 0v4H7z" fill="var(--cream)" />
        <g stroke="var(--cream)" strokeWidth="2.2" strokeLinecap="round">
          <path d="M16 6v10M11.7 8.5l8.6 5M11.7 13.5l8.6-5" />
        </g>
      </svg>
      Сугроб
    </span>
  );
}

// волна новой заливки: поднимается снизу, потом под неё меняются цвета страницы
function useFlavorWave() {
  const wave = useRef<HTMLDivElement>(null);
  const token = useRef(0);
  const apply = (i: number) => {
    const f = flavors[i];
    const r = document.documentElement.style;
    r.setProperty("--bg", f.bg);
    r.setProperty("--bg2", f.bg2);
    r.setProperty("--ink", f.ink);
    r.setProperty("--accent", f.accent);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", f.bg);
  };
  const run = useCallback((i: number) => {
    const el = wave.current;
    const t = ++token.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return apply(i);
    gsap.killTweensOf(el);
    el.style.color = flavors[i].bg;
    gsap.fromTo(
      el,
      { yPercent: 100, autoAlpha: 1 },
      {
        yPercent: 0,
        duration: 0.95,
        ease: "power2.inOut",
        onComplete: () => {
          if (t !== token.current) return;
          apply(i);
          gsap.set(el, { autoAlpha: 0 });
        },
      },
    );
  }, []);
  return { wave, run };
}

export default function Landing() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [flavor, setFlavor] = useState(0);
  const [ready, setReady] = useState(false);
  const { wave, run } = useFlavorWave();
  const current = useRef(0);

  const choose = useCallback(
    (i: number) => {
      if (i === current.current) return;
      current.current = i;
      stage.flavor = i;
      setFlavor(i);
      run(i);
    },
    [run],
  );

  // 3D-сцена грузится отдельно — three не попадает в первый бандл
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let dead = false;
    import("@/three/Scene").then(({ createScene }) => {
      if (dead || !canvas.current) return;
      dispose = createScene(canvas.current, () => setReady(true));
    });
    return () => {
      dead = true;
      dispose?.();
    };
  }, []);

  // хореография по скроллу → stage
  useEffect(() => {
    const ctx = gsap.context(() => {
      let lidRaw = 0;
      const sync = () => (stage.lid = lidRaw * (1 - stage.flvIn));
      const st = (trigger: string, start: string, end: string, fn: (p: number) => void) =>
        ScrollTrigger.create({ trigger, start, end, onUpdate: (t) => fn(t.progress), onRefresh: (t) => fn(t.progress) });

      st("#open", "top bottom", "top top", (p) => (stage.openIn = p));
      st("#open", "top top", "bottom bottom", (p) => {
        lidRaw = clamp((p - 0.04) / 0.32);
        sync();
        root.current?.style.setProperty("--open", String(p));
      });
      st("#flavors", "top bottom", "top top", (p) => {
        stage.flvIn = p;
        sync();
      });
      st("#flavors", "top top", "bottom bottom", (p) => {
        const i = Math.min(2, Math.floor(p * 3));
        choose(i);
        root.current?.style.setProperty("--flv", String(p));
      });
      st("#inside", "top bottom", "top 15%", (p) => (stage.away = p));
      st("#buy", "top bottom", "top 10%", (p) => (stage.buyIn = p));
      ScrollTrigger.create({
        trigger: "#buy",
        start: "top top",
        end: "bottom top",
        onUpdate: (t) => (stage.buyPx = t.progress * (t.end - t.start)),
        onRefresh: (t) => (stage.buyPx = t.progress * (t.end - t.start)),
      });
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (t) => (stage.scroll = t.progress),
      });
    }, root);
    return () => ctx.revert();
  }, [choose]);

  // в блоке «Открываем» факты появляются по одному с прогрессом
  const [factOn, setFactOn] = useState(0);
  useEffect(() => {
    const t = ScrollTrigger.create({
      trigger: "#open",
      start: "top top",
      end: "bottom bottom",
      onUpdate: (st) => setFactOn(Math.min(3, Math.floor(clamp((st.progress - 0.15) / 0.7) * 3.999))),
    });
    return () => t.kill();
  }, []);

  // шапка получает подложку, когда страница уехала с первого экрана
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const f = flavors[flavor];

  return (
    <div ref={root} className={s.page}>
      <div ref={wave} className={s.wave} aria-hidden>
        <svg viewBox="0 0 1440 140" preserveAspectRatio="none">
          <path
            d="M0 70 C 120 20 240 20 360 70 S 600 120 720 70 S 960 20 1080 70 S 1320 120 1440 70 V140 H0 Z"
            fill="currentColor"
          />
        </svg>
        <div />
      </div>
      <canvas ref={canvas} className={s.canvas} data-ready={ready || undefined} aria-hidden />

      <header className={s.header} data-scrolled={scrolled || undefined}>
        <a href="#top" aria-label="Сугроб — наверх">
          <Logo />
        </a>
        <nav className={s.nav}>
          {nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <a href="#buy" className={s.headerBtn}>
          Заказать набор
        </a>
      </header>

      <main className={s.main}>
        {/* ---------- 01 · первый экран ---------- */}
        <section id="top" className={s.hero}>
          <div className={s.heroText}>
            <p className={s.kicker}>{hero.kicker}</p>
            <h1 className={s.h1}>
              {hero.title.map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </h1>
            <p className={s.lead}>{hero.lead}</p>
            <div className={s.heroActions}>
              <a href="#flavors" className={s.btn}>
                {hero.cta}
                <Arrow />
              </a>
            </div>
          </div>
          <div className={s.pills} role="group" aria-label="Вкус">
            {flavors.map((fl, i) => (
              <button
                key={fl.id}
                type="button"
                className={s.pill}
                aria-pressed={i === flavor}
                onClick={() => choose(i)}
                style={{ ["--c" as string]: fl.accent }}
              >
                <i />
                {fl.name}
              </button>
            ))}
          </div>
          <span className={s.scrollHint}>Листайте</span>
        </section>

        {/* ---------- 02 · открываем ---------- */}
        <section id="open" className={s.open}>
          <div className={s.sticky}>
            <div className={s.openText}>
              <p className={s.label}>{open.label}</p>
              <h2 className={s.h2}>{open.title}</h2>
              <ul className={s.facts}>
                {open.facts.map((fc, i) => (
                  <li key={i} data-on={i < factOn || undefined}>
                    <b>{fc.num}</b>
                    <span>{fc.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- 03 · вкусы ---------- */}
        <section id="flavors" className={s.flavors}>
          <div className={s.sticky}>
            <div className={s.flvText}>
              <p className={s.counter}>
                <span>0{flavor + 1}</span> / 03
              </p>
              <div className={s.flvSwap} key={f.id}>
                <p className={s.label}>{f.short} пломбир</p>
                <h2 className={s.h2}>{f.tagline}</h2>
                <p className={s.body}>{f.text}</p>
                <dl className={s.specs}>
                  <div>
                    <dt>Внутри</dt>
                    <dd>{f.inside}</dd>
                  </div>
                  <div>
                    <dt>100 г</dt>
                    <dd>{f.kcal} ккал</dd>
                  </div>
                  <div>
                    <dt>Объём</dt>
                    <dd>450 мл</dd>
                  </div>
                </dl>
              </div>
              <div className={s.flvBar} aria-hidden>
                <i />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 04 · состав ---------- */}
        <section id="inside" className={s.inside}>
          <div className={s.insideHead}>
            <p className={s.label} data-reveal>
              {inside.label}
            </p>
            <h2 className={s.h2} data-reveal style={{ ["--d" as string]: 1 }}>
              {inside.title}
            </h2>
          </div>
          <div className={s.insideGrid}>
            <ol className={s.list}>
              {inside.list.map((it, i) => (
                <li key={it} data-reveal style={{ ["--d" as string]: i }}>
                  <span>0{i + 1}</span>
                  {it}
                </li>
              ))}
            </ol>
            <div className={s.insideSide}>
              <p className={s.note} data-reveal>
                {inside.note}
              </p>
              <ul className={s.stats}>
                {inside.stats.map((st, i) => (
                  <li key={i} data-reveal style={{ ["--d" as string]: i + 1 }}>
                    <b>
                      {st.num}
                      <small>{st.unit}</small>
                    </b>
                    <span>{st.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- 05 · как есть ---------- */}
        <section className={s.ritual}>
          <div className={s.ritualHead}>
            <p className={s.label} data-reveal>
              {ritual.label}
            </p>
            <h2 className={s.h2} data-reveal style={{ ["--d" as string]: 1 }}>
              {ritual.title}
            </h2>
          </div>
          <ol className={s.steps}>
            {ritual.steps.map((st, i) => (
              <li key={st.n} data-reveal style={{ ["--d" as string]: i }}>
                <span className={s.stepN}>{st.n}</span>
                <h3 className={s.h3}>{st.title}</h3>
                <p className={s.body}>{st.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- 06 · набор ---------- */}
        <section id="buy" className={s.buy}>
          <div className={s.buyText}>
            <p className={s.label} data-reveal>
              {buy.label}
            </p>
            <h2 className={s.h2} data-reveal style={{ ["--d" as string]: 1 }}>
              {buy.title}
            </h2>
            <p className={s.body} data-reveal style={{ ["--d" as string]: 2 }}>
              {buy.text}
            </p>
            <div className={s.price} data-reveal style={{ ["--d" as string]: 3 }}>
              <b>{buy.price}</b>
              <s>{buy.oldPrice}</s>
            </div>
            <div className={s.buyActions} data-reveal style={{ ["--d" as string]: 4 }}>
              <a href="#top" className={s.btn}>
                {buy.cta}
                <Arrow />
              </a>
            </div>
            <ul className={s.cities} data-reveal style={{ ["--d" as string]: 5 }}>
              {buy.cities.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <Logo />
        <nav>
          {footer.links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <p>{footer.note}</p>
      </footer>
    </div>
  );
}
