import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentHeader } from "@/components/contributions/ReceiptHeader";
import { Card } from "@/components/ui/Card";
import { PrintButton } from "@/components/ui/PrintButton";
import { getAccess } from "@/lib/access";
import { personName } from "@/lib/admin";
import { formatFullDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Attestation de formation" };

/** Attestation numérotée, délivrée quand toutes les leçons sont validées (imprimable / PDF). */
export default async function TrainingCertificatePage({ params, searchParams }: PageProps<"/formations/[id]/attestation">) {
  const { id } = await params;
  const access = await getAccess();
  const personId = String((await searchParams).personne ?? access.personId ?? "");
  const supabase = await createClient();
  const [{ data: e }, { data: profile }] = await Promise.all([
    supabase
      .from("training_enrollments")
      .select("completed_on, certificate_no, trainings(title), people(first_name, last_name)")
      .eq("training_id", id)
      .eq("person_id", personId)
      .maybeSingle(),
    supabase.from("settings").select("value").eq("key", "church_profile").maybeSingle(),
  ]);
  const row = e as unknown as {
    completed_on: string | null;
    certificate_no: string | null;
    trainings: { title: string } | null;
    people: { first_name: string; last_name: string } | null;
  } | null;
  if (!row?.completed_on || !row.people) notFound();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-5 print:max-w-none print:p-0">
      <Card className="flex flex-col gap-4 text-center shadow-card print:shadow-none">
        <DocumentHeader profile={(profile?.value ?? {}) as object} />
        <h1 className="font-display text-2xl font-extrabold">Attestation de formation</h1>
        <p className="text-sm text-muted">N° {row.certificate_no}</p>
        <p>
          L&apos;Église évangélique Les Semeurs de la Parole atteste que
          <span className="mt-2 block font-display text-xl font-bold text-royal">{personName(row.people)}</span>
          a suivi avec succès la formation
          <span className="mt-2 block font-semibold">« {row.trainings?.title} »</span>
        </p>
        <p className="text-sm text-muted">Fait à Abidjan, le {formatFullDate(row.completed_on)}.</p>
        <p className="mt-6 text-sm">Le Pasteur</p>
      </Card>
      <PrintButton />
    </div>
  );
}
