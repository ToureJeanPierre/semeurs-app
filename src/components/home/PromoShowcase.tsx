"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ChevronRight, Pause, Play } from "lucide-react";

export type PromoSlide = {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  image: string | null;
  /** Photo ou affiche : remplit tout le cadre. Sinon illustration détourée, posée à droite. */
  isPhoto: boolean;
  theme: string;
  effect: string;
  duration: number;
};

/** Fonds par thème (liste « promo_theme ») ; un thème inconnu prend le bleu roi. */
const THEMES: Record<string, string> = {
  royal: "linear-gradient(125deg,#0b2a6f 0%,#1546b8 45%,#2f7bf0 100%)",
  gold: "linear-gradient(125deg,#7a4300 0%,#c98a00 45%,#f5b72a 100%)",
  green: "linear-gradient(125deg,#064e33 0%,#0f8a57 45%,#22c483 100%)",
  violet: "linear-gradient(125deg,#26135f 0%,#5b34c9 45%,#8f6bff 100%)",
  sunset: "linear-gradient(125deg,#7c1d3a 0%,#e5486b 45%,#f7a23b 100%)",
  night: "linear-gradient(125deg,#030a24 0%,#0b1f5c 50%,#2c4fb8 100%)",
};

const MIX = ["zoom", "slide", "flip", "fade"] as const;

/**
 * Bannières animées de l'accueil, façon grandes plateformes (demande de Jean-Pierre du 08/11/2026) :
 * zoom avant/arrière, fondu, glissement, rotation 3D, balayage lumineux, lueur, parallaxe,
 * transitions combinées. Les messages se succèdent seuls ; on peut glisser du doigt, toucher un
 * point ou mettre en pause. Animé avec GSAP ; sobre (simple fondu) si le téléphone demande moins
 * d'animations. Les bannières viennent de la table « promo_slides » et des prochains événements.
 */
