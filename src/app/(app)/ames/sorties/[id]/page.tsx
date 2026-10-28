import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { formatLongDay } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { formatPhone, parseIvorianPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { addOutreachContact, registerSoul } from "../../actions";

export const metadata: Metadata = { title: "Sortie" };

type Contact = { id: string; first_name: string; last_name: string; phone: string | null; district: string | null; decision: string; note: string | null; person_id: string | null; met_by: string | null };

/** Une sortie : contacts terrain, ajout rapide, conversion en fiche (entrée dans le parcours). */
export default async function OutingPage({ params }: PageProps<"/ames/sorties/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const access = await getAccess();
  const { data: outing } = await supabase.from("outreach_outings").select("id, outing_date, zone, note").eq("id", id).maybeSingle();
  if (!outing) notFound();
  const [{ data }, decisions, statuses, { data: soulStatuses }] = await Promise.all([
    supabase.from("outreach_contacts").select("id, first_name, last_name, phone, district, decision, note, person_id, met_by").eq("outing_id", id).order("created_at"),
    loadValueList("outreach_decision"),
    loadValueList("person_status"),
    supabase.from("settings").select("value").eq("key", "soul_statuses").maybeSingle(),
  ]);
  const allowed = (soulStatuses?.value as string[] | undefined) ?? ["visitor", "new_convert", "integrating"];
  const contacts = (data ?? []) as Contact[];
  const canConvert = hasAny(access, ["souls.manage", "people.manage"]);
  const label = (v: string) => decisions.find((d) => d.value === v)?.label ?? v;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title={outing.zone} intro={formatLongDay(outing.outing_date)} />
      <ul className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Contacts", contacts.length],
          ["Décisions", contacts.filter((c) => c.decision === "accepted").length],
          ["Fiches", contacts.filter((c) => c.person_id).length],
        ].map(([l, n]) => (
          <li key={l} className="rounded-card bg-surface p-3 shadow-card">
            <p className="font-display text-2xl font-bold text-royal">{n}</p>
            <p className="text-xs text-muted">{l}</p>
          </li>
        ))}
      </ul>

      <Card className="shadow-card">
        <h2 className="mb-2 text-lg font-semibold">Noter un contact</h2>
        <ActionForm action={addOutreachContact} hidden={{ outing_id: id }} submitLabel="Noter le contact" variant="primary">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Nom" name="last_name" required />
            <TextField label="Prénom(s)" name="first_name" required />
          </div>
          <TextField label="Téléphone" name="phone" type="tel" inputMode="tel" prefix="+225" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Quartier" name="district" />
            <SelectField label="Réponse" name="decision" options={decisions} />
          </div>
          <TextField label="Note" name="note" />
        </ActionForm>
      </Card>

      {contacts.map((c) => {
        const phone = c.phone ? parseIvorianPhone(c.phone) : null;
        return (
          <Card key={c.id} className="flex flex-col gap-2 shadow-card">
            <p>
              <span className="block font-semibold">
                {c.last_name.toUpperCase()} {c.first_name}
              </span>
              <span className="block text-sm text-muted">
                {label(c.decision)}
                {phone ? ` · ${formatPhone(phone)}` : ""}
                {c.district ? ` · ${c.district}` : ""}
                {c.note ? ` · ${c.note}` : ""}
              </span>
            </p>
            {c.person_id ? (
              <Link href={`/ames/${c.person_id}`} className="font-semibold text-ok-text">
                Fiche créée : voir son parcours
              </Link>
            ) : canConvert ? (
              <details className="rounded-xl bg-cloud px-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Créer sa fiche (parcours d&apos;intégration)</summary>
                <ActionForm
                  action={registerSoul}
                  hidden={{ contact_id: c.id, brought_by: c.met_by ?? "", first_name: c.first_name, last_name: c.last_name, phone: c.phone ?? "", district: c.district ?? "", note: c.note ?? "" }}
                  submitLabel="Créer la fiche"
                  className="flex flex-col gap-3 pb-3"
                >
                  <SelectField
                    label="Statut"
                    name="status"
                    defaultValue={c.decision === "accepted" ? "new_convert" : "visitor"}
                    options={statuses.filter((s) => allowed.includes(s.value))}
                  />
                </ActionForm>
              </details>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
