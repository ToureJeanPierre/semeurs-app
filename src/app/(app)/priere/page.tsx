import type { Metadata } from "next";
import { Lock, Sparkles, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { TextAreaField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { getAccess } from "@/lib/access";
import { formatShortDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { HandsPrayingIcon } from "@/components/ui/icons";
import { addPrayerRequest, markAnswered, prayFor, removePrayerRequest } from "./actions";

export const metadata: Metadata = { title: "Prières" };

type Request = { id: string; author_id: string; body: string; confidential: boolean; status: string; answered_note: string | null; prayed_count: number; created_at: string };

/** Mur de prière : déposer un sujet (confidentiel au besoin), prier pour les autres, témoigner. */
export default async function PrayerPage() {
  const access = await getAccess();
  const supabase = await createClient();
  const { data } = await supabase.from("prayer_requests").select("*").order("created_at", { ascending: false }).limit(60);
  const rows = (data ?? []) as Request[];
  const answered = rows.filter((r) => r.status === "answered");
  const open = rows.filter((r) => r.status === "open");

  const item = (r: Request) => {
    const mine = r.author_id === access.personId;
    return (
      <Card key={r.id} className="flex flex-col gap-2 shadow-card">
        <p className="whitespace-pre-wrap">{r.body}</p>
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {formatShortDay(r.created_at)}
          {r.confidential && (
            <span className="flex items-center gap-1 rounded-full bg-cloud px-2 py-0.5">
              <Lock aria-hidden className="size-3" /> Confidentiel
            </span>
          )}
          {mine && <span className="rounded-full bg-gold/30 px-2 py-0.5 text-night">Mon sujet</span>}
          {r.prayed_count > 0 && <span>{r.prayed_count} personne{r.prayed_count > 1 ? "s prient" : " prie"}</span>}
        </p>
        {r.status === "answered" && r.answered_note && <p className="rounded-2xl bg-ok-bg p-3 text-sm text-ok-text">« {r.answered_note} »</p>}
        {r.status === "open" && (
          <div className="flex flex-wrap gap-2">
            {!mine && (
              <form action={prayFor}>
                <input type="hidden" name="request_id" value={r.id} />
                <SubmitButton className="flex min-h-11 items-center gap-2 rounded-full bg-royal/10 px-4 text-sm font-semibold text-royal">
                  <HandsPrayingIcon className="size-4" /> Je prie
                </SubmitButton>
              </form>
            )}
            {mine && (
              <details className="w-full rounded-xl bg-cloud px-3">
                <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ok-text">
                  <Sparkles aria-hidden className="size-4" /> Prière exaucée
                </summary>
                <ActionForm action={markAnswered} hidden={{ request_id: r.id }} submitLabel="Rendre gloire" className="flex flex-col gap-3 pb-3">
                  <TextField label="Votre témoignage (facultatif)" name="answered_note" />
                </ActionForm>
              </details>
            )}
            {mine && (
              <form action={removePrayerRequest}>
                <input type="hidden" name="request_id" value={r.id} />
                <SubmitButton aria-label="Retirer mon sujet" className="grid size-11 place-items-center rounded-full text-alert-text hover:bg-alert-bg">
                  <Trash2 aria-hidden className="size-4" />
                </SubmitButton>
              </form>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Prières" intro="« Priez les uns pour les autres. » Jacques 5.16" />
      <Card className="shadow-card">
        <ActionForm action={addPrayerRequest} submitLabel="Déposer mon sujet" variant="primary">
          <TextAreaField label="Mon sujet de prière" name="body" rows={3} required />
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" name="confidential" className="mt-1 size-5 accent-royal" />
            <span>Confidentiel : seuls le pasteur et les responsables de l&apos;intercession le verront.</span>
          </label>
        </ActionForm>
      </Card>
      {open.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucun sujet pour l&apos;instant.</p>}
      {open.map(item)}
      {answered.length > 0 && <h2 className="text-lg font-semibold">Prières exaucées</h2>}
      {answered.map(item)}
    </div>
  );
}
