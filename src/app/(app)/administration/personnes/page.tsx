import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonForm } from "@/components/admin/PersonForm";
import { Card } from "@/components/ui/Card";
import { requirePermission } from "@/lib/access";
import { loadPeopleOptions } from "@/lib/admin";
import { createPerson } from "../actions";

export const metadata: Metadata = { title: "Personnes" };

export default async function PeoplePage() {
  await requirePermission("settings.manage", "groups.manage");
  const people = await loadPeopleOptions();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pb-8 pt-5">
      <PageTitle
        title="Personnes"
        intro="Le registre de l'église. Les responsables et les membres des groupes sont choisis ici."
      />
      <Card className="shadow-card">
        <h2 className="mb-3 text-lg font-semibold">Ajouter une personne</h2>
        <PersonForm action={createPerson} />
      </Card>
      <section aria-labelledby="registre">
        <h2 id="registre" className="mb-2 text-lg font-semibold">
          Registre <span className="text-muted">({people.length})</span>
        </h2>
        {people.length === 0 ? (
          <p className="rounded-card bg-surface p-4 text-sm text-muted">
            Le registre est vide. Ajoutez la première personne ci-dessus.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-card bg-surface px-4 shadow-card">
            {people.map((p) => (
              <li key={p.id} className="py-3">
                <p className="font-semibold">{p.name}</p>
                {p.detail && <p className="text-sm text-muted">{p.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
