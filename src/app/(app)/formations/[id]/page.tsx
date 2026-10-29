import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Check, ExternalLink, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { LessonBar } from "@/components/trainings/LessonBar";
import { Card } from "@/components/ui/Card";
import { TextAreaField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { loadPeopleOptions, personName } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { addLesson, archiveTraining, deleteLesson, enroll, toggleLesson } from "../actions";

export const metadata: Metadata = { title: "Formation" };

type Enrollment = {
  person_id: string;
  completed_on: string | null;
  certificate_no: string | null;
  people: { first_name: string; last_name: string } | null;
};

/** Une formation : leçons, inscrits et grille de validation (responsable) ou ma progression (participant). */
export default async function TrainingPage({ params }: PageProps<"/formations/[id]">) {
  const { id } = await params;
  const access = await getAccess();
  const supabase = await createClient();
  const [{ data: t }, { data: lessons }, { data: enrollments }, { data: myGroups }] = await Promise.all([
    supabase.from("trainings").select("id, title, description, group_id, active").eq("id", id).maybeSingle(),
    supabase.from("training_lessons").select("id, title, content, resource_url, position").eq("training_id", id).order("position"),
    supabase.from("training_enrollments").select("person_id, completed_on, certificate_no, people(first_name, last_name)").eq("training_id", id),
    supabase.rpc("my_groups_with", { p_permission: "groups.manage" }),
  ]);
  if (!t) notFound();
  const manager =
    hasAny(access, ["trainings.manage"]) || (!!t.group_id && ((myGroups ?? []) as { id: string }[]).some((g) => g.id === t.group_id));
  const list = (lessons ?? []) as { id: string; title: string; content: string | null; resource_url: string | null }[];
  const enrolled = ((enrollments ?? []) as unknown as Enrollment[]).sort((a, b) =>
    (a.people?.last_name ?? "").localeCompare(b.people?.last_name ?? ""),
  );
  const lessonIds = list.map((l) => l.id);
  const { data: progress } = lessonIds.length
    ? await supabase.from("lesson_progress").select("lesson_id, person_id").in("lesson_id", lessonIds)
    : { data: [] };
  const done = new Set((progress ?? []).map((p) => `${p.lesson_id}:${p.person_id}`));
  const me = enrolled.find((e) => e.person_id === access.personId);
  const people = manager ? await loadPeopleOptions() : [];
  const enrolledIds = new Set(enrolled.map((e) => e.person_id));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title={t.title} intro={t.description ?? undefined} />

      {me && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="font-semibold">Ma progression</h2>
          <LessonBar done={list.filter((l) => done.has(`${l.id}:${me.person_id}`)).length} total={list.length} />
          {me.completed_on && (
            <Link href={`/formations/${id}/attestation`} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-gold font-semibold text-night">
              <Award aria-hidden className="size-5" /> Mon attestation
            </Link>
          )}
        </Card>
      )}
      {!me && access.personId && t.active && <ActionForm action={enroll} hidden={{ training_id: id }} submitLabel="Je m'inscris" variant="primary" />}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Leçons</h2>
        {list.length === 0 && <p className="text-sm text-muted">Aucune leçon pour l&apos;instant.</p>}
        <ol className="flex flex-col gap-2">
          {list.map((l, i) => (
            <li key={l.id}>
              <Card className="flex flex-col gap-1 shadow-card">
                <div className="flex items-start gap-2 font-semibold">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-royal/10 text-sm text-royal">{i + 1}</span>
                  <span className="flex-1">{l.title}</span>
                  {me && done.has(`${l.id}:${me.person_id}`) && <Check aria-label="validée" className="size-5 text-ok-text" />}
                  {manager && (
                    <form action={deleteLesson}>
                      <input type="hidden" name="lesson_id" value={l.id} />
                      <input type="hidden" name="training_id" value={id} />
                      <SubmitButton className="grid size-11 place-items-center rounded-full text-muted" aria-label="Supprimer la leçon">
                        <Trash2 aria-hidden className="size-4" />
                      </SubmitButton>
                    </form>
                  )}
                </div>
                {l.content && <p className="whitespace-pre-line text-sm text-muted">{l.content}</p>}
                {l.resource_url && (
                  <a href={l.resource_url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-1 text-sm font-semibold text-royal">
                    <ExternalLink aria-hidden className="size-4" /> Support de la leçon
                  </a>
                )}
              </Card>
            </li>
          ))}
        </ol>
        {manager && (
          <details className="rounded-card bg-surface px-4 shadow-card">
            <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-royal">Ajouter une leçon</summary>
            <ActionForm action={addLesson} hidden={{ training_id: id }} submitLabel="Ajouter" className="flex flex-col gap-3 pb-4">
              <TextField label="Titre" name="title" required />
              <TextAreaField label="Contenu (facultatif)" name="content" />
              <TextField label="Lien vers un support (https://…)" name="resource_url" inputMode="url" />
            </ActionForm>
          </details>
        )}
      </section>

      {manager && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Participants ({enrolled.length})</h2>
          <p className="text-sm text-muted">Touchez un numéro pour valider (ou retirer) la leçon. Toutes validées : l&apos;attestation est délivrée.</p>
          {enrolled.map((e) => (
            <Card key={e.person_id} className="flex flex-col gap-2 shadow-card">
              <p className="flex items-center justify-between gap-2">
                <span className="font-semibold">{e.people ? personName(e.people) : ""}</span>
                {e.completed_on && (
                  <Link href={`/formations/${id}/attestation?personne=${e.person_id}`} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-royal">
                    <Award aria-hidden className="size-4" /> {e.certificate_no}
                  </Link>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {list.map((l, i) => {
                  const ok = done.has(`${l.id}:${e.person_id}`);
                  return (
                    <form key={l.id} action={toggleLesson}>
                      <input type="hidden" name="lesson_id" value={l.id} />
                      <input type="hidden" name="person_id" value={e.person_id} />
                      <input type="hidden" name="training_id" value={id} />
                      <input type="hidden" name="done" value={ok ? "0" : "1"} />
                      <SubmitButton
                        className={`grid size-11 place-items-center rounded-full font-semibold ${ok ? "bg-ok-ring text-white" : "bg-cloud text-ink"}`}
                        aria-label={`${l.title} : ${ok ? "validée, retirer" : "valider"}`}
                      >
                        {i + 1}
                      </SubmitButton>
                    </form>
                  );
                })}
              </div>
            </Card>
          ))}
          <details className="rounded-card bg-surface px-4 shadow-card">
            <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-royal">Inscrire une personne</summary>
            <ActionForm action={enroll} hidden={{ training_id: id }} submitLabel="Inscrire" className="flex flex-col gap-3 pb-4">
              <PersonPicker name="person_id" label="Personne" people={people.filter((p) => !enrolledIds.has(p.id))} />
            </ActionForm>
          </details>
          {t.active && (
            <form action={archiveTraining}>
              <input type="hidden" name="training_id" value={id} />
              <SubmitButton className="min-h-11 w-full rounded-full text-sm font-semibold text-muted">Archiver cette formation</SubmitButton>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
