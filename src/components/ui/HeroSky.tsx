import type { CSSProperties, ReactNode } from "react";
import { LightRays } from "./LightRays";

// Positions fixes (pas d'aléatoire) : rendu identique serveur / navigateur.
const SEEDS = [
  { left: "8%", dur: "7.5s", delay: "0s", drift: "14px" },
  { left: "19%", dur: "9s", delay: "2.2s", drift: "-10px" },
  { left: "31%", dur: "6.8s", delay: "4.1s", drift: "18px" },
  { left: "44%", dur: "8.4s", delay: "1.1s", drift: "-16px" },
  { left: "57%", dur: "7.2s", delay: "3.3s", drift: "10px" },
  { left: "68%", dur: "9.6s", delay: "0.6s", drift: "-12px" },
  { left: "79%", dur: "6.5s", delay: "2.8s", drift: "16px" },
  { left: "90%", dur: "8.8s", delay: "4.6s", drift: "-8px" },
];

/**
 * Ciel de l'en-tête : dégradé bleu roi → bleu nuit, rayons qui oscillent,
 * grains dorés (les « semences ») qui montent, et une courbe douce en bas.
 */
export function HeroSky({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <header className={`hero-sky relative isolate overflow-hidden text-white ${className}`}>
      <LightRays animated />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {SEEDS.map((s) => (
          <span
            key={s.left}
            className="seed"
            style={
              { left: s.left, "--dur": s.dur, "--delay": s.delay, "--drift": s.drift } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="relative">{children}</div>
      <svg
        aria-hidden
        viewBox="0 0 400 24"
        preserveAspectRatio="none"
        className="absolute inset-x-0 -bottom-px h-6 w-full text-cloud"
      >
        <path d="M0 24 C 110 0, 290 0, 400 24 Z" fill="currentColor" />
      </svg>
    </header>
  );
}
