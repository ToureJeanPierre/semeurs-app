"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

// Positions fixes (pas d'aléatoire) : rendu identique serveur / navigateur.
const SPARKS = [
  { left: "22%", dur: "6.5s", delay: "0s", drift: "-14px" },
  { left: "34%", dur: "8s", delay: "1.8s", drift: "10px" },
  { left: "44%", dur: "7s", delay: "3.4s", drift: "-8px" },
  { left: "52%", dur: "6.2s", delay: "0.9s", drift: "12px" },
  { left: "60%", dur: "7.6s", delay: "2.6s", drift: "-12px" },
  { left: "70%", dur: "8.4s", delay: "4.2s", drift: "16px" },
  { left: "78%", dur: "6.8s", delay: "1.3s", drift: "-10px" },
];

const reveal = {
  hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/**
 * Titre dans le style de l'affiche d'évangélisation : le début en lettres
 * rondes, le dernier mot (« t’aime ») en écriture manuscrite, le tout doré.
 */
function Headline({ text }: { text: string }) {
  const cut = text.lastIndexOf(" ");
  const start = cut > 0 ? text.slice(0, cut) : text;
  const end = cut > 0 ? text.slice(cut + 1) : "";
  return (
    <motion.p variants={reveal} className="leading-none [text-shadow:0_2px_14px_rgb(11_42_111/0.7)]">
      <span className="font-rounded text-[1.75rem] font-bold tracking-tight text-[#ffd34d]">{start}</span>
      {end && (
        <span className="ml-2 inline-block -rotate-3 font-script text-[2.25rem] font-bold text-[#ffe9a6]">
          {end}
        </span>
      )}
    </motion.p>
  );
}

const RAYS = Array.from({ length: 13 }, (_, i) => -72 + i * 12);

/** Dessin de secours (Bible ouverte dans la lumière) tant qu'aucune photo n'est paramétrée. */
function BannerArt() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 258"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id="bn-sky" cx="50%" cy="78%" r="85%">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset="0.16" stopColor="#ffd56b" />
          <stop offset="0.34" stopColor="#3ba7f0" />
          <stop offset="0.66" stopColor="#1546b8" />
          <stop offset="1" stopColor="#0b2a6f" />
        </radialGradient>
        <linearGradient id="bn-ray" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="bn-cloud">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bn-glow">
          <stop offset="0" stopColor="#fffbe8" stopOpacity="1" />
          <stop offset="0.4" stopColor="#ffd56b" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd56b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bn-page-l" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#e9d9b4" />
          <stop offset="0.25" stopColor="#fff8e6" />
          <stop offset="1" stopColor="#f6e8c6" />
        </linearGradient>
        <linearGradient id="bn-page-r" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9d9b4" />
          <stop offset="0.25" stopColor="#fff8e6" />
          <stop offset="1" stopColor="#f6e8c6" />
        </linearGradient>
      </defs>

      <rect width="400" height="258" fill="url(#bn-sky)" />

      {/* Rayons de lumière qui partent de la Bible */}
      <g className="animate-rays" style={{ transformOrigin: "200px 196px" }}>
        {RAYS.map((angle) => (
          <polygon
            key={angle}
            points="-3,0 3,0 26,-260 -26,-260"
            fill="url(#bn-ray)"
            transform={`translate(200 196) rotate(${angle})`}
          />
        ))}
      </g>

      {/* Nuages qui dérivent lentement */}
      <g className="animate-drift">
        <ellipse cx="40" cy="150" rx="90" ry="34" fill="url(#bn-cloud)" />
        <ellipse cx="360" cy="140" rx="96" ry="36" fill="url(#bn-cloud)" />
        <ellipse cx="320" cy="60" rx="70" ry="20" fill="url(#bn-cloud)" opacity="0.5" />
        <ellipse cx="70" cy="70" rx="60" ry="18" fill="url(#bn-cloud)" opacity="0.45" />
      </g>

      {/* Halo au-dessus des pages */}
      <ellipse
        className="animate-glow"
        style={{ transformOrigin: "200px 186px" }}
        cx="200"
        cy="186"
        rx="120"
        ry="60"
        fill="url(#bn-glow)"
      />

      {/* La Bible ouverte */}
      <g transform="translate(200 224)">
        {/* couverture */}
        <path
          d="M-168 -8 C -110 -22 -40 -20 0 -8 C 40 -20 110 -22 168 -8 L 168 4 L -168 4 Z"
          fill="#3a1d12"
        />
        {/* tranches des pages */}
        <path
          d="M-160 -14 C -105 -30 -40 -28 0 -14 C 40 -28 105 -30 160 -14 L 160 -8 C 105 -24 40 -22 0 -8 C -40 -22 -105 -24 -160 -8 Z"
          fill="#d8c08f"
        />
        {/* page gauche */}
        <path d="M0 -16 C -36 -36 -100 -40 -156 -24 L -158 -16 C -104 -30 -40 -28 0 -14 Z" fill="#c9ad78" />
        <path
          d="M0 -18 C -34 -50 -98 -56 -152 -40 L -156 -22 C -100 -38 -36 -34 0 -16 Z"
          fill="url(#bn-page-l)"
        />
        {/* page droite */}
        <path d="M0 -16 C 36 -36 100 -40 156 -24 L 158 -16 C 104 -30 40 -28 0 -14 Z" fill="#c9ad78" />
        <path d="M0 -18 C 34 -50 98 -56 152 -40 L 156 -22 C 100 -38 36 -34 0 -16 Z" fill="url(#bn-page-r)" />
        {/* lignes de texte */}
        <g stroke="#b59a63" strokeWidth="0.8" strokeLinecap="round" opacity="0.55" fill="none">
          <path d="M-20 -30 C -50 -44 -96 -46 -136 -38" />
          <path d="M-20 -26 C -50 -40 -96 -42 -138 -34" />
          <path d="M-20 -22 C -50 -36 -96 -38 -140 -30" />
          <path d="M20 -30 C 50 -44 96 -46 136 -38" />
          <path d="M20 -26 C 50 -40 96 -42 138 -34" />
          <path d="M20 -22 C 50 -36 96 -38 140 -30" />
        </g>
        {/* signet doré */}
        <path d="M6 -18 L 10 6 L 14 -2 L 18 6 L 16 -20 Z" fill="#e9a90f" />
      </g>
    </svg>
  );
}

