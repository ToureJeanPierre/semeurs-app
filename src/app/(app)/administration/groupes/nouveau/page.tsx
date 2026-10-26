import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GroupForm } from "@/components/admin/GroupForm";
import { PageTitle } from "@/components/admin/AdminCard";
import { requirePermission } from "@/lib/access";
import { loadGroupConfig, loadPeopleOptions } from "@/lib/admin";
import { createGroup } from "../../actions";

export const metadata: Metadata = { title: "Nouveau groupe" };

export default async function NewGroupPage({ searchParams }: PageProps<"/administration/groupes/nouveau">) {
  await requirePermission("groups.manage");
  const { type: slug } = await searchParams;
  const [{ types, functions, capabilities }, people] = await Promise.all([loadGroupConfig(), loadPeopleOptions()]);
  const type = types.find((t) => t.slug === slug);
  if (!type) notFound();

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-8 pt-5">
      <PageTitle title={`Ajouter : ${type.name.toLowerCase()}`} />
      <GroupForm
        action={createGroup}
        typeId={type.id}
        typeName={type.name}
        defaults={{ name: "", description: "", color: type.color }}
        capabilities={capabilities}
        checkedCapabilities={type.default_capabilities}
        functions={functions.filter((f) => f.type_id === type.id)}
        people={people}
        submitLabel="Créer le groupe"
      />
    </div>
  );
}
