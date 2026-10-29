import type { Metadata } from "next";
import Link from "next/link";
import { Award } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ListItem } from "@/components/ui/ListItem";
import { moduleImage } from "@/lib/navigation";
import { LessonBar } from "@/components/trainings/LessonBar";
import { ActionForm } from "@/components/people/ActionForm";
import { SelectField, TextAreaField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { createTraining, enroll } from "./actions";

export const metadata: Metadata = { title: "Formations" };

type Training = {
  id: string;
  title: string;
  description: string | null;
  group_id: string | null;
  groups: { name: string } | null;
  training_lessons: { id: string }[];
  training_enrollments: { person_id: string; completed_on: string | null }[];
};

/** Formations et parcours : chacun voit les siennes et peut s'inscrire ; les responsables les créent. */
export default async function TrainingsPage() {
  const access = await getAccess();
  const supabase = await createClient();
  const [{ data }, { data: myGroups }, { data: steps }, { data: progress }] = await Promise.all([
    supabase
      .from("trainings")
      .select("id, title, description, group_id, groups(name), training_lessons(id), training_enrollments(person_id, completed_on)")
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase.rpc("my_groups_with", { p_permission: "groups.manage" }),
    supabase.from("integration_steps").select("code, label").eq("active", true).order("position"),
    supabase.from("lesson_progress").select("lesson_id").eq("person_id", access.personId ?? ""),
  ]);
  const trainings = (data ?? []) as unknown as Training[];
  const churchManager = hasAny(access, ["trainings.manage"]);
  const groups = (myGroups ?? []) as { id: string; name: string }[];
  const canCreate = churchManager || groups.length > 0;
  const done = new Set((progress ?? []).map((p) => p.lesson_id));
  const art = await moduleImage("trainings");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Formations" intro="Parcours des nouveaux convertis, école des disciples, formations d'équipe." />

      {trainings.length === 0 && <p className="rounded-2xl bg-cloud p-4 text-sm text-muted">Aucune formation pour l&apos;instant.</p>}
      {trainings.map((t) => {
        const mine = t.training_enrollments.find((e) => e.person_id === access.personId);
        const myDone = t.training_lessons.filter((l) => done.has(l.id)).length;
        return (
          <ListItem
            key={t.id}
            title={<Link href={`/formations/${t.id}`}>{t.title}</Link>}
            tone="royal"
            image={art}
            icon="graduation-cap"
            badge={mine ? (mine.completed_on ? "Terminée" : "Inscrit(e)") : undefined}
            meta={[
              { icon: "clock", text: `${t.training_lessons.length} leçon${t.training_lessons.length > 1 ? "s" : ""} · ${t.training_enrollments.length} inscrit${t.training_enrollments.length > 1 ? "s" : ""}` },
              ...(t.groups ? [{ icon: "person" as const, text: t.groups.name }] : []),
            ]}
          >
            {t.description && <p className="text-sm text-muted">{t.description}</p>}
            {mine ? (
              mine.completed_on ? (
                <Link href={`/formations/${t.id}/attestation`} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-gold font-semibold text-night">
                  <Award aria-hidden className="size-5" /> Mon attestation
                </Link>
              ) : (
                <LessonBar done={myDone} total={t.training_lessons.length} />
              )
            ) : (
              access.personId && <ActionForm action={enroll} hidden={{ training_id: t.id }} submitLabel="Je m'inscris" />
            )}
            <Link href={`/formations/${t.id}`} className="flex min-h-11 items-center justify-center rounded-full bg-royal/10 text-sm font-semibold text-royal">
              Voir les leçons
            </Link>
          </ListItem>
        );
      })}

      {canCreate && (
        <details className="rounded-card bg-surface px-4 shadow-card">
          <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-royal">Créer une formation</summary>
          <ActionForm action={createTraining} submitLabel="Créer" variant="primary" className="flex flex-col gap-3 pb-4">
            <TextField label="Titre" name="title" required />
            <TextAreaField label="Présentation" name="description" />
            <SelectField
              label="Pour"
              name="group_id"
              options={[...(churchManager ? [{ value: "", label: "Toute l'église" }] : []), ...groups.map((g) => ({ value: g.id, label: g.name }))]}
            />
            <SelectField
              label="À la fin, cocher l'étape du parcours"
              name="integration_step_code"
              options={[{ value: "", label: "Aucune" }, ...(steps ?? []).map((s) => ({ value: s.code, label: s.label }))]}
            />
          </ActionForm>
        </details>
      )}
    </div>
  );
}

