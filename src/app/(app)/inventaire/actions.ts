"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/auth";
import { explain, optional } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

const whole = (v: FormDataEntryValue | null) => {
  const text = optional(v);
  return text === null ? null : Number(text.replace(/\s/g, ""));
};

/** Nouveau bien de l'église ou d'un groupe. */
export async function addItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { fieldErrors: { name: "Nom du bien ?" } };
  const quantity = whole(formData.get("quantity")) ?? 1;
  const value = whole(formData.get("value"));
  if (!Number.isInteger(quantity) || quantity < 0) return { fieldErrors: { quantity: "Nombre entier." } };
  if (value !== null && (!Number.isInteger(value) || value < 0)) return { fieldErrors: { value: "Montant en FCFA." } };
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({
    name,
    category: optional(formData.get("category")),
    group_id: optional(formData.get("group_id")),
    quantity,
    value,
    condition: String(formData.get("condition") ?? "good"),
    location: optional(formData.get("location")),
    acquired_on: optional(formData.get("acquired_on")),
    next_maintenance_on: optional(formData.get("next_maintenance_on")),
    notes: optional(formData.get("notes")),
  });
  if (error) return { error: explain(error) };
  revalidatePath("/inventaire");
  return { success: "Bien ajouté à l'inventaire." };
}

/** État et prochain entretien d'un bien. */
export async function updateItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({
      condition: String(formData.get("condition") ?? "good"),
      location: optional(formData.get("location")),
      next_maintenance_on: optional(formData.get("next_maintenance_on")),
      quantity: whole(formData.get("quantity")) ?? 1,
    })
    .eq("id", String(formData.get("item_id") ?? ""));
  if (error) return { error: explain(error) };
  revalidatePath("/inventaire");
  return { success: "Enregistré." };
}

/** Prêt, retour, réparation ou sortie définitive (journal du bien). */
export async function addMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_access");
  const itemId = String(formData.get("item_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const { error } = await supabase.from("inventory_movements").insert({
    item_id: itemId,
    kind,
    person_id: optional(formData.get("person_id")),
    note: optional(formData.get("note")),
    created_by: (me as { person_id?: string } | null)?.person_id ?? null,
  });
  if (error) return { error: explain(error) };
  if (kind === "out") await supabase.from("inventory_items").update({ active: false }).eq("id", itemId);
  revalidatePath("/inventaire");
  return { success: "Mouvement noté." };
}
