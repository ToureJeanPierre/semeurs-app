import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MultiPersonPicker } from "@/components/admin/MultiPersonPicker";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField, TextAreaField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { loadPeopleOptions } from "@/lib/admin";
import { addDays, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createMeeting } from "../actions";

export const metadata: Metadata = { title: "Organiser une réunion" };

/** Nouvelle réunion : objet, date, mode (salle Jitsi créée d'office si en ligne), invités en un geste. */
export default async function NewMeetingPage() {
  const access = await getAccess();
  if (!hasAny(access, ["meetings.manage"], "any")) redirect("/reunions");
  const supabase = await createClient();
  const [{ data: groups }, people] = await Promise.all([
    supabase.rpc("my_groups_with", { p_permission: "meetings.manage" }),
    loadPeopleOptions(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Organiser une réunion" />
      <Card className="shadow-card">
        <ActionForm action={createMeeting} submitLabel="Créer et inviter" variant="primary">
          <TextField label="Objet" name="title" placeholder="Réunion de famille" required />
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Date" name="date" type="date" defaultValue={addDays(todayIso(), 2)} className="col-span-3" required />
            <TextField label="Début" name="start" type="time" defaultValue="19:00" required />
            <TextField label="Fin" name="end" type="time" defaultValue="20:30" />
          </div>
          <SelectField
            label="Comment"
            name="mode"
            options={[
              { value: "in_person", label: "Sur place" },
              { value: "online", label: "En ligne (salle gratuite créée pour vous)" },
              { value: "hybrid", label: "Sur place et en ligne" },
            ]}
          />
          <TextField label="Lieu" name="place" placeholder="Chez le père de famille, Niangon" />
          <TextAreaField label="Ordre du jour" name="agenda" rows={4} placeholder={"1. Prière\n2. Nouvelles des familles\n3. Divers"} />
          {(groups ?? []).length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-semibold">Inviter tout un groupe</legend>
              {((groups ?? []) as { id: string; name: string; type_name: string }[]).map((g) => (
                <label key={g.id} className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" name="group_ids" value={g.id} className="size-5 accent-royal" />
                  <span>
                    {g.name} <span className="text-sm text-muted">· {g.type_name}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <MultiPersonPicker name="person_ids" label="Inviter aussi des personnes" people={people} />
        </ActionForm>
      </Card>
    </div>
  );
}
