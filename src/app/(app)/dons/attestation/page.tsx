import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TitheCertificate } from "@/components/cash/TitheCertificate";
import { getAccess } from "@/lib/access";
import { personName } from "@/lib/admin";
import { todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mon attestation de dons" };

export default async function MyCertificatePage({ searchParams }: PageProps<"/dons/attestation">) {
  const access = await getAccess();
  if (!access.personId) redirect("/dons");
  const year = Number((await searchParams).annee) || Number(todayIso().slice(0, 4));
  const supabase = await createClient();
  const { data: p } = await supabase.from("people").select("first_name, last_name").eq("id", access.personId).maybeSingle();
  if (!p) redirect("/dons");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-5 print:max-w-none print:p-0">
      <TitheCertificate personId={access.personId} name={personName(p)} year={year} />
    </div>
  );
}
