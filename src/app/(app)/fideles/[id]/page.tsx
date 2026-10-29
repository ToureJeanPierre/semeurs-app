import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, KeyRound, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ContactButtons } from "@/components/alerts/ContactButtons";
import { PersonFollowUp } from "@/components/alerts/PersonFollowUp";
import { CareNotes } from "@/components/people/CareNotes";
import { PersonHome } from "@/components/location/PersonHome";
import { ActionForm } from "@/components/people/ActionForm";
import { EditToggle } from "@/components/people/EditToggle";
import { PersonFields } from "@/components/people/PersonFields";
import { PersonRelations } from "@/components/people/PersonRelations";
import { Avatar } from "@/components/people/Avatar";
import { PhotoPicker } from "@/components/people/PhotoPicker";
import { signPhotos } from "@/lib/photos";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { DoneLink } from "@/components/ui/DoneLink";
import { ModuleIcon } from "@/components/ui/icons";
import { getAccess, hasAny } from "@/lib/access";
import { loadPeopleOptions, personName } from "@/lib/admin";
import { needsContact } from "@/lib/alerts";
import { fillTemplate } from "@/lib/contact-links";
import { ABSENCE_FALLBACK, loadMessageTemplate } from "@/lib/message-templates";
import { loadFamilies, loadValueList, PERSON_COLUMNS } from "@/lib/people";
import { formatPhone, parseIvorianPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { archivePerson, createAccount, resetPassword, transferFamily, updatePerson } from "../actions";

export const metadata: Metadata = { title: "Fiche" };

const dateFormat = new Intl.DateTimeFormat("fr-CI", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

type Membership = {
  id: string;
  group_id: string;
  groups: { name: string; group_types: { slug: string; name: string; icon: string } | null } | null;
  group_functions: { label: string } | null;
};

export default async function PersonPage({ params, searchParams }: PageProps<"/fideles/[id]">) {
  const { id } = await params;
  const justCreated = (await searchParams).cree === "1";
  const supabase = await createClient();
  // RLS : la fiche n'est renvoyée que si elle est dans le périmètre de la personne connectée.
  const { data: person } = await supabase.from("people").select(`${PERSON_COLUMNS}, photo_path`).eq("id", id).is("deleted_at", null).maybeSingle();
  if (!person) notFound();

  const [access, { data: canManage }, { data: memberships }, statuses, { data: alert }] = await Promise.all([
    getAccess(),
    supabase.rpc("can_manage_person", { target: id }),
    supabase
      .from("group_memberships")
      .select("id, group_id, groups(name, group_types(slug, name, icon)), group_functions(label)")
      .eq("person_id", id)
      .is("end_date", null),
    loadValueList("person_status"),
    supabase.from("alerts").select("level").eq("person_id", id).maybeSingle(),
  ]);
  const groups = (memberships ?? []) as unknown as Membership[];
  const photo = person.photo_path ? (await signPhotos([person.photo_path])).get(person.photo_path) ?? null : null;
  const family = groups.find((m) => m.groups?.group_types?.slug === "family");
  const statusLabel = statuses.find((s) => s.value === person.status)?.label ?? person.status;
  const phone = person.phone ? parseIvorianPhone(person.phone) : null;
  const whatsapp = person.whatsapp ? parseIvorianPhone(person.whatsapp) : phone;
  // Fidèle absent à contacter : le message de prise de nouvelles est déjà écrit.
  const absenceMessage =
    alert && needsContact(alert.level)
      ? fillTemplate(await loadMessageTemplate("absence_followup", ABSENCE_FALLBACK), person.first_name)
      : undefined;

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
      {justCreated && (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-ok-bg px-4 py-3 font-medium text-ok-text">
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          Fiche créée. Il reste, si vous le souhaitez, à créer son accès à l&apos;appli et à la rattacher à une famille.
        </p>
      )}
      <div className="flex flex-col items-center gap-3 text-center">
        {canManage || access.personId === id ? (
          <PhotoPicker personId={id} name={`${person.first_name} ${person.last_name}`} url={photo} size={72} />
        ) : (
          <Avatar name={`${person.first_name} ${person.last_name}`} url={photo} size={72} className="bg-royal text-white" />
        )}
        <div className="min-w-0 [&_h1]:text-center">
          <PageTitle plain title={personName(person)} intro={`${statusLabel} · ${family?.groups?.name ?? "Sans famille"}`} />
        </div>
      </div>

      {phone && (
        <ContactButtons
          large
          name={personName(person)}
          phone={phone.e164}
          whatsapp={whatsapp?.e164}
          message={absenceMessage}
        />
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

      <Card className="flex flex-col gap-1 shadow-card">
        {[
          ["Téléphone", phone ? formatPhone(phone) : null],
          ["Domicile", [person.district, person.commune].filter(Boolean).join(", ")],
          ["Repère", person.landmark],
          ["Né(e) le", person.birth_date ? dateFormat.format(new Date(person.birth_date)) : null],
          ["Arrivé(e) le", person.arrived_at ? dateFormat.format(new Date(person.arrived_at)) : null],
          ["Baptisé(e) le", person.baptized_at ? dateFormat.format(new Date(person.baptized_at)) : null],
        ]
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <p key={label}>
              <span className="text-sm text-muted">{label} : </span>
              <span className="font-semibold">{value}</span>
            </p>
          ))}
        {person.weekday_exempt && <p className="text-sm text-muted">Dispensé(e) des cultes de semaine</p>}
      </Card>

      <PersonFollowUp personId={id} name={personName(person)} canManage={Boolean(canManage)} />
      {hasAny(access, ["care.notes"]) && <CareNotes personId={id} />}

      <PersonHome personId={id} firstName={person.first_name} phone={person.whatsapp ?? person.phone} canManage={Boolean(canManage)} />
      <PersonRelations personId={id} canManage={Boolean(canManage)} people={people} />

      {canManage && (
        <>
          <EditToggle label="Modifier la fiche">
            <PersonFields
              action={updatePerson}
              values={{ ...person, id }}
              people={people.filter((p) => p.id !== id)}
              statuses={statuses}
              maritalStatuses={maritalStatuses}
              unattachedReasons={unattachedReasons}
              showUnattached={!family}
              submitLabel="Enregistrer les modifications"
            />
          </EditToggle>

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
                    <span className="text-sm font-semibold">Famille (choisir « Sans famille » pour l&apos;en retirer)</span>
                    <select
                      name="family_id"
                      defaultValue={family?.group_id ?? ""}
                      className="min-h-13 rounded-2xl border-2 border-line bg-surface px-3 text-base focus:border-ink/40"
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

          {hasAny(access, ["people.manage"]) && access.personId !== id && (
            <details className="rounded-card bg-surface px-4 shadow-card">
              <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-semibold text-alert-text">
                <Trash2 aria-hidden className="size-5" /> Supprimer cette fiche
              </summary>
              <ActionForm action={archivePerson} hidden={{ person_id: id }} submitLabel="Supprimer définitivement de la liste" className="flex flex-col gap-3 pb-4">
                <p className="text-sm text-muted">
                  {person.first_name} disparaîtra de la liste et de ses groupes, et ne pourra plus se connecter. Son historique (cotisations,
                  dons, présences) est conservé : la fiche peut être restaurée sur demande.
                </p>
                <TextField label="Motif" name="reason" placeholder="Doublon, erreur de saisie, départ de l'église…" required />
              </ActionForm>
            </details>
          )}
        </>
      )}
      <DoneLink href="/fideles" label="Terminer et revenir à la liste" />
    </div>
  );
}
