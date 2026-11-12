"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { find, flavors, footer, hero, inside, nav, pour, ritual } from "@/content";
import { stage } from "@/three/stage";
import Fruits from "./Fruits";
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

// знак: рожок с завитком
function Logo() {
  return (
    <span className={s.logo}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path d="M10.5 15h11L16 27z" fill="var(--cream)" />
        <path d="M9.5 15c0-2.6 2-3.6 3.6-3.6 0-2.6 1.6-4.4 4.2-4.4 1.6 0 2.4.9 2.4.9-.9.4-1.4 1.2-1.3 2 2.6 0 4.1 1.6 4.1 4.1z" fill="var(--cream)" />
      </svg>
      Сугроб
    </span>
  );
}

// волна новой заливки: поднимается снизу, под ней меняются цвета страницы
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

  // хореография по скроллу → stage и CSS-переменные
  const [factOn, setFactOn] = useState(0);
  useEffect(() => {
    const css = (k: string, v: number) => root.current?.style.setProperty(k, v.toFixed(4));
    const ctx = gsap.context(() => {
      const st = (trigger: string, start: string, end: string, fn: (p: number) => void) =>
        ScrollTrigger.create({ trigger, start, end, onUpdate: (t) => fn(t.progress), onRefresh: (t) => fn(t.progress) });

      st("#pour", "top bottom", "top top", (p) => (stage.openIn = p));
      st("#pour", "top top", "bottom bottom", (p) => {
        stage.pour = clamp((p - 0.08) / 0.62);
        setFactOn(Math.min(3, Math.floor(clamp((p - 0.12) / 0.7) * 3.999)));
      });
      st("#flavors", "top bottom", "top top", (p) => {
        stage.flvIn = p;
        css("--flvIn", p * (1 - (stage.away || 0)));
      });
      st("#flavors", "top top", "bottom bottom", (p) => {
        choose(Math.min(2, Math.floor(p * 3)));
        css("--flv", p);
      });
      st("#inside", "top bottom", "top 15%", (p) => {
        stage.away = p;
        css("--away", p);
      });
      st("#find", "top bottom", "top 10%", (p) => {
        stage.buyIn = p;
        if (p > 0) css("--away", 1 - p);
      });
      ScrollTrigger.create({
        trigger: "#find",
        start: "top top",
        end: "bottom top",
        onUpdate: (t) => (stage.buyPx = t.progress * (t.end - t.start)),
        onRefresh: (t) => (stage.buyPx = t.progress * (t.end - t.start)),
      });
    }, root);
    return () => ctx.revert();
  }, [choose]);

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
      {/* фон: свечение за рожком и зерно */}
      <div className={s.backdrop} aria-hidden>
        <div className={s.glow} />
        <div className={s.grain} />
      </div>
      <div ref={wave} className={s.wave} aria-hidden>
        <svg viewBox="0 0 1440 140" preserveAspectRatio="none">
          <path d="M0 70 C 120 20 240 20 360 70 S 600 120 720 70 S 960 20 1080 70 S 1320 120 1440 70 V140 H0 Z" fill="currentColor" />
        </svg>
        <div />
      </div>
      <Fruits flavor={flavor} layer="back" />
      <canvas ref={canvas} className={s.canvas} data-ready={ready || undefined} aria-hidden />
      <Fruits flavor={flavor} layer="front" />

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
        <a href="#find" className={s.headerBtn}>
          Найти киоск
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
            </div>
          </div>
          <span className={s.scrollHint}>Листайте</span>
        </section>

        {/* ---------- 02 · заливаем ---------- */}
        <section id="pour" className={s.pour}>
          <div className={s.sticky}>
            <div className={s.pourText}>
              <p className={s.label}>{pour.label}</p>
              <h2 className={s.h2}>{pour.title}</h2>
              <ul className={s.facts}>
                {pour.facts.map((fc, i) => (
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
              <div className={s.flvTabs}>
                {flavors.map((fl, i) => (
                  <span key={fl.id} data-on={i === flavor || undefined}>
                    0{i + 1} · {fl.name}
                  </span>
                ))}
              </div>
              <div className={s.flvSwap} key={f.id}>
                <h2 className={s.h2}>{f.title}</h2>
                <p className={s.body}>{f.text}</p>
                <dl className={s.specs}>
                  <div>
                    <dt>Сверху</dt>
                    <dd>{f.sauce}</dd>
                  </div>
                  <div>
                    <dt>100 г</dt>
                    <dd>{f.kcal} ккал</dd>
                  </div>
                  <div>
                    <dt>Рожок</dt>
                    <dd>120 г</dd>
                  </div>
                </dl>
              </div>
              <div className={s.flvBar} aria-hidden>
                <i />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 04 · из чего ---------- */}
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
            <div>
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

        {/* ---------- 06 · где найти ---------- */}
        <section id="find" className={s.find}>
          <div className={s.findText}>
            <p className={s.label} data-reveal>
              {find.label}
            </p>
            <h2 className={s.h2} data-reveal style={{ ["--d" as string]: 1 }}>
              {find.title}
            </h2>
            <p className={s.body} data-reveal style={{ ["--d" as string]: 2 }}>
              {find.text}
            </p>
            <div className={s.price} data-reveal style={{ ["--d" as string]: 3 }}>
              <b>{find.price}</b>
              <span>{find.priceNote}</span>
            </div>
            <div className={s.findActions} data-reveal style={{ ["--d" as string]: 4 }}>
              <a href="#top" className={s.btn}>
                {find.cta}
                <Arrow />
              </a>
            </div>
            <ul className={s.cities} data-reveal style={{ ["--d" as string]: 5 }}>
              {find.cities.map((c) => (
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
        <div className={s.footNote}>
          <p>{footer.note}</p>
          <p>{footer.credits}</p>
        </div>
      </footer>
    </div>
  );
}
