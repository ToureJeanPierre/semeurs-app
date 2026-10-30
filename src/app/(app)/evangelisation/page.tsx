import type { Metadata } from "next";
import Link from "next/link";
import { Check, Footprints, HeartHandshake, MapPin } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { FormCard } from "@/components/ui/FormCard";
import { ContactButtons } from "@/components/alerts/ContactButtons";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { addDays, formatShortDay, todayIso } from "@/lib/format";
import { loadHomeData } from "@/lib/home";
import { loadMessageTemplate } from "@/lib/message-templates";
import { INVITE_FALLBACK, inviteMessage, nextServicePhrase } from "@/lib/outreach";
import { loadValueList } from "@/lib/people";
import type { Soul } from "@/lib/souls";
import { createClient } from "@/lib/supabase/server";
import { registerSoul } from "../ames/actions";
import { markInvited, quickContact } from "./actions";

export const metadata: Metadata = { title: "Évangélisation" };

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  district: string | null;
  decision: string;
  note: string | null;
  met_by: string | null;
  invited_on: string | null;
  created_at: string;
  outreach_outings: { zone: string; outing_date: string } | null;
};

/**
 * Évangélisation sur le terrain : noter en quelques secondes la personne rencontrée,
 * puis l'inviter au prochain culte (message déjà écrit), comme les nouvelles âmes.
 */
