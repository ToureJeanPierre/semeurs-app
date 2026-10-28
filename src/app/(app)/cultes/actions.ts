"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors, optional } from "@/lib/action-helpers";
import { addDays } from "@/lib/format";
import { loadProgramSettings } from "@/lib/program";
import { assignRotation, datesBetween, periodEnd, type PoolDays } from "@/lib/rotation";
import { createClient } from "@/lib/supabase/server";

/**
 * Programme des cultes. Toutes les écritures passent par le client de la personne
 * connectée : la base (RLS « program.manage ») décide qui peut préparer le programme.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date.");

const generateSchema = z.object({
  from: isoDate,
  months: z.coerce.number().int().refine((m) => [1, 2, 3, 4, 5, 6, 12].includes(m), "Durée invalide."),
  redo: z.enum(["on"]).optional(),
});

type ServiceTypeRow = {
  id: string;
  name: string;
  short_name: string | null;
  weekday: number;
  start_time: string;
  end_time: string | null;
  place: string | null;
  positions: string[] | null;
};

/** Crée les cultes de la période (s'ils n'existent pas), puis pourvoit les postes vides par roulement. */
export async function generateProgram(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = generateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const { from, months, redo } = parsed.data;
  const to = periodEnd(from, months);
  const supabase = await createClient();
  const { positions: programPositions } = await loadProgramSettings();

  const { data: types, error: typesError } = await supabase
    .from("service_types")
    .select("id, name, short_name, weekday, start_time, end_time, place, positions")
    .eq("recurring", true);
  if (typesError) return { error: explain(typesError) };

  // 1. Cultes manquants
  const { data: existing } = await supabase
    .from("services")
    .select("service_type_id, service_date")
    .gte("service_date", from)
    .lte("service_date", to)
    .eq("exceptional", false);
  const have = new Set((existing ?? []).map((s) => `${s.service_type_id}|${s.service_date}`));
  const toCreate = (types as ServiceTypeRow[]).flatMap((t) =>
    datesBetween(from, to, [t.weekday])
      .filter((date) => !have.has(`${t.id}|${date}`))
      .map((date) => ({
        id: crypto.randomUUID(),
        service_type_id: t.id,
        title: t.name,
        service_date: date,
        starts_at: `${date}T${t.start_time}Z`,
        ends_at: t.end_time ? `${date}T${t.end_time}Z` : null,
        place: t.place,
        positions: t.positions ?? [],
      })),
  );
  if (toCreate.length) {
    const { error } = await supabase.from("services").insert(toCreate.map((s) => ({ id: s.id, service_type_id: s.service_type_id, title: s.title, service_date: s.service_date, starts_at: s.starts_at, ends_at: s.ends_at, place: s.place })));
    if (error) return { error: explain(error) };
    const { error: posError } = await supabase.from("service_positions").insert(
      toCreate.flatMap((s) => s.positions.map((position, rank) => ({ service_id: s.id, position, rank }))),
    );
    if (posError) return { error: explain(posError) };
  }

  // 2. Recommencer : on vide les attributions automatiques des cultes non publiés.
  if (redo) {
    const { data: drafts } = await supabase
      .from("services")
      .select("id")
      .gte("service_date", from)
      .lte("service_date", to)
      .is("published_at", null);
    const ids = (drafts ?? []).map((d) => d.id);
    if (ids.length) {
      await supabase.from("service_positions").update({ person_id: null }).in("service_id", ids).eq("assigned_by", "auto");
    }
  }

  // 3. Roulement
  const [{ data: slots }, { data: pool }, { data: unavailable }, { data: absences }, { data: history }] = await Promise.all([
    supabase
      .from("service_positions")
      .select("id, service_id, position, rank, person_id, services!inner(service_date)")
      .in("position", programPositions)
      .gte("services.service_date", from)
      .lte("services.service_date", to),
    supabase.from("speaker_pools").select("person_id, position, days"),
    supabase.from("unavailabilities").select("person_id, starts_on, ends_on").gte("ends_on", from).lte("starts_on", to),
    // Une absence déclarée (« Je serai absent(e) ») vaut aussi indisponibilité.
    supabase.from("excused_absences").select("person_id, starts_on, ends_on").gte("ends_on", from).lte("starts_on", to),
    supabase
      .from("service_positions")
      .select("person_id, position, services!inner(service_date)")
      .in("position", programPositions)
      .not("person_id", "is", null)
      .gte("services.service_date", addDays(from, -180))
      .lt("services.service_date", from),
  ]);
  type SlotRow = { id: string; service_id: string; position: string; rank: number; person_id: string | null; services: { service_date: string } };
  const slotRows = (slots ?? []) as unknown as SlotRow[];
  const result = assignRotation(
    slotRows.map((s) => ({ key: s.id, date: s.services.service_date, label: s.position, personId: s.person_id })),
    (pool ?? []).map((p) => ({ personId: p.person_id, label: p.position, days: p.days as PoolDays })),
    [...(unavailable ?? []), ...(absences ?? [])].map((u) => ({ personId: u.person_id, from: u.starts_on, to: u.ends_on })),
    ((history ?? []) as unknown as { person_id: string; position: string; services: { service_date: string } }[]).map((h) => ({
      personId: h.person_id,
      label: h.position,
      date: h.services.service_date,
    })),
  );
  if (result.assignments.length) {
    const byId = new Map(slotRows.map((s) => [s.id, s]));
    const { error } = await supabase.from("service_positions").upsert(
      result.assignments.map((a) => {
        const s = byId.get(a.key)!;
        return { id: s.id, service_id: s.service_id, position: s.position, rank: s.rank, person_id: a.personId, assigned_by: "auto" };
      }),
    );
    if (error) return { error: explain(error) };
  }

  revalidatePath("/cultes", "layout");
  const empty = result.unfilled.length;
  return {
    success:
      `${toCreate.length} culte${toCreate.length > 1 ? "s" : ""} ajouté${toCreate.length > 1 ? "s" : ""}, ` +
      `${result.assignments.length} passage${result.assignments.length > 1 ? "s" : ""} attribué${result.assignments.length > 1 ? "s" : ""}` +
      (empty ? `, ${empty} poste${empty > 1 ? "s" : ""} encore vide${empty > 1 ? "s" : ""} (vivier trop petit ou indisponibilités).` : ". Vérifiez puis publiez."),
  };
}

