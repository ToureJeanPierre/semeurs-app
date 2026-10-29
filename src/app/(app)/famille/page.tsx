import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, UserCheck, XCircle } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import type { PersonOption } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { Barometer } from "@/components/alerts/Barometer";
import { Birthdays } from "@/components/alerts/Birthdays";
import { daysUntilBirthday } from "@/lib/birthdays";
import { ContactList, type ContactRow } from "@/components/alerts/ContactList";
import { MemberFamily } from "@/components/people/MemberFamily";
import { ChatEntry } from "@/components/groups/ChatEntry";
import { ContactPickerButton } from "@/components/people/ContactPickerButton";
import { DelegationForm } from "@/components/people/DelegationForm";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { getAccess } from "@/lib/access";
import { personName } from "@/lib/admin";
import { barometer, byUrgency, needsContact, type AlertRow } from "@/lib/alerts";
import { ABSENCE_FALLBACK, loadMessageTemplate } from "@/lib/message-templates";
import { formatPhone, parseIvorianPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { addPersonToGroup, createDelegation, endDelegation } from "../fideles/actions";

export const metadata: Metadata = { title: "Ma famille" };

type Person = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  whatsapp?: string | null;
  district: string | null;
  commune: string | null;
  birth_date?: string | null;
};
type Member = { person_id: string; group_functions: { label: string; permissions: string[] } | null; people: Person | null };
type Delegation = {
  id: string;
  label: string | null;
  family_id: string;
  delegate_id: string;
  delegate: { first_name: string; last_name: string } | null;
  delegation_members: { people: Person | null }[];
};

function option(p: Person): PersonOption {
  const phone = p.phone ? parseIvorianPhone(p.phone) : null;
  return {
    id: p.id,
    name: personName(p),
    detail: [phone ? formatPhone(phone) : null, p.district ?? p.commune].filter(Boolean).join(" · ") || null,
  };
}

function PersonLink({ person, note }: { person: Person; note?: string }) {
  const o = option(person);
  return (
    <Link href={`/fideles/${person.id}`} className="flex min-h-14 items-center gap-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{o.name}</span>
        <span className="block truncate text-sm text-muted">{[note, o.detail].filter(Boolean).join(" · ") || "—"}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
    </Link>
  );
}

const SEX = [
  ["M", "Homme"],
  ["F", "Femme"],
];

