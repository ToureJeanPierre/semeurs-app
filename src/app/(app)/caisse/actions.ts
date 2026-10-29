"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors, optional } from "@/lib/action-helpers";
import { countTotal } from "@/lib/cash";
import { parseAmount } from "@/lib/contributions";
import { createClient } from "@/lib/supabase/server";

/**
 * Caisse. Les règles financières sont dans la base : quatre yeux, plafond du pasteur,
 * mois arrêtés, aucune suppression ni modification après validation (déclencheurs + RLS).
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date.");
const amount = z.string().transform((v, ctx) => {
  const n = parseAmount(v);
  if (n === null) ctx.addIssue({ code: "custom", message: "Montant invalide." });
  return n ?? 0;
});

function refresh() {
  revalidatePath("/caisse", "layout");
  revalidatePath("/dons");
}

const operationSchema = z.object({
  direction: z.enum(["in", "out"]),
  account_id: z.string().uuid("Choisissez le compte."),
  category: z.string().min(1, "Choisissez la catégorie."),
  amount,
  op_date: isoDate,
  label: z.string().trim().max(200).optional(),
  method: z.string().optional(),
  reference: z.string().trim().max(80).optional(),
  person_id: z.string().optional(),
});

/** Recette ou dépense saisie par un caissier : elle attend la validation d'un autre caissier. */
export async function recordOperation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = operationSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const id = crypto.randomUUID();

  // Justificatif photographié (dépense) : stockage privé « justificatifs ».
  let attachment_path: string | null = null;
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return { fieldErrors: { attachment: "Photo trop lourde (5 Mo au plus)." } };
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    attachment_path = `${v.op_date.slice(0, 4)}/${id}.${ext}`;
    const { error: upError } = await supabase.storage.from("justificatifs").upload(attachment_path, file, { contentType: file.type });
    if (upError) return { error: "Le justificatif n'a pas pu être envoyé. Réessayez." };
  }
  if (v.direction === "out" && !attachment_path && !formData.get("no_attachment")) {
    return { fieldErrors: { attachment: "Photographiez le justificatif (ou cochez « pas de justificatif »)." } };
  }

  const { error } = await supabase.from("cash_operations").insert({
    id,
    direction: v.direction,
    account_id: v.account_id,
    category: v.category,
    amount: v.amount,
    op_date: v.op_date,
    label: v.label || null,
    method: v.method || null,
    reference: v.reference || null,
    person_id: v.person_id || null,
    anonymous: formData.get("anonymous") === "on",
    attachment_path,
  });
  if (error) return { error: explain(error) };
  refresh();
  return { success: "Enregistré. Un autre caissier doit maintenant valider (principe des quatre yeux)." };
}

export async function validateOperation(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("cash_operations").update({ status: "approved" }).eq("id", String(formData.get("operation_id") ?? ""));
  refresh();
}

const reasonSchema = z.object({ operation_id: z.string().uuid(), reason: z.string().trim().min(5, "Indiquez le motif.") });

export async function rejectOperation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cash_operations")
    .update({ status: "rejected", reason: parsed.data.reason })
    .eq("id", parsed.data.operation_id)
    .select("id");
  if (error) return { error: explain(error) };
  if (!data?.length) return { error: "Vous ne pouvez pas traiter cette opération." };
  refresh();
  return { success: "Opération refusée." };
}

/** Annuler une opération validée : contre-opération motivée, elle aussi validée par un second caissier. */
export async function reverseOperation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("cash_operations")
    .select("account_id, direction, amount, category, person_id, pledge_id")
    .eq("id", parsed.data.operation_id)
    .maybeSingle();
  if (!o) return { error: "Opération introuvable." };
  const { error } = await supabase.from("cash_operations").insert({
    account_id: o.account_id,
    direction: o.direction,
    amount: -o.amount,
    category: o.category,
    person_id: o.person_id,
    pledge_id: o.pledge_id,
    op_date: new Date().toISOString().slice(0, 10),
    label: "Annulation",
    reason: parsed.data.reason,
    reverses_id: parsed.data.operation_id,
  });
  if (error) return { error: explain(error) };
  refresh();
  return { success: "Contre-opération enregistrée : un autre caissier doit la valider." };
}

