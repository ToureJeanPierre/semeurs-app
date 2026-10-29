"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/auth";
import { explain, optional } from "@/lib/action-helpers";
import { addDays, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

async function myPersonId() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_access");
  return { supabase, personId: (data as { person_id?: string } | null)?.person_id ?? null };
}

/** Nouveau sondage (église ou groupe) : les personnes concernées sont prévenues par la base. */
export async function createPoll(_prev: FormState, formData: FormData): Promise<FormState> {
  const question = String(formData.get("question") ?? "").trim();
  const options = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
  if (question.length < 5) return { fieldErrors: { question: "Posez votre question." } };
  if (options.length < 2 || options.length > 10) return { fieldErrors: { options: "Entre 2 et 10 réponses, une par ligne." } };
  const { supabase, personId } = await myPersonId();
  const { error } = await supabase.from("polls").insert({
    question,
    options,
    group_id: optional(formData.get("group_id")),
    anonymous: formData.get("anonymous") === "on",
    closes_on: optional(formData.get("closes_on")),
    created_by: personId,
  });
  if (error) return { error: explain(error) };
  revalidatePath("/sondages");
  return { success: "Sondage lancé : les personnes concernées sont prévenues." };
}

export async function vote(formData: FormData): Promise<void> {
  const { supabase, personId } = await myPersonId();
  await supabase
    .from("poll_votes")
    .insert({ poll_id: String(formData.get("poll_id") ?? ""), person_id: personId, option_index: Number(formData.get("option_index")) });
  revalidatePath("/sondages");
  revalidatePath("/");
}

/** Clôture : la date limite passe à hier, plus personne ne peut voter. */
export async function closePoll(formData: FormData): Promise<void> {
  const { supabase } = await myPersonId();
  await supabase.from("polls").update({ closes_on: addDays(todayIso(), -1) }).eq("id", String(formData.get("poll_id") ?? ""));
  revalidatePath("/sondages");
}
