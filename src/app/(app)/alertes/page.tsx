import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { Barometer } from "@/components/alerts/Barometer";
import { ContactList, type ContactRow } from "@/components/alerts/ContactList";
import { ActionForm } from "@/components/people/ActionForm";
import { requirePermission } from "@/lib/access";
import { personName } from "@/lib/admin";
import { barometer, byUrgency, needsContact } from "@/lib/alerts";
import { ABSENCE_FALLBACK, loadMessageTemplate } from "@/lib/message-templates";
import { createClient } from "@/lib/supabase/server";
import type { VigilanceLevel } from "@/components/ui/VigilanceAvatar";
import { recomputeAlerts } from "./actions";

export const metadata: Metadata = { title: "Absences" };

type Row = {
  person_id: string;
  level: VigilanceLevel;
  days_absent: number;
  status: string;
  people: {
    first_name: string;
    last_name: string;
    phone: string | null;
    whatsapp: string | null;
    group_memberships: { end_date: string | null; groups: { name: string; group_types: { slug: string } | null } | null }[];
  } | null;
};

export default async function AlertsPage() {
  await requirePermission("alerts.view");
  const supabase = await createClient();
  const template = await loadMessageTemplate("absence_followup", ABSENCE_FALLBACK);
  const { data } = await supabase
    .from("alerts")
    .select("person_id, level, days_absent, status, people(first_name, last_name, phone, whatsapp, group_memberships(end_date, groups(name, group_types(slug))))");
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.people);

  const contacts: ContactRow[] = rows
    .filter((r) => needsContact(r.level))
    .map((r) => {
      const family = r.people!.group_memberships.find((m) => !m.end_date && m.groups?.group_types?.slug === "family");
      return {
        person_id: r.person_id,
        name: personName(r.people!),
        firstName: r.people!.first_name,
        level: r.level,
        days_absent: r.days_absent,
        treated: r.status === "treated",
        phone: r.people!.phone,
        whatsapp: r.people!.whatsapp,
        note: family?.groups?.name ?? "Sans famille",
      };
    })
    .sort(byUrgency);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Absences" intro="Tous les fidèles suivis, du plus urgent au moins urgent. Calcul chaque matin à 6 h." />
      <Barometer {...barometer(rows.map((r) => r.level))} />
      <ContactList rows={contacts} empty="Aucun absent à contacter. Gloire à Dieu !" template={template} />
      <ActionForm action={recomputeAlerts} submitLabel="Recalculer maintenant" variant="ghost" />
    </div>
  );
}