/**
 * Bannière de l'accueil (maquette du 26/10/2026) : une photo (paramètre
 * « home_banner ») sur laquelle s'affichent un titre (« Jésus-Christ t'aime »,
 * même paramètre) puis le verset du jour. La photo zoome
 * très lentement et des étincelles dorées montent de la Bible.
 */
export function HomeBanner({
  imageUrl,
  headline,
  verse,
}: {
  imageUrl?: string | null;
  headline?: string | null;
  verse?: { text: string; reference: string } | null;
}) {
  // Les versets longs prennent une taille plus petite pour tenir dans la bannière.
  const size = !verse
    ? ""
    : verse.text.length > 140
      ? "text-[0.9375rem]"
      : verse.text.length > 80
        ? "text-base"
        : "text-lg";

  return (
    <section aria-label="Verset du jour" className="relative isolate h-64 overflow-hidden bg-night">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="(max-width: 512px) 100vw, 512px"
          className="animate-kenburns object-cover object-bottom"
        />
      ) : (
        <BannerArt />
      )}

      {/* Étincelles dorées qui montent de la Bible */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-14 h-0">
        {SPARKS.map((s) => (
          <span
            key={s.left}
            className="seed"
            style={{ left: s.left, "--dur": s.dur, "--delay": s.delay, "--drift": s.drift } as CSSProperties}
          />
        ))}
      </div>

      {/* Voile sombre en haut pour que le verset reste lisible */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-3/4 bg-gradient-to-b from-night/70 via-night/30 to-transparent"
      />

      <motion.div
        className="absolute inset-x-5 top-4 text-center text-white [text-shadow:0_2px_10px_rgb(11_42_111/0.8)]"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      >
        {headline && <Headline text={headline} />}
        {verse && (
          <motion.figure variants={reveal} className="mt-2 text-left">
            <blockquote className={`leading-snug ${size}`}>
              <span className="mr-1.5 font-sans text-[0.8125rem] font-bold text-gold">Verset du jour :</span>
              <span className="font-script">« {verse.text} »</span>
            </blockquote>
            <figcaption className="mt-1 text-right text-sm font-semibold text-gold">
              {verse.reference}
            </figcaption>
          </motion.figure>
        )}
      </motion.div>
    </section>
  );
}