export default async function FamilyPage() {
  const access = await getAccess();
  const supabase = await createClient();

  // Familles où j'ai une fonction donnant accès aux fiches (père, mère, adjoint…).
  const { data: mine } = await supabase
    .from("group_memberships")
    .select("group_id, group_functions!inner(permissions), groups!inner(id, name, group_types!inner(slug))")
    .eq("person_id", access.personId ?? "")
    .is("end_date", null)
    .eq("groups.group_types.slug", "family")
    .contains("group_functions.permissions", ["people.view"]);
  const families = (mine ?? []).map((m) => {
    const g = m.groups as unknown as { id: string; name: string };
    const f = m.group_functions as unknown as { permissions: string[] };
    return { id: g.id, name: g.name, canManage: f.permissions.includes("people.manage") };
  });

  const [membersRes, delegationsRes, myDelegationsRes] = await Promise.all([
    supabase
      .from("group_memberships")
      .select("group_id, person_id, group_functions(label, permissions), people(id, first_name, last_name, phone, whatsapp, district, commune, birth_date)")
      .in("group_id", families.map((f) => f.id))
      .is("end_date", null),
    supabase
      .from("delegations")
      .select("id, label, family_id, delegate_id, delegate:people!delegations_delegate_id_fkey(first_name, last_name), delegation_members(people(id, first_name, last_name, phone, whatsapp, district, commune))")
      .in("family_id", families.map((f) => f.id))
      .is("end_date", null),
    supabase
      .from("delegations")
      .select("id, label, family_id, delegate_id, groups(name), delegation_members(people(id, first_name, last_name, phone, whatsapp, district, commune))")
      .eq("delegate_id", access.personId ?? "")
      .is("end_date", null),
  ]);
  const members = (membersRes.data ?? []) as unknown as (Member & { group_id: string })[];
  const followed = [
    ...members.map((m) => m.person_id),
    ...((myDelegationsRes.data ?? []) as unknown as Delegation[]).flatMap((d) => d.delegation_members.map((x) => x.people?.id ?? "")),
  ].filter(Boolean);
  const { data: alertRows } = await supabase
    .from("alerts")
    .select("person_id, level, days_absent, last_presence_on, status")
    .in("person_id", followed);
  const [birthdayTemplate, absenceTemplate] = await Promise.all([
    loadMessageTemplate("birthday", "Joyeux anniversaire {prénom} !"),
    loadMessageTemplate("absence_followup", ABSENCE_FALLBACK),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const birthdaysOf = (people: Person[]) =>
    people
      .filter((p) => p.birth_date)
      .map((p) => ({ id: p.id, firstName: p.first_name, name: personName(p), inDays: daysUntilBirthday(p.birth_date!, today), phone: p.phone }))
      .filter((b) => b.inDays <= 7)
      .sort((a, b) => a.inDays - b.inDays);
  const alerts = new Map(((alertRows ?? []) as AlertRow[]).map((a) => [a.person_id, a]));
  const toContact = (people: Person[]): ContactRow[] =>
    people
      .map((p) => ({ p, a: alerts.get(p.id) }))
      .filter(({ a }) => a && needsContact(a.level))
      .map(({ p, a }) => ({
        person_id: p.id,
        name: personName(p),
        firstName: p.first_name,
        level: a!.level,
        days_absent: a!.days_absent,
        treated: a!.status === "treated",
        phone: p.phone,
        whatsapp: p.whatsapp,
      }))
      .sort(byUrgency);
  const delegations = (delegationsRes.data ?? []) as unknown as Delegation[];
  const myDelegations = (myDelegationsRes.data ?? []) as unknown as (Delegation & { groups: { name: string } | null })[];

  if (families.length === 0 && myDelegations.length === 0) {
    // Simple membre : sa famille, en lecture (noms, et le contact du père / de la mère).
    return <MemberFamily />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-4 pb-8 pt-5">
      {families.map((family) => {
        const list = members
          .filter((m) => m.group_id === family.id && m.people)
          .sort((a, b) => personName(a.people!).localeCompare(personName(b.people!), "fr"));
        const familyDelegations = delegations.filter((d) => d.family_id === family.id);
        return (
          <section key={family.id} aria-labelledby={`f-${family.id}`} className="flex flex-col gap-4">
            <PageTitle title={family.name} intro={`${list.length} membre${list.length > 1 ? "s" : ""}`} />
            <ChatEntry groupId={family.id} label="Discussion de la famille" />

            <Barometer
              {...barometer(list.map((m) => alerts.get(m.person_id)?.level ?? "ok"))}
            />
            <h3 className="font-display text-lg font-semibold">À contacter</h3>
            <ContactList
              rows={toContact(list.map((m) => m.people!))}
              empty="Aucun absent cette semaine. Merci pour votre fidélité au suivi."
              template={absenceTemplate}
            />
            <Birthdays rows={birthdaysOf(list.map((m) => m.people!))} template={birthdayTemplate} />
            <h3 className="font-display text-lg font-semibold">Toute la famille</h3>

            <ul className="flex flex-col divide-y divide-line rounded-card bg-surface px-4 shadow-card">
              {list.map((m) => (
                <li key={m.person_id}>
                  <PersonLink person={m.people!} note={m.group_functions?.label} />
                </li>
              ))}
            </ul>

            {family.canManage && (
              <Card className="shadow-card">
                <h3 className="mb-3 font-display text-lg font-semibold">Inscrire un nouveau membre</h3>
                <ActionForm action={addPersonToGroup} hidden={{ group_id: family.id }} submitLabel="Inscrire dans la famille">
                  <ContactPickerButton />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Nom" name="last_name" autoComplete="off" />
                    <TextField label="Prénom(s)" name="first_name" autoComplete="off" />
                  </div>
                  <div className="flex gap-3">
                    {SEX.map(([value, label]) => (
                      <label
                        key={value}
                        className="flex min-h-12 flex-1 cursor-pointer items-center gap-2 rounded-2xl border-2 border-line bg-surface px-4 has-checked:border-royal has-checked:bg-royal/5"
                      >
                        <input type="radio" name="sex" value={value} className="size-5 accent-royal" />
                        <span className="font-semibold">{label}</span>
                      </label>
                    ))}
                  </div>
                  <TextField label="Téléphone (facultatif)" name="phone" type="tel" inputMode="tel" prefix="+225" />
                </ActionForm>
              </Card>
            )}

            <div className="flex flex-col gap-3">
              <h3 className="font-display text-lg font-semibold">Délégation du suivi</h3>
              {familyDelegations.length === 0 && (
                <p className="text-sm text-muted">Aucune délégation. Vous suivez vous-même tous les membres.</p>
              )}
              {familyDelegations.map((d) => (
                <Card key={d.id} className="flex flex-col gap-2 shadow-card">
                  <div className="flex items-start gap-3">
                    <UserCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-royal" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {d.delegate ? personName(d.delegate) : "Délégué"}
                        {d.label ? ` · ${d.label}` : ""}
                      </p>
                      <p className="text-sm text-muted">
                        {d.delegation_members.map((x) => (x.people ? personName(x.people) : "")).join(", ")}
                      </p>
                    </div>
                    {family.canManage && (
                      <form action={endDelegation}>
                        <input type="hidden" name="delegation_id" value={d.id} />
                        <button
                          type="submit"
                          className="grid size-11 place-items-center rounded-full text-alert-text hover:bg-alert-bg"
                          aria-label="Mettre fin à cette délégation"
                        >
                          <XCircle aria-hidden className="size-5" />
                        </button>
                      </form>
                    )}
                  </div>
                </Card>
              ))}
              {family.canManage && list.length > 1 && (
                <Card className="shadow-card">
                  <h4 className="mb-3 font-semibold">Confier des fidèles à un délégué</h4>
                  <DelegationForm
                    action={createDelegation}
                    familyId={family.id}
                    members={list.filter((m) => !m.group_functions).map((m) => option(m.people!))}
                  />
                </Card>
              )}
            </div>
          </section>
        );
      })}

      {myDelegations.map((d) => (
        <section key={d.id} aria-labelledby={`d-${d.id}`} className="flex flex-col gap-3">
          <PageTitle
            title={`Fidèles qui me sont confiés${d.label ? ` · ${d.label}` : ""}`}
            intro={d.groups?.name ?? undefined}
          />
          <ContactList
            rows={toContact(d.delegation_members.filter((x) => x.people).map((x) => x.people!))}
            empty="Aucun absent parmi les fidèles qui vous sont confiés."
            template={absenceTemplate}
          />
          <ul className="flex flex-col divide-y divide-line rounded-card bg-surface px-4 shadow-card">
            {d.delegation_members
              .filter((x) => x.people)
              .map((x) => (
                <li key={x.people!.id}>
                  <PersonLink person={x.people!} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