export default async function EvangelismPage() {
  const access = await getAccess();
  // Pas encore dans l'équipe : on explique comment y entrer, au lieu de renvoyer à l'accueil.
  if (!hasAny(access, ["outreach.record", "souls.manage"], "any")) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
        <PageTitle title="Évangélisation" />
        <p className="rounded-card border-2 border-[#bcd3f7] bg-surface p-4 text-sm">
          Cet onglet est réservé à l&apos;équipe d&apos;évangélisation. Pour y entrer, un administrateur vous ajoute comme membre de
          l&apos;équipe : <span className="font-semibold">Administration → Groupes → Évangélisation → Ajouter un membre</span>.
        </p>
      </div>
    );
  }
  const manager = hasAny(access, ["souls.manage", "people.manage"]);
  const supabase = await createClient();
  const today = todayIso();
  const [{ data: contactRows }, { data: soulRows }, { data: lastOuting }, decisions, invite, home] = await Promise.all([
    supabase
      .from("outreach_contacts")
      .select("id, first_name, last_name, phone, district, decision, note, met_by, invited_on, created_at, outreach_outings(zone, outing_date)")
      .is("person_id", null)
      .gte("created_at", addDays(today, -90))
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.rpc("souls_overview"),
    supabase.from("outreach_outings").select("zone").eq("outing_date", today).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    loadValueList("outreach_decision"),
    loadMessageTemplate("outreach_invite", INVITE_FALLBACK),
    loadHomeData(),
  ]);
  const contacts = (contactRows ?? []) as unknown as Contact[];
  const souls = ((soulRows ?? []) as Soul[]).filter((s) => s.phone);
  const culte = nextServicePhrase(home.services, new Date());
  // « Invité(e) » vaut pour le culte qui vient : une invitation de plus de 6 jours ne compte plus.
  const invitedRecently = (c: Contact) => !!c.invited_on && c.invited_on >= addDays(today, -6);
  const toInvite = contacts.filter((c) => c.phone && !invitedRecently(c)).length;
  const decision = (v: string) => decisions.find((d) => d.value === v)?.label ?? v;
  const message = (firstName: string) => (culte ? inviteMessage(invite, firstName, culte.phrase) : undefined);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Évangélisation" intro="Noter la personne rencontrée, puis l'inviter au culte." />

      <FormCard title="Personne rencontrée" subtitle="Notez-la en quelques secondes." icon="heart-handshake" tone="green">
        <ActionForm action={quickContact} submitLabel="Enregistrer" variant="primary">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Nom" name="last_name" required />
            <TextField label="Prénom(s)" name="first_name" required />
          </div>
          <TextField label="Téléphone" name="phone" type="tel" inputMode="tel" prefix="+225" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Quartier" name="district" />
            <SelectField label="Réponse" name="decision" options={decisions} defaultValue="interested" />
          </div>
          <details className="rounded-xl bg-cloud px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Plus de détails</summary>
            <div className="flex flex-col gap-3 pb-3">
              <TextField label="Lieu de la sortie" name="zone" defaultValue={lastOuting?.zone ?? ""} placeholder="Ex. Marché de Niangon" />
              <TextField label="Note (besoin de prière, meilleure heure pour appeler…)" name="note" />
            </div>
          </details>
        </ActionForm>
      </FormCard>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">À inviter au prochain culte</h2>
        {culte ? (
          <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm">
            <span className="font-semibold">{culte.label}</span>
            <br />
            {toInvite > 0
              ? `${toInvite} personne${toInvite > 1 ? "s" : ""} rencontrée${toInvite > 1 ? "s" : ""} pas encore invitée${toInvite > 1 ? "s" : ""}. Touchez WhatsApp ou SMS : le message est déjà écrit.`
              : "Tout le monde a été invité. Gloire à Dieu !"}
          </p>
        ) : (
          <p className="rounded-2xl bg-cloud px-4 py-3 text-sm text-muted">Aucun culte n&apos;est paramétré.</p>
        )}

        {contacts.length === 0 && <p className="rounded-card bg-surface p-4 text-sm text-muted">Personne de noté ces trois derniers mois.</p>}
        {contacts.map((c) => {
          const invited = invitedRecently(c);
          return (
            <Card key={c.id} className="flex flex-col gap-2 shadow-card">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {c.last_name.toUpperCase()} {c.first_name}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
                    {c.district && (
                      <>
                        <MapPin aria-hidden className="size-3.5" /> {c.district} ·
                      </>
                    )}
                    {decision(c.decision)} · rencontré(e) le {formatShortDay(c.created_at.slice(0, 10))}
                  </span>
                  {c.note && <span className="block text-sm">{c.note}</span>}
                </span>
                {invited && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-xs font-semibold text-ok-text">
                    <Check aria-hidden className="size-3.5" /> invité(e)
                  </span>
                )}
              </div>
              {c.phone ? (
                <>
                  <ContactButtons name={`${c.first_name} ${c.last_name}`} phone={c.phone} message={message(c.first_name)} />
                  <form action={markInvited}>
                    <input type="hidden" name="contact_id" value={c.id} />
                    <input type="hidden" name="invited" value={invited ? "0" : "1"} />
                    <SubmitButton className={`min-h-11 w-full rounded-full text-sm font-semibold ${invited ? "bg-cloud text-muted" : "bg-ok-bg text-ok-text"}`}>
                      {invited ? "Annuler « invité(e) »" : "C'est fait : marquer invité(e)"}
                    </SubmitButton>
                  </form>
                </>
              ) : (
                <p className="text-sm text-muted">Pas de numéro : impossible de l&apos;inviter par téléphone.</p>
              )}
              {manager && (
                <details className="rounded-xl bg-cloud px-3">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">
                    Il ou elle est venu(e) au culte : créer sa fiche
                  </summary>
                  <ActionForm
                    action={registerSoul}
                    hidden={{
                      contact_id: c.id,
                      brought_by: c.met_by ?? "",
                      first_name: c.first_name,
                      last_name: c.last_name,
                      phone: c.phone ?? "",
                      district: c.district ?? "",
                      note: c.note ?? "",
                      status: c.decision === "accepted" ? "new_convert" : "visitor",
                    }}
                    submitLabel="Créer la fiche (nouvelle âme)"
                    className="flex flex-col gap-3 pb-3"
                  />
                </details>
              )}
            </Card>
          );
        })}
      </section>

      {souls.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Nouvelles âmes à inviter aussi</h2>
          {souls.map((s) => (
            <Card key={s.id} className="flex flex-col gap-2 shadow-card">
              <Link href={`/ames/${s.id}`} className="font-semibold">
                {s.last_name.toUpperCase()} {s.first_name}
                {s.arrived_at && <span className="block text-sm font-normal text-muted">Venu(e) le {formatShortDay(s.arrived_at)}</span>}
              </Link>
              <ContactButtons name={`${s.first_name} ${s.last_name}`} phone={s.phone!} message={message(s.first_name)} />
            </Card>
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/ames/sorties" className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-surface px-3 text-center text-sm font-semibold text-royal shadow-card">
          <Footprints aria-hidden className="size-5 shrink-0" /> Toutes les sorties
        </Link>
        <Link href="/ames" className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-surface px-3 text-center text-sm font-semibold text-royal shadow-card">
          <HeartHandshake aria-hidden className="size-5 shrink-0" /> Nouvelles âmes
        </Link>
      </div>
    </div>
  );
}