/** Change (ou vide) le titulaire d'un poste. Si le culte est publié, la personne est prévenue. */
export async function setPositionPerson(formData: FormData): Promise<void> {
  const id = String(formData.get("position_id") ?? "");
  const personId = optional(formData.get("person_id"));
  const supabase = await createClient();
  const { data: pos } = await supabase
    .from("service_positions")
    .update({ person_id: personId, assigned_by: "manual", theme: null, bible_text: null })
    .eq("id", id)
    .select("position, services(title, service_date, published_at)")
    .maybeSingle();
  const service = (pos as unknown as { position: string; services: { title: string; service_date: string; published_at: string | null } } | null);
  if (service?.services.published_at && personId) {
    // Notification via la fonction du serveur : on ne peut pas écrire chez quelqu'un d'autre.
    await supabase.rpc("notify_position_change", { p_position: id });
  }
  revalidatePath("/cultes", "layout");
}

const exceptionalSchema = z.object({
  title: z.string().trim().min(3, "Donnez un nom (ex. Veillée de prière)."),
  date: isoDate,
  start: z.string().regex(/^\d{2}:\d{2}$/, "Heure de début ?"),
  end: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  place: z.string().trim().optional(),
  type_id: z.string().uuid("Choisissez le modèle de postes."),
});

/** Programme exceptionnel : veillée, croisade, convention, jeûne… (postes repris d'un type de culte). */
export async function createExceptionalService(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = exceptionalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const { title, date, start, end, place, type_id } = parsed.data;
  const supabase = await createClient();
  const { data: type } = await supabase.from("service_types").select("positions, place").eq("id", type_id).maybeSingle();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("services").insert({
    id,
    service_type_id: type_id,
    title,
    service_date: date,
    starts_at: `${date}T${start}:00Z`,
    ends_at: end ? `${date}T${end}:00Z` : null,
    place: place || type?.place || null,
    exceptional: true,
  });
  if (error) return { error: explain(error) };
  const positions = (type?.positions as string[] | null) ?? [];
  if (positions.length) {
    const { error: posError } = await supabase
      .from("service_positions")
      .insert(positions.map((position, rank) => ({ service_id: id, position, rank })));
    if (posError) return { error: explain(posError) };
  }
  revalidatePath("/cultes", "layout");
  return { success: `« ${title} » ajouté au programme (brouillon). Pensez à publier.` };
}

