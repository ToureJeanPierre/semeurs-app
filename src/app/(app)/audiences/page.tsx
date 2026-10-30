import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { personName } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { requestAppointment, setAppointmentStatus } from "./actions";

export const metadata: Metadata = { title: "Audiences" };

const TZ = "Africa/Abidjan";
const dayFmt = new Intl.DateTimeFormat("fr-CI", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("fr-CI", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const STATUS: Record<string, string> = { requested: "En attente", confirmed: "Confirmée", cancelled: "Annulée", done: "Reçu(e)" };

type Appointment = {
  id: string;
  person_id: string;
  starts_at: string;
  topic: string | null;
  status: string;
  people: { first_name: string; last_name: string; phone: string | null } | null;
};

function StatusButton({ id, status, label, tone }: { id: string; status: string; label: string; tone: "ok" | "alert" | "ghost" }) {
  const cls = tone === "ok" ? "bg-ok-ring text-white" : tone === "alert" ? "bg-alert-bg text-alert-text" : "bg-royal/10 text-royal";
  return (
    <form action={setAppointmentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`min-h-11 rounded-full px-4 text-sm font-semibold ${cls}`}>
        {label}
      </button>
    </form>
  );
}

export default async function AudiencesPage() {
  const access = await getAccess();
  const manager = hasAny(access, ["audiences.manage"]);
  const supabase = await createClient();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const yesterday = new Date(nowDate.getTime() - 86_400_000).toISOString();
  const [{ data: slots }, { data: list }] = await Promise.all([
    supabase.rpc("available_slots"),
    supabase
      .from("appointments")
      .select("id, person_id, starts_at, topic, status, people(first_name, last_name, phone)")
      .gte("starts_at", yesterday)
      .neq("status", "cancelled")
      .order("starts_at"),
  ]);
  const appointments = (list ?? []) as unknown as Appointment[];
  const mine = appointments.filter((a) => a.person_id === access.personId);
  const others = manager ? appointments.filter((a) => a.person_id !== access.personId) : [];
  // Créneaux regroupés par jour
  const byDay = new Map<string, string[]>();
  for (const s of (slots ?? []) as string[]) {
    const key = dayFmt.format(new Date(s));
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      <PageTitle title="Audiences" intro="Rencontrer le pasteur : écoute, conseils, prière. Le mercredi après-midi." />

      {manager && (
        <section aria-labelledby="demandes" className="flex flex-col gap-2">
          <h2 id="demandes" className="text-lg font-semibold">Rendez-vous à venir</h2>
          {others.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucune demande pour l&apos;instant.</p>}
          {others.map((a) => (
            <Card key={a.id} className="flex flex-col gap-2 shadow-card">
              <p className="flex items-center gap-2 font-semibold">
                <CalendarClock aria-hidden className="size-5 text-royal" />
                {dayFmt.format(new Date(a.starts_at))} à {timeFmt.format(new Date(a.starts_at))}
              </p>
              <p>
                {a.people ? personName(a.people) : "—"} · <span className="text-muted">{STATUS[a.status]}</span>
              </p>
              {a.topic && <p className="text-sm text-muted">« {a.topic} »</p>}
              <div className="flex flex-wrap gap-2">
                {a.status === "requested" && <StatusButton id={a.id} status="confirmed" label="Confirmer" tone="ok" />}
                {a.status === "confirmed" && a.starts_at < now && <StatusButton id={a.id} status="done" label="Reçu(e)" tone="ghost" />}
                {a.status !== "done" && <StatusButton id={a.id} status="cancelled" label="Annuler" tone="alert" />}
              </div>
            </Card>
          ))}
        </section>
      )}

      {mine.length > 0 && (
        <section aria-labelledby="mes-rdv" className="flex flex-col gap-2">
          <h2 id="mes-rdv" className="text-lg font-semibold">Mes rendez-vous</h2>
          {mine.map((a) => (
            <Card key={a.id} className="flex items-center gap-3 shadow-card">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {dayFmt.format(new Date(a.starts_at))} à {timeFmt.format(new Date(a.starts_at))}
                </p>
                <p className="text-sm text-muted">{STATUS[a.status]}</p>
              </div>
              {(a.status === "requested" || a.status === "confirmed") && (
                <StatusButton id={a.id} status="cancelled" label="Annuler" tone="alert" />
              )}
            </Card>
          ))}
        </section>
      )}

      <Card className="shadow-card">
        <h2 className="mb-3 text-lg font-semibold">Demander une audience</h2>
        {byDay.size === 0 ? (
          <p className="text-muted">Tous les créneaux des prochaines semaines sont pris.</p>
        ) : (
          <ActionForm action={requestAppointment} submitLabel="Envoyer la demande" variant="primary">
            {[...byDay.entries()].map(([day, times]) => (
              <fieldset key={day}>
                <legend className="mb-2 text-sm font-semibold capitalize">{day}</legend>
                <div className="grid grid-cols-4 gap-2">
                  {times.map((t) => (
                    <label key={t} className="cursor-pointer">
                      <input type="radio" name="starts_at" value={t} className="peer sr-only" />
                      <span className="grid min-h-11 place-items-center rounded-xl border-2 border-[#c9daf6] bg-[#f4f8ff] text-sm font-semibold peer-checked:border-royal peer-checked:bg-royal peer-checked:text-white peer-focus-visible:ring-3 peer-focus-visible:ring-sky">
                        {timeFmt.format(new Date(t))}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <TextField label="Sujet (facultatif, vu seulement du pasteur)" name="topic" />
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
