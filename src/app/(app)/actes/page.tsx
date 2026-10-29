import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { TextAreaField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { loadPeopleOptions, personName } from "@/lib/admin";
import { formatFullDate, todayIso } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { createAct } from "./actions";

export const metadata: Metadata = { title: "Registre des actes" };

/** Personnes à choisir pour chaque type d'acte (l'ordre compte : il suit celui de la base). */
const FIELDS: Record<string, { name: string; label: string }[]> = {
  baptism: [{ name: "p1", label: "Personne baptisée" }],
  wedding: [
    { name: "p1", label: "Époux" },
    { name: "p2", label: "Épouse" },
  ],
  child_presentation: [
    { name: "p1", label: "Enfant" },
    { name: "p2", label: "Père (facultatif)" },
    { name: "p3", label: "Mère (facultatif)" },
  ],
};

/** Registre des baptêmes, mariages et présentations d'enfants ; chaque acte a son certificat numéroté. */
export default async function ActsPage({ searchParams }: PageProps<"/actes">) {
  const filter = String((await searchParams).type ?? "");
  const access = await getAccess();
  const manager = hasAny(access, ["acts.manage"]);
  const supabase = await createClient();
  let query = supabase.from("acts").select("id, kind, act_date, person_ids, certificate_no").order("act_date", { ascending: false }).limit(100);
  if (filter) query = query.eq("kind", filter);
  const [{ data: acts }, kinds, people] = await Promise.all([query, loadValueList("act_kind"), manager ? loadPeopleOptions() : Promise.resolve([])]);
  const allIds = [...new Set((acts ?? []).flatMap((a) => a.person_ids as string[]))];
  const { data: names } = allIds.length ? await supabase.from("people").select("id, first_name, last_name").in("id", allIds) : { data: [] };
  const nameOf = (id: string) => {
    const p = (names ?? []).find((n) => n.id === id);
    return p ? personName(p) : "—";
  };
  const label = (k: string) => kinds.find((x) => x.value === k)?.label ?? k;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Registre des actes" intro="Baptêmes, mariages, présentations d'enfants. Le numéro de certificat est donné automatiquement." />

      <nav className="flex flex-wrap gap-2 text-sm font-semibold" aria-label="Filtrer">
        {[{ value: "", label: "Tous" }, ...kinds].map((k) => (
          <Link
            key={k.value}
            href={k.value ? `/actes?type=${k.value}` : "/actes"}
            className={`flex min-h-11 items-center rounded-full px-4 ${filter === k.value ? "bg-royal text-white" : "bg-surface text-royal shadow-card"}`}
          >
            {k.label}
          </Link>
        ))}
      </nav>

      {manager &&
        kinds
          .filter((k) => FIELDS[k.value])
          .map((k) => (
            <details key={k.value} className="rounded-card bg-surface px-4 shadow-card">
              <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-royal">Enregistrer : {k.label.toLowerCase()}</summary>
              <ActionForm action={createAct} hidden={{ kind: k.value }} submitLabel="Enregistrer l'acte" variant="primary" className="flex flex-col gap-3 pb-4">
                {FIELDS[k.value].map((f) => (
                  <PersonPicker key={f.name} name={f.name} label={f.label} people={people} />
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Date" name="act_date" type="date" defaultValue={todayIso()} required />
                  <TextField label="Lieu" name="place" />
                </div>
                <PersonPicker name="officiant_id" label="Officiant (membre)" people={people} />
                <TextField label="…ou officiant extérieur" name="officiant_name" />
                <TextField label="Témoins" name="witnesses" />
                <TextAreaField label="Notes" name="notes" />
              </ActionForm>
            </details>
          ))}

      {(acts ?? []).length === 0 && <p className="rounded-2xl bg-cloud p-4 text-sm text-muted">Aucun acte enregistré.</p>}
      <ul className="flex flex-col gap-2">
        {(acts ?? []).map((a) => (
          <li key={a.id}>
            <Link href={`/actes/${a.id}`}>
              <Card className="flex items-center gap-3 shadow-card">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold/20 text-night">
                  <ScrollText aria-hidden className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {label(a.kind)} · {(a.person_ids as string[]).slice(0, a.kind === "wedding" ? 2 : 1).map(nameOf).join(" et ")}
                  </span>
                  <span className="block text-sm text-muted">
                    {formatFullDate(a.act_date)} · n° {a.certificate_no}
                  </span>
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
