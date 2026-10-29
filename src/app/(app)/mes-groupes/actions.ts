"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors, optional } from "@/lib/action-helpers";
import { addDays } from "@/lib/format";
import { parseLabels, parseNewcomers } from "@/lib/group-agenda";
import { parseIvorianPhone } from "@/lib/phone";
import { assignRotation } from "@/lib/rotation";
import { createClient } from "@/lib/supabase/server";

/**
 * Capacités des groupes. Le droit « groups.manage » dans le groupe (responsable,
 * adjoint selon le bureau) est vérifié par la base (RLS) ; ce code met en forme.
 */

const hub = (groupId: string) => `/mes-groupes/${groupId}`;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date.");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Heure ?");

async function myPersonId() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_access");
  return (data as { person_id?: string } | null)?.person_id ?? null;
}

// --------------------------------------------------------------------------
// Lieu et horaire de rencontre (groups.settings.meeting)
// --------------------------------------------------------------------------
const meetingInfoSchema = z.object({
  group_id: z.string().uuid(),
  weekday: z.string().optional(),
  time: z.string().optional(),
  place: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(200).optional(),
  host_id: z.string().optional(),
});

export async function saveMeetingInfo(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = meetingInfoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const { data: group } = await supabase.from("groups").select("settings").eq("id", v.group_id).maybeSingle();
  const settings = { ...((group?.settings as object | null) ?? {}) } as Record<string, unknown>;
  settings.meeting = {
    weekday: v.weekday === "" || v.weekday === undefined ? null : Number(v.weekday),
    time: v.time || null,
    place: v.place || null,
    landmark: v.landmark || null,
    host_id: v.host_id || null,
  };
  const { data, error } = await supabase.from("groups").update({ settings }).eq("id", v.group_id).select("id");
  if (error) return { error: explain(error) };
  if (!data?.length) return { error: "Réservé au responsable du groupe." };
  revalidatePath(hub(v.group_id));
  return { success: "Lieu et horaire enregistrés." };
}

// --------------------------------------------------------------------------
// Agenda
// --------------------------------------------------------------------------
const eventSchema = z.object({
  group_id: z.string().uuid(),
  title: z.string().trim().min(2, "Titre ?"),
  date: isoDate,
  start: time,
  end: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  place: z.string().trim().max(200).optional(),
  recurrence: z.enum(["none", "weekly"]),
  until: z.string().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function addGroupEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("group_events").insert({
    group_id: v.group_id,
    title: v.title,
    starts_at: `${v.date}T${v.start}:00Z`,
    ends_at: v.end ? `${v.date}T${v.end}:00Z` : null,
    place: v.place || null,
    recurrence: v.recurrence,
    until: v.recurrence === "weekly" && v.until ? v.until : null,
    note: v.note || null,
  });
  if (error) return { error: explain(error) };
  revalidatePath(hub(v.group_id));
  return { success: "Activité ajoutée à l'agenda." };
}

export async function deleteGroupEvent(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from("group_events").delete().eq("id", String(formData.get("event_id") ?? "")).select("group_id").maybeSingle();
  if (data) revalidatePath(hub(data.group_id));
}

// --------------------------------------------------------------------------
// Présences
// --------------------------------------------------------------------------
const sessionSchema = z.object({ group_id: z.string().uuid(), date: isoDate, title: z.string().trim().min(2, "Titre ?") });

export async function openGroupSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = sessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("sessions").insert({
    id,
    group_id: v.group_id,
    title: v.title,
    session_date: v.date,
    starts_at: `${v.date}T12:00:00Z`,
    counts_for_alerts: false, // seules les présences aux cultes comptent pour les alertes d'absence
  });
  if (error) return { error: explain(error) };
  redirect(`${hub(v.group_id)}/pointage/${id}`);
}

