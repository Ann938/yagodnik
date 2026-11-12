"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { flavors, footer, hero, inside, nav, pour, ritual } from "@/content";
import { stage } from "@/three/stage";
import Find from "./Find";
import Fruits from "./Fruits";
import Preloader from "./Preloader";
import Product from "./Product";
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

// знак: ягода из зёрнышек с двумя листиками — натуральное и фруктовое; ягода окрашена в цвет вкуса
function Logo() {
  return (
    <span className={s.logo}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <g fill="var(--accent)"><circle cx="12" cy="13.2" r="2.45" /><circle cx="16" cy="12.6" r="2.45" /><circle cx="20" cy="13.2" r="2.45" /><circle cx="10" cy="17.2" r="2.45" /><circle cx="14" cy="16.8" r="2.45" /><circle cx="18" cy="16.8" r="2.45" /><circle cx="22" cy="17.2" r="2.45" /><circle cx="12" cy="21" r="2.45" /><circle cx="16" cy="20.8" r="2.45" /><circle cx="20" cy="21" r="2.45" /><circle cx="14" cy="24.6" r="2.45" /><circle cx="18" cy="24.6" r="2.45" /><circle cx="16" cy="28" r="2.45" /></g>
        <g fill="#fff" opacity=".55"><circle cx="11.2" cy="12.4" r="0.7" /><circle cx="15.2" cy="11.8" r="0.7" /><circle cx="19.2" cy="12.4" r="0.7" /><circle cx="9.2" cy="16.4" r="0.7" /><circle cx="13.2" cy="16.0" r="0.7" /><circle cx="17.2" cy="16.0" r="0.7" /><circle cx="21.2" cy="16.4" r="0.7" /><circle cx="11.2" cy="20.2" r="0.7" /><circle cx="15.2" cy="20.0" r="0.7" /><circle cx="19.2" cy="20.2" r="0.7" /><circle cx="13.2" cy="23.8" r="0.7" /><circle cx="17.2" cy="23.8" r="0.7" /><circle cx="15.2" cy="27.2" r="0.7" /></g>
        <path d="M16 10.2C14.8 6.6 11.8 5 8.4 5.6c.6 3.6 3.6 5.2 7.6 4.6z" fill="#4f8f3a" />
        <path d="M16 10.2c1.2-3.8 4.3-5.4 7.8-4.7-.7 3.7-3.8 5.4-7.8 4.7z" fill="#6fae4f" />
        <path d="M16 10.4V7" stroke="#3f7a2e" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      Ягодник
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
          // волна растворяется, а не пропадает: свечение под рожком проступает мягко
          gsap.to(el, { autoAlpha: 0, duration: 0.8, ease: "power1.out" });
        },
      },
    );
  }, []);
  return { wave, run };
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [flavor, setFlavor] = useState(0);
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
        css("--flvIn", p * (1 - stage.away));
      });
      st("#flavors", "top top", "bottom bottom", (p) => {
        choose(Math.min(2, Math.floor(p * 3)));
        css("--flv", p);
      });
      st("#inside", "top bottom", "top 15%", (p) => {
        stage.away = p; // рожок улетает уже на составе, а ягоды летят и здесь — гаснут с блока «Как есть»
        css("--flvIn", stage.flvIn * (1 - p)); // ягоды возвращаются на правую сторону к финалу
      });
      st("#ritual", "top bottom", "top 40%", (p) => css("--away", p));
      st("#find", "top bottom", "top 10%", (p) => {
        stage.buyIn = p; // летающие ягоды остаются скрытыми — у блока свои кусочки ягод на фоне
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

  // шапка: подложка после первого экрана; при скролле вниз уезжает, при скролле вверх возвращается
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      const d = y - last;
      if (Math.abs(d) > 6) {
        setHidden(d > 0 && y > 120); // у самого верха шапка видна всегда
        last = y;
      }
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // клик по «02 · Ежевика»: прокрутка к середине отрезка этого вкуса в закреплённом блоке
  const goFlavor = (i: number) => {
    const sec = document.getElementById("flavors");
    if (!sec) return;
    const top = sec.getBoundingClientRect().top + window.scrollY;
    const y = top + ((i + 0.5) / 3) * (sec.offsetHeight - window.innerHeight);
    const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o?: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };
  const f = flavors[flavor];

  return (
    <div ref={root} className={s.page}>
      <Preloader />
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
      <Product />
      <Fruits flavor={flavor} layer="front" />

      <header className={s.header} data-scrolled={scrolled || undefined} data-hidden={hidden || undefined}>
        <a href="#top" aria-label="Ягодник — наверх">
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
            {/* МВ: место под рожок между заголовком и кнопкой — сцена берёт отсюда позу рожка */}
            <div className={s.coneSpot} data-cone-spot aria-hidden />
            {/* выбор вкуса ягодкой: на ДВ — колонка справа от рожка, на МВ — строка под рожком */}
            <div className={s.rail} role="group" aria-label="Вкус">
              {flavors.map((fl, i) => (
                <button
                  key={fl.id}
                  type="button"
                  className={s.railItem}
                  aria-pressed={i === flavor}
                  aria-label={fl.name}
                  title={fl.name}
                  onClick={() => choose(i)}
                  style={{ ["--c" as string]: fl.accent }}
                >
                  { }
                  <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/${fl.fruits[0].src}`} alt="" />
                </button>
              ))}
            </div>
            <p className={s.lead}>{hero.lead}</p>
            <div className={s.heroActions}>
              <a href="#find" className={s.btn}>
                {hero.cta}
                <Arrow />
              </a>
            </div>
          </div>
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
            {/* МВ: место под рожок между шапкой и карточкой вкуса — сцена берёт отсюда позу рожка */}
            <div className={s.flvSpot} data-flv-spot aria-hidden />
            <div className={s.flvText}>
              <div className={s.flvTabs} role="group" aria-label="Вкусы по порядку">
                {flavors.map((fl, i) => (
                  <button key={fl.id} type="button" data-on={i === flavor || undefined} aria-pressed={i === flavor} onClick={() => goFlavor(i)}>
                    <b>0{i + 1}</b>
                    <i> · </i>
                    {fl.name}
                  </button>
                ))}
              </div>
              <div className={s.flvSwap} key={f.id}>
                <h2 className={s.h2}>{f.title}</h2>
                <p className={s.body}>{f.text}</p>
                <dl className={s.specs}>
                  <div>
                    <dt>Соус</dt>
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
          </div>
        </section>

        {/* ---------- 05 · как есть ---------- */}
        <section id="ritual" className={s.ritual}>
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

        {/* ---------- 06 · где найти: карта города ---------- */}
        <Find />
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
        <a className={s.credit} href={footer.credit.href} target="_blank" rel="noopener noreferrer">
          {footer.credit.text}
        </a>
      </footer>
    </div>
  );
}
