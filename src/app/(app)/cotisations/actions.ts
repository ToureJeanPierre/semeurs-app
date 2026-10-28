"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors, optional } from "@/lib/action-helpers";
import { parseAmount } from "@/lib/contributions";
import { createClient } from "@/lib/supabase/server";

/**
 * Cotisations. La base décide (RLS + déclencheurs) : qui gère, qui déclare, et
 * qu'un versement validé ne se modifie ni ne se supprime jamais.
 */

const amountField = (message: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const n = parseAmount(v);
      if (n === null) ctx.addIssue({ code: "custom", message });
      return n;
    });

const headingSchema = z
  .object({
    title: z.string().trim().min(3, "Donnez un titre (ex. Soutien à la famille Kouassi)."),
    kind: z.string().min(1),
    group_id: z.string(),
    beneficiary_id: z.string().optional(),
    amount_mode: z.enum(["fixed", "free"]),
    amount: amountField("Montant par personne invalide."),
    min_amount: amountField("Minimum invalide."),
    target_amount: amountField("Objectif invalide."),
    recurrence: z.enum(["none", "monthly"]),
    due_date: z.string().optional(),
    description: z.string().trim().max(1000).optional(),
    life_event_id: z.string().optional(),
  })
  .refine((v) => v.amount_mode === "free" || v.amount, { path: ["amount"], message: "Indiquez le montant par personne." });

export async function createHeading(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = headingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("contribution_headings").insert({
    id,
    title: v.title,
    kind: v.kind,
    group_id: v.group_id === "church" ? null : v.group_id,
    beneficiary_id: v.beneficiary_id || null,
    amount_mode: v.amount_mode,
    amount: v.amount_mode === "fixed" ? v.amount : null,
    min_amount: v.amount_mode === "free" ? v.min_amount : null,
    target_amount: v.target_amount,
    recurrence: v.recurrence,
    due_date: v.due_date || null,
    description: v.description || null,
    life_event_id: v.life_event_id || null,
  });
  if (error) return { error: explain(error) };
  revalidatePath("/cotisations");
  redirect(`/cotisations/${id}?lancee=1`);
}

const paymentSchema = z.object({
  heading_id: z.string().uuid(),
  person_id: z.string().uuid("Choisissez qui a payé."),
  amount: z.string().transform((v, ctx) => {
    const n = parseAmount(v);
    if (n === null) ctx.addIssue({ code: "custom", message: "Montant invalide." });
    return n ?? 0;
  }),
  method: z.string().min(1),
  reference: z.string().trim().max(80).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional().or(z.literal("")),
});

/** La trésorière saisit un versement : il est validé d'emblée et reçoit son numéro de reçu. */
export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contribution_payments")
    .insert({ ...v, reference: v.reference || null, period: v.period || null, status: "validated" })
    .select("receipt_no")
    .single();
  if (error) return { error: explain(error) };
  revalidatePath(`/cotisations/${v.heading_id}`);
  return { success: `Versement enregistré. Reçu n° ${data.receipt_no}.` };
}

/** Le fidèle déclare avoir payé (Mobile Money le plus souvent) ; la trésorière validera. */
export async function declarePayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_access");
  formData.set("person_id", (me as { person_id?: string } | null)?.person_id ?? "");
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  if (v.method !== "cash" && !v.reference) {
    return { fieldErrors: { reference: "Indiquez la référence de la transaction (reçue par SMS)." } };
  }
  const { error } = await supabase
    .from("contribution_payments")
    .insert({ ...v, reference: v.reference || null, period: v.period || null, status: "declared" });
  if (error) return { error: explain(error) };
  revalidatePath("/cotisations");
  return { success: "Merci ! Votre versement est déclaré : vous recevrez votre reçu dès sa validation." };
}

export async function validatePayment(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(formData.get("payment_id") ?? "");
  // Le fidèle est prévenu par la base (reçu disponible).
  const { data } = await supabase.from("contribution_payments").update({ status: "validated" }).eq("id", id).select("heading_id").maybeSingle();
  if (data) revalidatePath(`/cotisations/${data.heading_id}`);
}

const reasonSchema = z.object({
  payment_id: z.string().uuid(),
  reason: z.string().trim().min(5, "Indiquez le motif (au moins quelques mots)."),
});

export async function rejectPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contribution_payments")
    .update({ status: "rejected", reason: parsed.data.reason })
    .eq("id", parsed.data.payment_id)
    .select("heading_id")
    .maybeSingle();
  if (error) return { error: explain(error) };
  if (!data) return { error: "Vous n'avez pas le droit de traiter ce versement." };
  revalidatePath(`/cotisations/${data.heading_id}`);
  return { success: "Déclaration refusée." };
}

/** Annulation d'un versement validé : contre-opération motivée (rien n'est effacé). */
export async function reversePayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { data: original } = await supabase
    .from("contribution_payments")
    .select("heading_id, person_id, amount, method")
    .eq("id", parsed.data.payment_id)
    .maybeSingle();
  if (!original) return { error: "Versement introuvable." };
  const { error } = await supabase.from("contribution_payments").insert({
    heading_id: original.heading_id,
    person_id: original.person_id,
    amount: -original.amount,
    method: original.method,
    reverses_id: parsed.data.payment_id,
    reason: parsed.data.reason,
    status: "validated",
  });
  if (error) return { error: explain(error) };
  revalidatePath(`/cotisations/${original.heading_id}`);
  return { success: "Versement annulé par une contre-opération. Tout reste visible dans l'historique." };
}

export async function remindLate(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remind_contribution", {
    p_heading: String(formData.get("heading_id") ?? ""),
    p_period: optional(formData.get("period")),
  });
  if (error) return { error: explain(error) };
  return { success: data ? `${data} rappel${data > 1 ? "s" : ""} envoyé${data > 1 ? "s" : ""} dans l'appli. Pour WhatsApp, touchez chaque nom ci-dessous.` : "Tout le monde est à jour." };
}

export async function closeHeading(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("heading_id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.from("contribution_headings").update({ status: "closed" }).eq("id", id).select("id");
  if (error) return { error: explain(error) };
  if (!data?.length) return { error: "Vous n'avez pas le droit de clôturer cette cotisation." };
  revalidatePath(`/cotisations/${id}`);
  revalidatePath("/cotisations");
  return { success: "Cotisation clôturée. Le bilan est prêt à imprimer." };
}