export async function toggleGroupPresence(formData: FormData): Promise<void> {
  const sessionId = String(formData.get("session_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  const supabase = await createClient();
  if (formData.get("present") === "1") {
    await supabase.from("attendance").insert({ session_id: sessionId, person_id: personId, mode: "list" });
  } else {
    await supabase.from("attendance").delete().eq("session_id", sessionId).eq("person_id", personId);
  }
  revalidatePath(`${hub(groupId)}/pointage/${sessionId}`);
}

// --------------------------------------------------------------------------
// Planning de service / chaîne de prière
// --------------------------------------------------------------------------
const dutySettingsSchema = z.object({
  group_id: z.string().uuid(),
  capability: z.enum(["service_planning", "prayer_chain"]),
  labels: z.string(),
});

export async function saveDutySettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = dutySettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const { group_id, capability } = parsed.data;
  const labels = parseLabels(parsed.data.labels);
  const weekdays = formData.getAll("weekdays").map(Number).filter((d) => d >= 0 && d <= 6);
  if (labels.length === 0) return { fieldErrors: { labels: "Indiquez au moins un poste (un par ligne)." } };
  if (weekdays.length === 0) return { fieldErrors: { weekdays: "Cochez au moins un jour." } };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_capabilities")
    .update({ settings: { labels, weekdays } })
    .eq("group_id", group_id)
    .eq("capability_code", capability)
    .select("group_id");
  if (error) return { error: explain(error) };
  if (!data?.length) return { error: "Réservé au responsable du groupe." };
  revalidatePath(hub(group_id));
  return { success: "Réglages enregistrés." };
}

const generateDutiesSchema = z.object({
  group_id: z.string().uuid(),
  capability: z.enum(["service_planning", "prayer_chain"]),
  from: isoDate,
  weeks: z.coerce.number().int().min(1).max(26),
});

/** Crée les postes de la période et les répartit entre les membres, à tour de rôle. */
export async function generateDuties(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = generateDutiesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const { group_id, capability, from, weeks } = parsed.data;
  const to = addDays(from, weeks * 7 - 1);
  const supabase = await createClient();
  const [{ data: cap }, { data: members }, { data: existing }, { data: absences }, { data: history }] = await Promise.all([
    supabase.from("group_capabilities").select("settings").eq("group_id", group_id).eq("capability_code", capability).maybeSingle(),
    supabase.rpc("group_people", { p_group: group_id }),
    supabase.from("group_duties").select("id, duty_date, label, person_id").eq("group_id", group_id).eq("capability_code", capability).gte("duty_date", from).lte("duty_date", to),
    supabase.from("excused_absences").select("person_id, starts_on, ends_on").gte("ends_on", from).lte("starts_on", to),
    supabase.from("group_duties").select("person_id, label, duty_date").eq("group_id", group_id).eq("capability_code", capability).lt("duty_date", from).gte("duty_date", addDays(from, -120)).not("person_id", "is", null),
  ]);
  const settings = (cap?.settings ?? {}) as { labels?: string[]; weekdays?: number[] };
  const labels = settings.labels ?? [];
  const weekdays = settings.weekdays ?? [];
  if (!labels.length || !weekdays.length) return { error: "Réglez d'abord les postes et les jours." };
  const people = (members ?? []) as { person_id: string }[];
  if (!people.length) return { error: "Le groupe n'a pas encore de membres." };

  // Postes manquants
  const have = new Set((existing ?? []).map((d) => `${d.duty_date}|${d.label}`));
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (weekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay())) dates.push(d);
  const missing = dates.flatMap((date) => labels.filter((label) => !have.has(`${date}|${label}`)).map((label) => ({ id: crypto.randomUUID(), group_id, capability_code: capability, duty_date: date, label })));
  if (missing.length) {
    const { error } = await supabase.from("group_duties").insert(missing);
    if (error) return { error: explain(error) };
  }
  const slots = [...(existing ?? []), ...missing.map((m) => ({ id: m.id, duty_date: m.duty_date, label: m.label, person_id: null as string | null }))];
  const result = assignRotation(
    slots.map((s) => ({ key: s.id, date: s.duty_date, label: s.label, personId: s.person_id })),
    // Tous les membres peuvent tenir chaque poste ; le roulement répartit équitablement.
    people.flatMap((p) => labels.map((label) => ({ personId: p.person_id, label, days: "both" as const }))),
    (absences ?? []).map((a) => ({ personId: a.person_id, from: a.starts_on, to: a.ends_on })),
    (history ?? []).map((h) => ({ personId: h.person_id!, label: h.label, date: h.duty_date })),
  );
  if (result.assignments.length) {
    const byId = new Map(slots.map((s) => [s.id, s]));
    const { error } = await supabase.from("group_duties").upsert(
      result.assignments.map((a) => {
        const s = byId.get(a.key)!;
        return { id: a.key, group_id, capability_code: capability, duty_date: s.duty_date, label: s.label, person_id: a.personId, assigned_by: "auto" };
      }),
    );
    if (error) return { error: explain(error) };
  }
  revalidatePath(hub(group_id));
  revalidatePath("/mon-espace");
  return { success: `${result.assignments.length} poste${result.assignments.length > 1 ? "s" : ""} attribué${result.assignments.length > 1 ? "s" : ""} sur ${weeks} semaine${weeks > 1 ? "s" : ""}.` };
}

export async function setDutyPerson(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_duties")
    .update({ person_id: optional(formData.get("person_id")), assigned_by: "manual" })
    .eq("id", String(formData.get("position_id") ?? ""))
    .select("group_id")
    .maybeSingle();
  if (data) revalidatePath(hub(data.group_id));
  revalidatePath("/mon-espace");
}

