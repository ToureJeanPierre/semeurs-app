import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonFields } from "@/components/people/PersonFields";
import { requirePermission } from "@/lib/access";
import { loadPeopleOptions } from "@/lib/admin";
import { loadValueList } from "@/lib/people";
import { createPersonRecord } from "../actions";

export const metadata: Metadata = { title: "Nouvelle fiche" };

export default async function NewPersonPage() {
  await requirePermission("people.manage");
  const [people, statuses, maritalStatuses, unattachedReasons] = await Promise.all([
    loadPeopleOptions(),
    loadValueList("person_status"),
    loadValueList("marital_status"),
    loadValueList("unattached_reason"),
  ]);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-8 pt-5">
      <PageTitle title="Nouvelle fiche" intro="Seuls le nom, le prénom et le sexe sont obligatoires." />
      <PersonFields
        action={createPersonRecord}
        values={{
          last_name: "",
          first_name: "",
          sex: null,
          birth_date: null,
          phone: null,
          whatsapp: null,
          relative_phone: null,
          commune: null,
          district: null,
          landmark: null,
          status: "visitor",
          marital_status: null,
          arrived_at: new Date().toISOString().slice(0, 10),
          baptized_at: null,
          brought_by: null,
          unattached_reason: "new",
          weekday_exempt: false,
        }}
        people={people}
        statuses={statuses}
        maritalStatuses={maritalStatuses}
        unattachedReasons={unattachedReasons}
        showUnattached
        submitLabel="Créer la fiche"
      />
    </div>
  );
}
