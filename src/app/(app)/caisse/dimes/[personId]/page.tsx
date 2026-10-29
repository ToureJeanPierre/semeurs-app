import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TitheCertificate } from "@/components/cash/TitheCertificate";
import { requirePermission } from "@/lib/access";
import { personName } from "@/lib/admin";
import { todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Attestation de dons" };

export default async function PersonCertificatePage({ params, searchParams }: PageProps<"/caisse/dimes/[personId]">) {
  await requirePermission("cash.view", "cash.manage");
  const { personId } = await params;
  const year = Number((await searchParams).annee) || Number(todayIso().slice(0, 4));
  const supabase = await createClient();
  const { data: p } = await supabase.from("people").select("first_name, last_name").eq("id", personId).maybeSingle();
  if (!p) notFound();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-5 print:max-w-none print:p-0">
      <TitheCertificate personId={personId} name={personName(p)} year={year} />
    </div>
  );
}
