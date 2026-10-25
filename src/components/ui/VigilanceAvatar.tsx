"use client";

import { motion, useReducedMotion } from "framer-motion";

/** États d'assiduité (docs/01 §6.5). Les seuils, eux, sont paramétrables (lot 1). */
export type VigilanceLevel = "ok" | "attention" | "urgent" | "critical" | "lost";

const LEVELS: Record<VigilanceLevel, { label: string; ring: string; badge: string; pulse: boolean }> = {
  ok: { label: "À jour", ring: "var(--color-ok-ring)", badge: "bg-ok-bg text-ok-text", pulse: false },
  attention: { label: "Attention", ring: "var(--color-warn-ring)", badge: "bg-warn-bg text-warn-text", pulse: false },
  urgent: { label: "Urgent", ring: "var(--color-alert-ring)", badge: "bg-alert-bg text-alert-text", pulse: true },
  critical: { label: "Critique", ring: "var(--color-alert-ring)", badge: "bg-alert-bg text-alert-text", pulse: true },
  lost: { label: "Perdu de vue", ring: "var(--color-lost-ring)", badge: "bg-lost-bg text-lost-text", pulse: false },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * L'« anneau de vigilance » : avatar entouré d'un anneau dont la couleur
 * dit l'état d'assiduité. À partir d'« Urgent », une onde rouge pulse.
 */
export function VigilanceAvatar({
  name,
  level,
  size = 56,
  showLabel = false,
}: {
  name: string;
  level: VigilanceLevel;
  size?: number;
  showLabel?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const state = LEVELS[level];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        {state.pulse && !reduceMotion && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ border: `3px solid ${state.ring}` }}
            initial={{ scale: 1, opacity: 0.9 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span
          className="absolute inset-0 grid place-items-center rounded-full bg-royal/10 font-display font-semibold text-night"
          style={{ boxShadow: `0 0 0 3px ${state.ring}`, fontSize: size * 0.34 }}
        >
          {initials(name)}
        </span>
      </div>
      {showLabel ? (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${state.badge}`}>
          {state.label}
        </span>
      ) : (
        <span className="sr-only">{state.label}</span>
      )}
    </div>
  );
}
