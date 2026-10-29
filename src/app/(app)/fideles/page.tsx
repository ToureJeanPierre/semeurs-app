import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PeopleList, type PeopleRow } from "@/components/people/PeopleList";
import { redirect } from "next/navigation";
import { getAccess, hasAny } from "@/lib/access";
import { personName } from "@/lib/admin";
import { formatPhone, parseIvorianPhone } from "@/lib/phone";
import { signPhotos } from "@/lib/photos";
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
  photo_path: string | null;
  group_memberships: { end_date: string | null; groups: { name: string; group_types: { slug: string } | null } | null }[];
};

export default async function PeoplePage({ searchParams }: PageProps<"/fideles">) {
  const removed = (await searchParams).supprime === "1";
  // Rôle d'église : tout le registre ; père de famille, délégué… : seulement ses fidèles (RLS).
  const access = await getAccess();
  if (!hasAny(access, ["people.view"], "any")) redirect("/");
  const wholeChurch = hasAny(access, ["people.view"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("people")
    .select("id, first_name, last_name, phone, photo_path, commune, district, status, group_memberships(end_date, groups(name, group_types(slug)))")
    .is("deleted_at", null)
    .order("last_name")
    .order("first_name");

  const photos = await signPhotos(((data ?? []) as unknown as Row[]).map((p) => p.photo_path));
  const rows: PeopleRow[] = ((data ?? []) as unknown as Row[]).map((p) => {
    const phone = p.phone ? parseIvorianPhone(p.phone) : null;
    const family = p.group_memberships.find((m) => !m.end_date && m.groups?.group_types?.slug === "family");
    return {
      id: p.id,
      name: personName(p),
      detail: [phone ? formatPhone(phone) : null, p.district ?? p.commune].filter(Boolean).join(" · "),
      family: family?.groups?.name ?? null,
      phone: phone?.e164 ?? null,
      photo: p.photo_path ? (photos.get(p.photo_path) ?? null) : null,
      status: p.status,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle
        title="Fidèles"
        intro={wholeChurch ? "Le registre de l'église." : "Les fidèles que vous suivez."}
      />
      {hasAny(access, ["people.manage"]) && (
        <Link
          href="/fideles/nouveau"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-royal px-5 font-semibold text-white shadow-card"
        >
          <UserPlus aria-hidden className="size-5" />
          Nouvelle fiche
        </Link>
      )}
      {removed && (
        <p role="status" className="rounded-2xl bg-ok-bg px-4 py-3 font-medium text-ok-text">
          Fiche supprimée de la liste. Son historique est conservé.
        </p>
      )}
      <PeopleList rows={rows} />
    </div>
  );
}
