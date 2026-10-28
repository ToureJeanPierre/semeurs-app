import Link from "next/link";
import { BookOpen, Mic } from "lucide-react";
import { requestSwap, saveMyPositionDetails } from "@/app/(app)/cultes/actions";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { formatHour, formatLongDay, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  position: string;
  theme: string | null;
  bible_text: string | null;
  services: { title: string; service_date: string; starts_at: string; published_at: string | null };
};

/** « Mes passages » : modération, prédication… avec thème, texte biblique et demande d'échange. */
export async function MyPositions({ personId }: { personId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_positions")
    .select("id, position, theme, bible_text, services!inner(title, service_date, starts_at, published_at)")
    .eq("person_id", personId)
    .gte("services.service_date", todayIso())
    .not("services.published_at", "is", null);
  const all = ((data ?? []) as unknown as Row[]).sort((a, b) => a.services.starts_at.localeCompare(b.services.starts_at));
  if (all.length === 0) return null;
  const rows = all.slice(0, 3); // les trois prochains ; la suite est dans le programme
  const candidates = await Promise.all(rows.map((r) => supabase.rpc("swap_candidates", { p_position: r.id })));

  return (
    <Card className="flex flex-col gap-3 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Mic aria-hidden className="size-5 text-royal" /> Mes passages
      </h2>
      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => {
          const others = ((candidates[i].data ?? []) as { person_id: string; name: string }[]).map((c) => ({ value: c.person_id, label: c.name }));
          return (
            <li key={r.id} className="flex flex-col gap-2 rounded-2xl bg-gold/10 p-3">
              <p>
                <span className="block font-semibold">{r.position}</span>
                <span className="block text-sm text-muted first-letter:uppercase">
                  {r.services.title} · {formatLongDay(r.services.service_date)} · {formatHour(r.services.starts_at)}
                </span>
              </p>
              {(r.theme || r.bible_text) && (
                <p className="flex items-start gap-1.5 text-sm text-royal">
                  <BookOpen aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {[r.theme && `« ${r.theme} »`, r.bible_text].filter(Boolean).join(" · ")}
                </p>
              )}
              <details className="rounded-xl bg-surface px-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Thème et texte biblique</summary>
                <ActionForm action={saveMyPositionDetails} hidden={{ position_id: r.id }} submitLabel="Enregistrer" className="flex flex-col gap-3 pb-3">
                  <TextField label="Thème" name="theme" defaultValue={r.theme ?? ""} />
                  <TextField label="Texte biblique" name="bible_text" placeholder="Jean 3.16" defaultValue={r.bible_text ?? ""} />
                </ActionForm>
              </details>
              {others.length > 0 && (
                <details className="rounded-xl bg-surface px-3">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Je ne peux pas : proposer un échange</summary>
                  <ActionForm action={requestSwap} hidden={{ position_id: r.id }} submitLabel="Envoyer la demande" className="flex flex-col gap-3 pb-3">
                    <SelectField label="Qui me remplacerait" name="replacement_id" options={[{ value: "", label: "Choisir…" }, ...others]} />
                    <TextField label="Motif (facultatif)" name="reason" />
                  </ActionForm>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {all.length > rows.length && (
        <Link href="/cultes" className="flex min-h-11 items-center justify-center rounded-full bg-royal/10 text-sm font-semibold text-royal">
          Voir mes {all.length} passages dans le programme
        </Link>
      )}
    </Card>
  );
}