export function PromoShowcase({ slides }: { slides: PromoSlide[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hold, setHold] = useState(false);
  const previous = useRef<number | null>(null);
  const count = slides.length;
  const reduce = useRef(false);

  const go = useCallback((step: number) => setIndex((i) => (i + step + count) % count), [count]);

  // Préférence « moins d'animations » du téléphone.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduce.current = query.matches;
  }, []);

  // Mise en place : toutes les bannières cachées sauf la première ; décor qui tourne doucement.
  useLayoutEffect(() => {
    if (!stage.current) return;
    const ctx = gsap.context(() => {
      gsap.set("[data-slide]", { autoAlpha: 0 });
      gsap.set("[data-slide='0']", { autoAlpha: 1 });
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.to(".p-orb", { rotation: 360, duration: 40, repeat: -1, ease: "none", transformOrigin: "50% 50%" });
        gsap.to(".p-orb-b", { y: 14, duration: 5, repeat: -1, yoyo: true, ease: "sine.inOut" });
        gsap.to(".p-float", { y: -10, rotation: -2, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
      }
    }, stage);
    return () => ctx.revert();
  }, [count]);

  // Changement de bannière : sortie de l'ancienne, entrée de la nouvelle, contenu en cascade.
  useLayoutEffect(() => {
    const root = stage.current;
    if (!root || count === 0) return;
    const next = root.querySelector<HTMLElement>(`[data-slide='${index}']`);
    const prev = previous.current === null || previous.current === index ? null : root.querySelector<HTMLElement>(`[data-slide='${previous.current}']`);
    previous.current = index;
    if (!next) return;
    const slide = slides[index];
    const q = gsap.utils.selector(next);
    const tl = gsap.timeline();

    if (reduce.current) {
      if (prev) tl.to(prev, { autoAlpha: 0, duration: 0.5 });
      tl.to(next, { autoAlpha: 1, duration: 0.5 }, 0);
      return () => {
        tl.kill();
      };
    }

    const effect = slide.effect === "mix" || !MIX.includes(slide.effect as (typeof MIX)[number]) ? MIX[index % MIX.length] : slide.effect;
    const enter: gsap.TweenVars = { autoAlpha: 0 };
    const leave: gsap.TweenVars = { autoAlpha: 0, duration: 0.75, ease: "power2.in" };
    if (effect === "zoom") {
      Object.assign(enter, { scale: 0.72, filter: "blur(10px)" });
      Object.assign(leave, { scale: 1.18, filter: "blur(8px)" });
    } else if (effect === "slide") {
      Object.assign(enter, { xPercent: 100 });
      Object.assign(leave, { xPercent: -60 });
    } else if (effect === "flip") {
      Object.assign(enter, { rotationY: -85, transformOrigin: "100% 50%", z: -120 });
      Object.assign(leave, { rotationY: 85, transformOrigin: "0% 50%", z: -120 });
    }

    if (prev) tl.to(prev, leave, 0);
    tl.set(next, { autoAlpha: 1, zIndex: 2 }, prev ? 0.35 : 0)
      .fromTo(
        next,
        enter,
        { autoAlpha: 1, scale: 1, xPercent: 0, rotationY: 0, z: 0, filter: "blur(0px)", duration: 0.95, ease: effect === "zoom" ? "back.out(1.4)" : "power3.out" },
        prev ? 0.35 : 0,
      )
      .set(prev ?? {}, { zIndex: 1 });

    // Image : zoom avant ou arrière continu (effet « Ken Burns »), alterné d'une bannière à l'autre.
    const zoomIn = index % 2 === 0;
    tl.fromTo(q(".p-img"), { scale: zoomIn ? 1 : 1.16 }, { scale: zoomIn ? 1.16 : 1, duration: slide.duration + 1, ease: "none" }, 0.35);
    // Contenu en cascade : étiquette, titre mot à mot en 3D, sous-titre, bouton qui rebondit.
    tl.from(q(".p-eyebrow"), { y: -24, autoAlpha: 0, scale: 0.6, duration: 0.5, ease: "back.out(2)" }, 0.75)
      .from(q(".p-word"), { yPercent: 110, rotationX: -85, autoAlpha: 0, transformOrigin: "50% 100%", duration: 0.65, stagger: 0.07, ease: "power3.out" }, 0.85)
      .from(q(".p-sub"), { x: -30, autoAlpha: 0, duration: 0.6, ease: "power2.out" }, 1.25)
      .from(q(".p-cta"), { scale: 0, autoAlpha: 0, duration: 0.6, ease: "back.out(2.4)" }, 1.45)
      // Balayage lumineux sur le titre et le bouton, puis lueur qui pulse.
      .fromTo(q(".p-sweep"), { xPercent: -160 }, { xPercent: 260, duration: 1.3, ease: "power2.inOut" }, 1.6)
      .fromTo(
        q(".p-cta"),
        { boxShadow: "0 0 0 0 rgba(255,214,102,0)" },
        { boxShadow: "0 0 26px 6px rgba(255,214,102,.55)", duration: 0.9, repeat: 3, yoyo: true, ease: "sine.inOut" },
        2.1,
      );

    return () => {
      tl.kill();
    };
  }, [index, count, slides]);

  // Défilement automatique, avec barre de progression ; arrêté si on met en pause ou si on touche.
  useEffect(() => {
    if (count < 2 || !playing || hold) return;
    const duration = slides[index]?.duration ?? 6;
    const tween = bar.current ? gsap.fromTo(bar.current, { scaleX: 0 }, { scaleX: 1, duration, ease: "none", transformOrigin: "0% 50%" }) : null;
    const call = gsap.delayedCall(duration, () => go(1));
    const onHidden = () => (document.hidden ? (call.pause(), tween?.pause()) : (call.resume(), tween?.resume()));
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      call.kill();
      tween?.kill();
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [index, playing, hold, count, slides, go]);

  // Parallaxe : le fond, l'image et le texte suivent la souris (ou le doigt) à des vitesses différentes.
  useEffect(() => {
    const root = stage.current;
    if (!root || reduce.current) return;
    const layers: [string, number][] = [
      [".p-bg", -10],
      [".p-img", 22],
      [".p-card", 18],
      [".p-content", 8],
    ];
    const movers = layers.map(([sel, depth]) => ({
      depth,
      x: gsap.quickTo(root.querySelectorAll(sel), "x", { duration: 0.8, ease: "power3.out" }),
      y: gsap.quickTo(root.querySelectorAll(sel), "y", { duration: 0.8, ease: "power3.out" }),
    }));
    const onMove = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      const dx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const dy = ((e.clientY - r.top) / r.height - 0.5) * 2;
      for (const m of movers) {
        m.x(dx * m.depth);
        m.y(dy * m.depth * 0.6);
      }
    };
    const onLeave = () => movers.forEach((m) => (m.x(0), m.y(0)));
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [count]);

  // Glisser du doigt : à gauche pour la suivante, à droite pour la précédente (sans ouvrir le lien).
  const startX = useRef<number | null>(null);
  const swiped = useRef(false);

  if (count === 0) return null;

  return (
    <section aria-roledescription="carrousel" aria-label="À la une" className="flex flex-col gap-2">
      <div
        ref={stage}
        className="relative h-[19.5rem] touch-pan-y select-none overflow-hidden rounded-[1.75rem] bg-night shadow-float [perspective:1100px] sm:h-80 lg:h-96"
        onPointerDown={(e) => {
          startX.current = e.clientX;
          setHold(true);
        }}
        onPointerUp={(e) => {
          setHold(false);
          swiped.current = false;
          if (startX.current !== null && count > 1) {
            const dx = e.clientX - startX.current;
            if (Math.abs(dx) > 45) swiped.current = true;
            if (dx < -45) go(1);
            else if (dx > 45) go(-1);
          }
          startX.current = null;
        }}
        onPointerCancel={() => setHold(false)}
      >
        {slides.map((s, i) => {
          const body = (
            <>
              {/* Arrière-plan : dégradé du thème et formes lumineuses (couche la plus lente). */}
              <div className="p-bg absolute -inset-4" style={{ background: THEMES[s.theme] ?? THEMES.royal }}>
                <span className="p-orb absolute -right-16 -top-20 size-64 rounded-full bg-[conic-gradient(from_0deg,rgba(255,255,255,.22),transparent_40%,rgba(255,214,102,.25),transparent_80%)] blur-[2px]" />
                <span className="p-orb-b absolute -bottom-24 -left-16 size-56 rounded-full bg-white/10 blur-xl" />
              </div>

              {/* Image : photo plein cadre, ou illustration en carte arrondie, inclinée, qui flotte à droite. */}
              {s.image && s.isPhoto && (
                <div className="p-img absolute -inset-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- image signée, animée par GSAP */}
                  <img src={s.image} alt="" draggable={false} className="size-full object-cover" />
                </div>
              )}
              {s.image && !s.isPhoto && (
                <div className="p-card absolute right-3 top-1/2 w-[44%] -translate-y-1/2 sm:right-6 sm:w-[38%]">
                  <div className="p-float aspect-square -rotate-[5deg] overflow-hidden rounded-[1.6rem] shadow-[0_22px_40px_-12px_rgba(0,0,0,.55)] ring-4 ring-white/25">
                    {/* eslint-disable-next-line @next/next/no-img-element -- illustration de l'appli, animée par GSAP */}
                    <img src={s.image} alt="" draggable={false} className="p-img size-full object-cover" />
                  </div>
                </div>
              )}
              {s.isPhoto && <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-night/95 via-night/45 to-transparent" />}

              {/* Texte (couche la plus rapide) avec balayage lumineux. */}
              <div className={`p-content absolute inset-0 flex flex-col justify-end gap-2 p-5 text-white sm:p-8 ${s.isPhoto ? "" : "pr-[51%] sm:pr-[45%]"}`}>
                {s.eyebrow && (
                  <span className="p-eyebrow self-start rounded-full bg-gold px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-night shadow-lg">
                    {s.eyebrow}
                  </span>
                )}
                <h3 className="relative font-display text-[1.5rem] font-extrabold leading-[1.05] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.35)] [perspective:600px] sm:text-4xl lg:text-5xl">
                  {s.title.split(" ").map((word, w) => (
                    <span key={w} className="inline-block overflow-hidden pb-1 align-bottom">
                      <span className="p-word mr-[0.24em] inline-block">{word}</span>
                    </span>
                  ))}
                </h3>
                {s.subtitle && <p className="p-sub line-clamp-3 max-w-xl text-sm leading-snug text-white/90 sm:text-base">{s.subtitle}</p>}
                {s.ctaLabel && s.ctaHref && (
                  <span className="p-cta relative mt-1 inline-flex min-h-11 items-center gap-1.5 self-start overflow-hidden whitespace-nowrap rounded-full bg-white px-4 text-sm font-bold text-night sm:px-5 sm:text-base">
                    {s.ctaLabel} <ChevronRight aria-hidden className="size-4" />
                  </span>
                )}
                <span aria-hidden className="p-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
              </div>
            </>
          );
          return (
            <div
              key={s.id}
              data-slide={i}
              aria-hidden={i !== index}
              aria-roledescription="diapositive"
              aria-label={`${i + 1} sur ${count} : ${s.title}`}
              className="invisible absolute inset-0 [transform-style:preserve-3d]"
            >
              {s.ctaHref ? (
                <Link
                  href={s.ctaHref}
                  tabIndex={i === index ? 0 : -1}
                  className="absolute inset-0"
                  draggable={false}
                  onClick={(e) => {
                    if (swiped.current) e.preventDefault();
                  }}
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </div>
          );
        })}

        {/* Barre de progression dorée. */}
        {count > 1 && (
          <span aria-hidden className="absolute inset-x-0 top-0 z-10 h-1 bg-white/15">
            <span ref={bar} className="block h-full origin-left scale-x-0 bg-gold" />
          </span>
        )}
      </div>

      {count > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="grid size-11 place-items-center rounded-full text-royal"
            aria-label={playing ? "Mettre en pause le défilement" : "Reprendre le défilement"}
          >
            {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
          </button>
          {slides.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setIndex(i)} className="grid h-11 min-w-6 place-items-center" aria-label={`Voir : ${s.title}`} aria-current={i === index}>
              <span className={`block h-2 rounded-full transition-all duration-500 ${i === index ? "w-7 bg-royal" : "w-2 bg-royal/25"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
