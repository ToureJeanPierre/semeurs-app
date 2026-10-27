import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PeopleList, type PeopleRow } from "@/components/people/PeopleList";
import { redirect } from "next/navigation";
import { getAccess, hasAny } from "@/lib/access";
import { personName } from "@/lib/admin";
import { formatPhone, parseIvorianPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Fidèles" };

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  commune: string | null;
  district: string | null;
  status: string;
  group_memberships: { end_date: string | null; groups: { name: string; group_types: { slug: string } | null } | null }[];
};

export default async function PeoplePage() {
  // Rôle d'église : tout le registre ; père de famille, délégué… : seulement ses fidèles (RLS).
  const access = await getAccess();
  if (!hasAny(access, ["people.view"], "any")) redirect("/");
  const wholeChurch = hasAny(access, ["people.view"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("people")
    .select("id, first_name, last_name, phone, commune, district, status, group_memberships(end_date, groups(name, group_types(slug)))")
    .order("last_name")
    .order("first_name");

  const rows: PeopleRow[] = ((data ?? []) as unknown as Row[]).map((p) => {
    const phone = p.phone ? parseIvorianPhone(p.phone) : null;
    const family = p.group_memberships.find((m) => !m.end_date && m.groups?.group_types?.slug === "family");
    return {
      id: p.id,
      name: personName(p),
      detail: [phone ? formatPhone(phone) : null, p.district ?? p.commune].filter(Boolean).join(" · "),
      family: family?.groups?.name ?? null,
      status: p.status,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <div className="flex items-start justify-between gap-3">
        <PageTitle
          title="Fidèles"
          intro={wholeChurch ? "Le registre de l'église." : "Les fidèles que vous suivez."}
        />
        {hasAny(access, ["people.manage"]) && (
          <Link
            href="/fideles/nouveau"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-royal px-4 text-sm font-semibold text-white"
          >
            <UserPlus aria-hidden className="size-4" />
            Nouvelle fiche
          </Link>
        )}
      </div>
      <PeopleList rows={rows} />
    </div>
  );
}
