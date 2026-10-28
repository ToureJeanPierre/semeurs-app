import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { requirePermission } from "@/lib/access";
import { addDays, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createExceptionalService } from "../actions";

export const metadata: Metadata = { title: "Ajouter un culte" };

/** Ajouter un culte à tout moment : culte supplémentaire, veillée, croisade, convention, jeûne… */
export default async function AddServicePage() {
  await requirePermission("program.manage");
  const supabase = await createClient();
  const { data: types } = await supabase.from("service_types").select("id, name").eq("active", true).order("weekday");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Ajouter un culte" intro="Même si le programme est déjà publié. Il apparaît tout de suite." />
      <Card className="shadow-card">
        <ActionForm action={createExceptionalService} submitLabel="Ajouter au programme" variant="primary">
          <TextField label="Nom" name="title" placeholder="Veillée de prière" required />
          <TextField label="Date" name="date" type="date" defaultValue={addDays(todayIso(), 7)} required />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Début" name="start" type="time" defaultValue="21:00" required />
            <TextField label="Fin (facultatif)" name="end" type="time" />
          </div>
          <TextField label="Lieu (facultatif)" name="place" placeholder="À l'église" />
          <SelectField label="Postes à pourvoir comme pour" name="type_id" options={(types ?? []).map((t) => ({ value: t.id, label: t.name }))} />
        </ActionForm>
      </Card>
    </div>
  );
}
