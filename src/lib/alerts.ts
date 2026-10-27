import type { VigilanceLevel } from "@/components/ui/VigilanceAvatar";

export type AlertRow = {
  person_id: string;
  level: VigilanceLevel;
  days_absent: number;
  last_presence_on: string | null;
  status: "open" | "treated" | "closed";
};

/** Ordre d'urgence (du plus urgent au moins urgent) pour trier « À contacter ». */
const RANK: Record<VigilanceLevel, number> = { lost: 0, critical: 1, urgent: 2, attention: 3, excused: 4, ok: 5 };

export function byUrgency<T extends { level: VigilanceLevel; days_absent: number }>(a: T, b: T): number {
  return RANK[a.level] - RANK[b.level] || b.days_absent - a.days_absent;
}

export function needsContact(level: VigilanceLevel): boolean {
  return RANK[level] <= RANK.attention;
}

/** Répartition pour le baromètre de la famille : rouge (urgent et plus), orange, vert. */
export function barometer(levels: VigilanceLevel[]) {
  return {
    red: levels.filter((l) => l === "urgent" || l === "critical" || l === "lost").length,
    orange: levels.filter((l) => l === "attention").length,
    green: levels.filter((l) => l === "ok" || l === "excused").length,
  };
}
