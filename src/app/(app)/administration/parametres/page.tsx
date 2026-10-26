import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { ThresholdsForm } from "@/components/admin/ThresholdsForm";
import { Card } from "@/components/ui/Card";
import { requirePermission } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { updateAlertThresholds } from "../actions";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", "alert_thresholds").maybeSingle();
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
    </div>
  );
}
