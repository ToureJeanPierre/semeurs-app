import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentHeader } from "@/components/contributions/ReceiptHeader";
import { Card } from "@/components/ui/Card";
import { PrintButton } from "@/components/ui/PrintButton";
import { personName } from "@/lib/admin";
import { formatFullDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Certificat" };

const TITLE: Record<string, string> = {
  baptism: "Certificat de baptême",
  wedding: "Certificat de mariage religieux",
  child_presentation: "Certificat de présentation d'enfant",
};

/** Certificat imprimable d'un acte (baptême, mariage, présentation d'enfant). */
export default async function ActCertificatePage({ params }: PageProps<"/actes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: act }, { data: profile }] = await Promise.all([
    supabase.from("acts").select("*, officiant:people!acts_officiant_id_fkey(first_name, last_name)").eq("id", id).maybeSingle(),
    supabase.from("settings").select("value").eq("key", "church_profile").maybeSingle(),
  ]);
  if (!act) notFound();
  const ids = act.person_ids as string[];
  const { data: people } = await supabase.from("people").select("id, first_name, last_name, birth_date").in("id", ids);
  const p = ids.map((pid) => (people ?? []).find((x) => x.id === pid));
  const name = (i: number) => (p[i] ? personName(p[i]) : "");
  const officiant = act.officiant ? personName(act.officiant as { first_name: string; last_name: string }) : act.officiant_name;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-5 print:max-w-none print:p-0">
      <Card className="flex flex-col gap-4 text-center shadow-card print:shadow-none">
        <DocumentHeader profile={(profile?.value ?? {}) as object} />
        <h1 className="font-display text-2xl font-extrabold">{TITLE[act.kind]}</h1>
        <p className="text-sm text-muted">N° {act.certificate_no}</p>
        {act.kind === "baptism" && (
          <p>
            Nous attestons que
            <span className="mt-2 block font-display text-xl font-bold text-royal">{name(0)}</span>
            {p[0]?.birth_date && <span className="block text-sm text-muted">né(e) le {formatFullDate(p[0].birth_date)}</span>}a été baptisé(e) au nom du Père, du Fils et du
            Saint-Esprit,
          </p>
        )}
        {act.kind === "wedding" && (
          <p>
            Nous attestons que
            <span className="mt-2 block font-display text-xl font-bold text-royal">
              {name(0)} et {name(1)}
            </span>
            ont reçu la bénédiction nuptiale devant Dieu et l&apos;Église,
          </p>
        )}
        {act.kind === "child_presentation" && (
          <p>
            Nous attestons que l&apos;enfant
            <span className="mt-2 block font-display text-xl font-bold text-royal">{name(0)}</span>
            {(p[1] || p[2]) && <span className="block">de {[name(1), name(2)].filter(Boolean).join(" et ")},</span>}a été présenté(e) au
            Seigneur,
          </p>
        )}
        <p>
          le {formatFullDate(act.act_date)}
          {act.place ? `, à ${act.place}` : ""}.
        </p>
        {act.witnesses && <p className="text-sm">Témoins : {act.witnesses}</p>}
        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <p>
            L&apos;officiant
            {officiant && <span className="block font-semibold">{officiant}</span>}
          </p>
          <p>Le Pasteur</p>
        </div>
      </Card>
      <PrintButton />
    </div>
  );
}
