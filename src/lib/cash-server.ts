import "server-only";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

export type CashOperation = {
  id: string;
  account_id: string;
  direction: "in" | "out";
  amount: number;
  category: string;
  label: string | null;
  op_date: string;
  method: string | null;
  reference: string | null;
  person_id: string | null;
  pledge_id: string | null;
  attachment_path: string | null;
  source: "manual" | "count" | "declaration";
  status: "pending" | "awaiting_pastor" | "approved" | "rejected";
  receipt_no: string | null;
  entered_by: string | null;
  reason: string | null;
  reverses_id: string | null;
  anonymous: boolean;
  created_at: string;
  person: { first_name: string; last_name: string } | null;
};

export const OPERATION_COLUMNS =
  "id, account_id, direction, amount, category, label, op_date, method, reference, person_id, pledge_id, attachment_path, source, status, receipt_no, entered_by, reason, reverses_id, anonymous, created_at, person:people!cash_operations_person_id_fkey(first_name, last_name)";

/** Libellés des catégories, comptes et moyens de paiement (listes paramétrables). */
export async function loadCashLabels() {
  const supabase = await createClient();
  const [income, expense, methods, { data: accounts }] = await Promise.all([
    loadValueList("income_category"),
    loadValueList("expense_category"),
    loadValueList("payment_method"),
    supabase.from("cash_accounts").select("id, name, kind").eq("active", true).order("position"),
  ]);
  const category = (direction: string, value: string) =>
    (direction === "in" ? income : expense).find((c) => c.value === value)?.label ?? value;
  return { income, expense, methods, accounts: accounts ?? [], category };
}