/** Supprime un culte encore en brouillon (un culte publié reste dans l'historique). */
export async function deleteDraftService(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("services").delete().eq("id", String(formData.get("service_id") ?? "")).is("published_at", null);
  revalidatePath("/cultes", "layout");
}

const publishSchema = z.object({ from: isoDate, to: isoDate });

export async function publishProgram(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = publishSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_program", { p_from: parsed.data.from, p_to: parsed.data.to });
  if (error) return { error: explain(error) };
  revalidatePath("/cultes", "layout");
  revalidatePath("/mon-espace");
  return { success: data ? `${data} culte${data > 1 ? "s" : ""} publié${data > 1 ? "s" : ""}. Chaque personne programmée est prévenue.` : "Tout était déjà publié." };
}

export async function decideSwap(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("decide_swap", {
    p_request: String(formData.get("request_id") ?? ""),
    p_approve: formData.get("approve") === "1",
  });
  revalidatePath("/cultes", "layout");
}

// --------------------------------------------------------------------------
// Viviers et indisponibilités
// --------------------------------------------------------------------------
const poolSchema = z.object({
  person_id: z.string().uuid("Choisissez une personne."),
  position: z.string().min(1),
  days: z.enum(["sunday", "weekday", "both"]),
});

export async function addToPool(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = poolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.from("speaker_pools").upsert(parsed.data, { onConflict: "person_id,position" });
  if (error) return { error: explain(error) };
  revalidatePath("/cultes/viviers");
  return { success: "Ajouté au vivier." };
}

export async function updatePoolDays(formData: FormData): Promise<void> {
  const days = String(formData.get("days") ?? "");
  if (!["sunday", "weekday", "both"].includes(days)) return;
  const supabase = await createClient();
  await supabase.from("speaker_pools").update({ days }).eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/cultes/viviers");
}

export async function removeFromPool(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("speaker_pools").delete().eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/cultes/viviers");
}

const unavailabilitySchema = z
  .object({
    person_id: z.string().uuid("Choisissez une personne."),
    starts_on: isoDate,
    ends_on: isoDate,
    reason: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.ends_on >= v.starts_on, { path: ["ends_on"], message: "La fin doit suivre le début." });

export async function addUnavailability(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = unavailabilitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.from("unavailabilities").insert({ ...parsed.data, reason: parsed.data.reason || null });
  if (error) return { error: explain(error) };
  revalidatePath("/cultes/viviers");
  revalidatePath("/mon-espace");
  return { success: "Indisponibilité enregistrée : la génération en tiendra compte." };
}

export async function removeUnavailability(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("unavailabilities").delete().eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/cultes/viviers");
  revalidatePath("/mon-espace");
}

// --------------------------------------------------------------------------
// Côté personne programmée (espace fidèle)
// --------------------------------------------------------------------------
export async function saveMyPositionDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_position_details", {
    p_position: String(formData.get("position_id") ?? ""),
    p_theme: String(formData.get("theme") ?? ""),
    p_bible_text: String(formData.get("bible_text") ?? ""),
  });
  if (error) return { error: explain(error) };
  revalidatePath("/mon-espace");
  revalidatePath("/cultes");
  return { success: "Thème et texte enregistrés." };
}

export async function requestSwap(_prev: FormState, formData: FormData): Promise<FormState> {
  const replacement = optional(formData.get("replacement_id"));
  if (!replacement) return { fieldErrors: { replacement_id: "Choisissez qui vous remplacerait." } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_swap", {
    p_position: String(formData.get("position_id") ?? ""),
    p_replacement: replacement,
    p_reason: String(formData.get("reason") ?? ""),
  });
  if (error) return { error: explain(error) };
  revalidatePath("/mon-espace");
  return { success: "Demande envoyée au chargé du programme." };
}