// --------------------------------------------------------------------------
// Répertoire
// --------------------------------------------------------------------------
const resourceSchema = z.object({
  group_id: z.string().uuid(),
  title: z.string().trim().min(2, "Titre ?"),
  kind: z.string().min(1),
  music_key: z.string().trim().max(20).optional(),
  body: z.string().trim().max(10000).optional(),
  url: z.string().trim().url("Adresse web invalide (https://…).").optional().or(z.literal("")),
});

export async function addResource(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_resources")
    .insert({ ...v, music_key: v.music_key || null, body: v.body || null, url: v.url || null });
  if (error) return { error: explain(error) };
  revalidatePath(hub(v.group_id));
  return { success: "Ajouté au répertoire." };
}

export async function deleteResource(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from("group_resources").delete().eq("id", String(formData.get("resource_id") ?? "")).select("group_id").maybeSingle();
  if (data) revalidatePath(hub(data.group_id));
}

// --------------------------------------------------------------------------
// Rapport de rencontre (cellules…)
// --------------------------------------------------------------------------
const reportSchema = z.object({
  group_id: z.string().uuid(),
  meeting_date: isoDate,
  present_count: z.coerce.number().int().min(0, "Nombre de présents ?").max(1000),
  theme: z.string().trim().max(300).optional(),
  prayer_subjects: z.string().trim().max(2000).optional(),
  needs: z.string().trim().max(2000).optional(),
  newcomers: z.string().optional(),
});

/** Rapport après la rencontre ; chaque nouveau venu reçoit une fiche et entre dans le parcours d'intégration. */
export async function submitReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const newcomers = parseNewcomers(v.newcomers ?? "");
  const supabase = await createClient();
  const me = await myPersonId();
  const { error } = await supabase.from("group_reports").insert({
    group_id: v.group_id,
    meeting_date: v.meeting_date,
    present_count: v.present_count,
    newcomers_count: newcomers.length,
    theme: v.theme || null,
    prayer_subjects: v.prayer_subjects || null,
    needs: v.needs || null,
    author_id: me,
  });
  if (error) return { error: error.code === "23505" ? "Un rapport existe déjà pour cette date." : explain(error) };
  let created = 0;
  for (const n of newcomers) {
    const phone = n.phone ? parseIvorianPhone(n.phone)?.e164 ?? "" : "";
    const { error: soulError } = await supabase.rpc("register_soul", {
      p_first_name: n.first_name,
      p_last_name: n.last_name,
      p_sex: "",
      p_phone: phone,
      p_district: "",
      p_status: "visitor",
      p_brought_by: me,
      p_note: "Venu(e) à la rencontre du groupe",
      p_contact: null,
    });
    if (!soulError) created++;
  }
  revalidatePath(hub(v.group_id));
  revalidatePath("/ames");
  return {
    success: `Rapport envoyé.${created ? ` ${created} nouveau${created > 1 ? "x" : ""} venu${created > 1 ? "s" : ""} inscrit${created > 1 ? "s" : ""} dans le parcours d'intégration.` : ""}`,
  };
}

// --------------------------------------------------------------------------
// « Je participe » et boîte à idées
// --------------------------------------------------------------------------
export async function toggleRsvp(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const me = await myPersonId();
  const row = { event_id: String(formData.get("event_id") ?? ""), occurrence_date: String(formData.get("date") ?? ""), person_id: me };
  if (formData.get("going") === "1") await supabase.from("group_event_rsvps").insert(row);
  else await supabase.from("group_event_rsvps").delete().match(row);
  revalidatePath(hub(String(formData.get("group_id") ?? "")));
}

export async function addIdea(_prev: FormState, formData: FormData): Promise<FormState> {
  const body = String(formData.get("body") ?? "").trim();
  const groupId = String(formData.get("group_id") ?? "");
  if (body.length < 3) return { fieldErrors: { body: "Écrivez votre idée." } };
  const supabase = await createClient();
  const { error } = await supabase.from("group_ideas").insert({ group_id: groupId, author_id: await myPersonId(), body });
  if (error) return { error: explain(error) };
  revalidatePath(hub(groupId));
  return { success: "Merci pour votre idée !" };
}

export async function toggleIdeaVote(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const row = { idea_id: String(formData.get("idea_id") ?? ""), person_id: await myPersonId() };
  if (formData.get("vote") === "1") await supabase.from("group_idea_votes").insert(row);
  else await supabase.from("group_idea_votes").delete().match(row);
  revalidatePath(hub(String(formData.get("group_id") ?? "")));
}

export async function setIdeaStatus(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("group_ideas").update({ status: String(formData.get("status") ?? "open") }).eq("id", String(formData.get("idea_id") ?? ""));
  revalidatePath(hub(String(formData.get("group_id") ?? "")));
}