// --------------------------------------------------------------------------
// Comptage des offrandes
// --------------------------------------------------------------------------
export async function recordCount(_prev: FormState, formData: FormData): Promise<FormState> {
  const denominations: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("d_") && typeof value === "string" && value.trim()) {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) return { error: `Nombre invalide pour ${key.slice(2)} FCFA.` };
      if (n > 0) denominations[key.slice(2)] = n;
    }
  }
  const total = countTotal(denominations);
  if (total <= 0) return { error: "Saisissez le nombre de billets et de pièces." };
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_access");
  const { error } = await supabase.from("offering_counts").insert({
    op_date: String(formData.get("op_date") ?? "") || new Date().toISOString().slice(0, 10),
    service_label: optional(formData.get("service_label")),
    category: String(formData.get("category") ?? "offering"),
    account_id: String(formData.get("account_id") ?? ""),
    denominations,
    total,
    counter_1: (me as { person_id?: string } | null)?.person_id,
  });
  if (error) return { error: explain(error) };
  refresh();
  return { success: `Comptage enregistré : ${total.toLocaleString("fr-FR")} FCFA. Une seconde personne doit le confirmer.` };
}

export async function confirmCount(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("confirm_offering_count", { p_count: String(formData.get("count_id") ?? "") });
  refresh();
}

export async function closeMonth(_prev: FormState, formData: FormData): Promise<FormState> {
  const month = String(formData.get("month") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_month", { p_month: month });
  if (error) return { error: explain(error) };
  refresh();
  redirect(`/caisse/rapports/${month}`);
}

export async function setBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  const year = Number(formData.get("year"));
  const supabase = await createClient();
  const rows = [...formData.entries()]
    .filter(([k, v]) => /^b_(in|out)_/.test(k) && typeof v === "string" && v.trim())
    .map(([k, v]) => {
      const [, direction, category] = k.match(/^b_(in|out)_(.+)$/)!;
      return { year, direction, category, amount: parseAmount(String(v)) ?? 0 };
    });
  const { error } = await supabase.from("budgets").upsert(rows);
  if (error) return { error: explain(error) };
  refresh();
  return { success: "Budget enregistré." };
}

// --------------------------------------------------------------------------
// Campagnes et engagements
// --------------------------------------------------------------------------
const campaignSchema = z.object({
  title: z.string().trim().min(3, "Titre ?"),
  description: z.string().trim().max(1000).optional(),
  target_amount: z.string().optional(),
  start_date: isoDate,
  end_date: z.string().optional(),
});

export async function createCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("campaigns").insert({
    id,
    title: v.title,
    description: v.description || null,
    target_amount: v.target_amount ? parseAmount(v.target_amount) : null,
    start_date: v.start_date,
    end_date: v.end_date || null,
  });
  if (error) return { error: explain(error) };
  refresh();
  redirect(`/caisse/engagements/${id}`);
}

const pledgeSchema = z.object({
  campaign_id: z.string().uuid(),
  person_id: z.string().optional(),
  anonymous: z.enum(["on"]).optional(),
  amount,
  due_date: z.string().optional(),
  note: z.string().trim().max(300).optional(),
});

/** Engagement inscrit devant le nom du fidèle (choisi dans la liste), ou anonyme. */
export async function addPledge(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = pledgeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  if (!v.anonymous && !v.person_id) return { fieldErrors: { person_id: "Choisissez le fidèle (ou cochez « anonyme »)." } };
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_access");
  let anonymous_label: string | null = null;
  if (v.anonymous) {
    const { count } = await supabase.from("pledges").select("id", { count: "exact", head: true }).eq("campaign_id", v.campaign_id).is("person_id", null);
    anonymous_label = `Anonyme ${(count ?? 0) + 1}`;
  }
  const { error } = await supabase.from("pledges").insert({
    campaign_id: v.campaign_id,
    person_id: v.anonymous ? null : v.person_id,
    anonymous_label,
    amount: v.amount,
    due_date: v.due_date || null,
    note: v.note || null,
    created_by: (me as { person_id?: string } | null)?.person_id,
  });
  if (error) return { error: explain(error) };
  refresh();
  return { success: "Engagement inscrit." };
}

