import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { MessageTemplateForm } from "@/components/admin/MessageTemplateForm";
import { ThresholdsForm } from "@/components/admin/ThresholdsForm";
import { Card } from "@/components/ui/Card";
import { requirePermission } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { updateAlertThresholds, updateMessageTemplate, updateProgramPositions, updateSimpleSetting } from "../actions";
import { TextField } from "@/components/ui/TextField";
import { ActionForm } from "@/components/people/ActionForm";
import { TextAreaField } from "@/components/ui/SelectField";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const supabase = await createClient();
  const [{ data }, { data: templates }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "alert_thresholds").maybeSingle(),
    supabase.from("message_templates").select("code, label, body").order("label"),
  ]);
  const { data: program } = await supabase.from("settings").select("value").eq("key", "program_positions").maybeSingle();
  const { data: simple } = await supabase
    .from("settings")
    .select("key, label, value")
    .in("key", ["giving_instructions", "expense_ceiling", "report_alert_days", "pledge_delay_notify_family_head", "meeting_online_base_url"]);
  const values = { attention: 7, urgent: 14, critical: 21, lost: 30, ...(data?.value as object | undefined) };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pb-8 pt-5">
      <PageTitle title="Paramètres" />
      <Card className="shadow-card">
        <h2 className="text-lg font-semibold">Seuils d&apos;alerte d&apos;absence</h2>
        <p className="mb-4 text-sm text-muted">
          Nombre de jours sans venir au culte avant chaque niveau d&apos;alerte.
        </p>
        <ThresholdsForm action={updateAlertThresholds} values={values} />
      </Card>
      <Card className="flex flex-col gap-4 shadow-card">
        <h2 className="text-lg font-semibold">Réglages divers</h2>
        {(simple ?? []).map((s) => (
          <ActionForm key={s.key} action={updateSimpleSetting} hidden={{ key: s.key }} submitLabel="Enregistrer" variant="ghost" className="flex flex-col gap-1 border-b border-line pb-3">
            {typeof s.value === "boolean" ? (
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input type="checkbox" name="value" defaultChecked={s.value} className="mt-1 size-5 accent-royal" />
                <span className="font-semibold">{s.label}</span>
              </label>
            ) : (
              <TextField label={s.label ?? s.key} name="value" defaultValue={String(s.value ?? "")} inputMode={typeof s.value === "number" ? "numeric" : undefined} />
            )}
          </ActionForm>
        ))}
      </Card>
      <Card className="flex flex-col gap-3 shadow-card">
        <h2 className="text-lg font-semibold">Programme des cultes</h2>
        <p className="text-sm text-muted">Postes répartis à tour de rôle par la génération (les autres postes d&apos;un culte sont tenus par les équipes).</p>
        <ActionForm action={updateProgramPositions} submitLabel="Enregistrer les postes">
          <TextAreaField label="Postes (un par ligne)" name="positions" rows={3} defaultValue={((program?.value as string[] | undefined) ?? []).join("\n")} />
        </ActionForm>
      </Card>
      <Card className="flex flex-col gap-5 shadow-card">
        <div>
          <h2 className="text-lg font-semibold">Messages préparés</h2>
          <p className="text-sm text-muted">
            Déjà écrits quand on touche SMS ou WhatsApp. {"{prénom}"} est remplacé par le prénom du fidèle.
            « Prise de nouvelles » sert pour les absents.
          </p>
        </div>
        {(templates ?? []).map((t) => (
          <MessageTemplateForm key={t.code} action={updateMessageTemplate} code={t.code} label={t.label} body={t.body} />
        ))}
      </Card>
    </div>
  );
}
