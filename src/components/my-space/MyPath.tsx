import Link from "next/link";
import { Award, ChevronRight, GraduationCap, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

const ACT: Record<string, string> = { baptism: "Certificat de baptême", wedding: "Certificat de mariage", child_presentation: "Présentation d'enfant" };

/** Mon espace : mes formations (et attestations), mes certificats d'actes. Lien vers toutes les formations. */
export async function MyPath({ personId }: { personId: string }) {
  const supabase = await createClient();
  const [{ data: enrollments }, { data: acts }] = await Promise.all([
    supabase.from("training_enrollments").select("training_id, completed_on, trainings(title)").eq("person_id", personId),
    supabase.from("acts").select("id, kind, certificate_no").contains("person_ids", [personId]),
  ]);
  const rows = (enrollments ?? []) as unknown as { training_id: string; completed_on: string | null; trainings: { title: string } | null }[];
  return (
    <Card className="flex flex-col gap-2 shadow-card">
      <h2 className="text-lg font-semibold">Mon parcours</h2>
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((e) => (
          <li key={e.training_id}>
            <Link href={e.completed_on ? `/formations/${e.training_id}/attestation` : `/formations/${e.training_id}`} className="flex min-h-12 items-center gap-3">
              {e.completed_on ? <Award aria-hidden className="size-5 text-gold" /> : <GraduationCap aria-hidden className="size-5 text-royal" />}
              <span className="flex-1">
                {e.trainings?.title}
                <span className="block text-xs text-muted">{e.completed_on ? "Terminée : attestation" : "En cours"}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 text-muted" />
            </Link>
          </li>
        ))}
        {(acts ?? []).map((a) => (
          <li key={a.id}>
            <Link href={`/actes/${a.id}`} className="flex min-h-12 items-center gap-3">
              <ScrollText aria-hidden className="size-5 text-royal" />
              <span className="flex-1">
                {ACT[a.kind]}
                <span className="block text-xs text-muted">n° {a.certificate_no}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/formations" className="flex min-h-11 items-center justify-center rounded-full bg-royal/10 text-sm font-semibold text-royal">
        Voir les formations proposées
      </Link>
    </Card>
  );
}
