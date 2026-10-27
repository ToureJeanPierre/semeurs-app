import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { MessageTemplateForm } from "@/components/admin/MessageTemplateForm";
import { ThresholdsForm } from "@/components/admin/ThresholdsForm";
import { Card } from "@/components/ui/Card";
import { requirePermission } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { updateAlertThresholds, updateMessageTemplate } from "../actions";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const supabase = await createClient();
  const [{ data }, { data: templates }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "alert_thresholds").maybeSingle(),
    supabase.from("message_templates").select("code, label, body").order("label"),
  ]);
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