/** Versement sur un engagement : recette de la caisse (catégorie « engagement »), à valider par un second caissier. */
export async function recordPledgePayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const pledgeId = String(formData.get("pledge_id") ?? "");
  const value = parseAmount(String(formData.get("amount") ?? ""));
  if (!value) return { fieldErrors: { amount: "Montant invalide." } };
  const supabase = await createClient();
  const { data: p } = await supabase.from("pledges").select("person_id, campaigns(title)").eq("id", pledgeId).maybeSingle();
  if (!p) return { error: "Engagement introuvable." };
  const { error } = await supabase.from("cash_operations").insert({
    direction: "in",
    account_id: String(formData.get("account_id") ?? ""),
    category: "pledge",
    amount: value,
    op_date: new Date().toISOString().slice(0, 10),
    label: `Engagement : ${(p.campaigns as unknown as { title: string } | null)?.title ?? ""}`,
    method: optional(formData.get("method")),
    reference: optional(formData.get("reference")),
    person_id: p.person_id,
    pledge_id: pledgeId,
  });
  if (error) return { error: explain(error) };
  refresh();
  return { success: "Versement enregistré : un autre caissier doit le valider." };
}

export async function closeCampaign(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("campaigns").update({ status: "closed" }).eq("id", String(formData.get("campaign_id") ?? ""));
  refresh();
}

// --------------------------------------------------------------------------
// Côté fidèle : déclarer un don, une dîme, un versement d'engagement ; s'engager
// --------------------------------------------------------------------------
const declareSchema = z.object({
  category: z.enum(["tithe", "gift", "thanksgiving", "pledge"]),
  amount,
  method: z.string().min(1),
  reference: z.string().trim().max(80).optional(),
  pledge_id: z.string().optional(),
  anonymous: z.enum(["on"]).optional(),
});

export async function declareGift(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = declareSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  if (v.method !== "cash" && !v.reference) return { fieldErrors: { reference: "Indiquez la référence reçue par SMS." } };
  const supabase = await createClient();
  const [{ data: me }, { data: accounts }] = await Promise.all([
    supabase.rpc("my_access"),
    supabase.from("cash_accounts").select("id, kind").eq("active", true).order("position"),
  ]);
  const account = (accounts ?? []).find((a) => a.kind === (v.method === "cash" ? "cash" : "mobile_money")) ?? (accounts ?? [])[0];
  if (!account) return { error: "La caisse n'a pas encore de compte. Prévenez le caissier." };
  const { error } = await supabase.from("cash_operations").insert({
    direction: "in",
    account_id: account.id,
    category: v.category,
    amount: v.amount,
    op_date: new Date().toISOString().slice(0, 10),
    anonymous: v.category === "tithe" && v.anonymous === "on",
    method: v.method,
    reference: v.reference || null,
    person_id: (me as { person_id?: string } | null)?.person_id,
    pledge_id: v.category === "pledge" ? v.pledge_id || null : null,
    source: "declaration",
  });
  if (error) return { error: explain(error) };
  refresh();
  return { success: "Merci ! Le caissier va vérifier et vous recevrez une confirmation." };
}

export async function selfPledge(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_access");
  const value = parseAmount(String(formData.get("amount") ?? ""));
  if (!value) return { fieldErrors: { amount: "Montant invalide." } };
  const { error } = await supabase.from("pledges").insert({
    campaign_id: String(formData.get("campaign_id") ?? ""),
    person_id: (me as { person_id?: string } | null)?.person_id,
    amount: value,
    due_date: optional(formData.get("due_date")),
    created_by: (me as { person_id?: string } | null)?.person_id,
  });
  if (error) return { error: explain(error) };
  refresh();
  return { success: "Merci pour votre engagement. Que Dieu vous accorde de l'honorer." };
}
