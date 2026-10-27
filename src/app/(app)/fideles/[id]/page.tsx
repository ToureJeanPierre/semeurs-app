import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KeyRound, MessageCircle, Phone } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { PersonFields } from "@/components/people/PersonFields";
import { Card } from "@/components/ui/Card";
import { DoneLink } from "@/components/ui/DoneLink";
import { ModuleIcon } from "@/components/ui/icons";
import { getAccess, hasAny } from "@/lib/access";
import { loadPeopleOptions, personName } from "@/lib/admin";
import { loadFamilies, loadValueList, PERSON_COLUMNS } from "@/lib/people";
import { formatPhone, parseIvorianPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createAccount, resetPassword, transferFamily, updatePerson } from "../actions";

export const metadata: Metadata = { title: "Fiche" };

type Membership = {
  id: string;
  group_id: string;
  groups: { name: string; group_types: { slug: string; name: string; icon: string } | null } | null;
  group_functions: { label: string } | null;
};

export default async function PersonPage({ params }: PageProps<"/fideles/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  // RLS : la fiche n'est renvoyée que si elle est dans le périmètre de la personne connectée.
  const { data: person } = await supabase.from("people").select(PERSON_COLUMNS).eq("id", id).maybeSingle();
  if (!person) notFound();

  const [access, { data: canManage }, { data: memberships }, statuses] = await Promise.all([
    getAccess(),
    supabase.rpc("can_manage_person", { target: id }),
    supabase
      .from("group_memberships")
      .select("id, group_id, groups(name, group_types(slug, name, icon)), group_functions(label)")
      .eq("person_id", id)
      .is("end_date", null),
    loadValueList("person_status"),
  ]);
  const groups = (memberships ?? []) as unknown as Membership[];
  const family = groups.find((m) => m.groups?.group_types?.slug === "family");
  const statusLabel = statuses.find((s) => s.value === person.status)?.label ?? person.status;
  const phone = person.phone ? parseIvorianPhone(person.phone) : null;
  const whatsapp = person.whatsapp ? parseIvorianPhone(person.whatsapp) : phone;

  // Formulaire et accès : seulement pour qui peut gérer la fiche.
  const [people, maritalStatuses, unattachedReasons, families, hasAccount] = canManage
    ? await Promise.all([
        loadPeopleOptions(),
        loadValueList("marital_status"),
        loadValueList("unattached_reason"),
        hasAny(access, ["groups.manage"]) ? loadFamilies() : Promise.resolve([]),
        createAdminClient()
          .from("users")
          .select("user_id")
          .eq("person_id", id)
          .maybeSingle()
          .then(({ data }) => Boolean(data)),
      ])
    : [[], [], [], [], false];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-royal font-display text-xl font-semibold text-white">
          {`${person.first_name[0] ?? ""}${person.last_name[0] ?? ""}`.toUpperCase()}
        </span>
        <div className="min-w-0">
          <PageTitle title={personName(person)} intro={`${statusLabel} · ${family?.groups?.name ?? "Sans famille"}`} />
        </div>
      </div>

      {phone && (
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`tel:${phone.e164}`}
            className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-royal font-semibold text-white shadow-card"
          >
            <Phone aria-hidden className="size-5" />
            Appeler
          </a>
          <a
            href={`https://wa.me/${(whatsapp ?? phone).e164.replace("+", "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-[#1f8f4e] font-semibold text-white shadow-card"
          >
            <MessageCircle aria-hidden className="size-5" />
            WhatsApp
          </a>
        </div>
      )}

      {groups.length > 0 && (
        <section aria-labelledby="groupes">
          <h2 id="groupes" className="mb-2 text-lg font-semibold">Groupes</h2>
          <ul className="flex flex-col divide-y divide-line rounded-card bg-surface px-4 shadow-card">
            {groups.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <ModuleIcon name={m.groups?.group_types?.icon ?? "users-round"} className="size-5 shrink-0 text-royal" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.groups?.name}</span>
                  <span className="block text-sm text-muted">
                    {m.groups?.group_types?.name}
                    {m.group_functions ? ` · ${m.group_functions.label}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage ? (
        <>
          <section aria-labelledby="fiche">
            <h2 id="fiche" className="mb-2 text-lg font-semibold">Fiche</h2>
            <PersonFields
              action={updatePerson}
              values={{ ...person, id }}
              people={people.filter((p) => p.id !== id)}
              statuses={statuses}
              maritalStatuses={maritalStatuses}
              unattachedReasons={unattachedReasons}
              showUnattached={!family}
              submitLabel="Enregistrer la fiche"
            />
          </section>

          <section aria-labelledby="acces">
            <h2 id="acces" className="mb-2 text-lg font-semibold">Accès à l&apos;application</h2>
            <Card className="flex flex-col gap-3 shadow-card">
              <p className="flex items-start gap-2 text-sm text-muted">
                <KeyRound aria-hidden className="mt-0.5 size-5 shrink-0 text-royal" />
                {hasAccount
                  ? `${person.first_name} a un compte. En cas d'oubli, donnez-lui un nouveau mot de passe.`
                  : phone
                    ? `${person.first_name} se connectera avec le ${formatPhone(phone)} et un mot de passe de départ, qu'il ou elle changera dans son Profil.`
                    : "Ajoutez d'abord un numéro de téléphone dans la fiche pour créer un accès."}
              </p>
              {(hasAccount || phone) && (
                <ActionForm
                  action={hasAccount ? resetPassword : createAccount}
                  hidden={{ person_id: id }}
                  submitLabel={hasAccount ? "Nouveau mot de passe" : "Créer son accès"}
                />
              )}
            </Card>
          </section>

          {hasAny(access, ["groups.manage"]) && (
            <section aria-labelledby="famille">
              <h2 id="famille" className="mb-2 text-lg font-semibold">Famille</h2>
              <Card className="shadow-card">
                <ActionForm action={transferFamily} hidden={{ person_id: id }} submitLabel="Enregistrer">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold">Rattacher à une famille</span>
                    <select
                      name="family_id"
                      defaultValue={family?.group_id ?? ""}
                      className="min-h-13 rounded-2xl border-2 border-line bg-surface px-3 text-base focus:border-royal"
                    >
                      <option value="">Sans famille</option>
                      {families.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-sm text-muted">
                    Un changement de famille est gardé dans l&apos;historique.
                  </p>
                </ActionForm>
              </Card>
            </section>
          )}
        </>
      ) : (
        <Card className="flex flex-col gap-1 shadow-card">
          {[
            ["Quartier", [person.district, person.commune].filter(Boolean).join(", ")],
            ["Repère", person.landmark],
            ["Arrivé(e) le", person.arrived_at],
          ]
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <p key={label}>
                <span className="text-sm text-muted">{label} : </span>
                <span className="font-semibold">{value}</span>
              </p>
            ))}
        </Card>
      )}
      <DoneLink href="/fideles" label="Terminer et revenir à la liste" />
    </div>
  );
}
