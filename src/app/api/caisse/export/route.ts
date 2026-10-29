import { NextResponse, type NextRequest } from "next/server";
import { csvLine, monthBounds } from "@/lib/cash";
import { createClient } from "@/lib/supabase/server";

/**
 * Export des opérations d'un mois au format CSV (ouvrable dans Excel). Les droits sont ceux
 * de la personne connectée (RLS) : seuls la caisse et le pasteur reçoivent des lignes.
 */
export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("mois") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Mois invalide." }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { first, last } = monthBounds(month);
  const [{ data: ops, error }, { data: accounts }, { data: lists }] = await Promise.all([
    supabase
      .from("cash_operations")
      .select("op_date, direction, amount, category, label, account_id, method, reference, status, receipt_no, anonymous, reason, person:people!cash_operations_person_id_fkey(first_name, last_name)")
      .gte("op_date", first)
      .lte("op_date", last)
      .order("op_date"),
    supabase.from("cash_accounts").select("id, name"),
    supabase.from("value_lists").select("list_code, value, label").in("list_code", ["income_category", "expense_category", "payment_method"]),
  ]);
  if (error) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const label = (code: string, value: string | null) => lists?.find((l) => l.list_code === code && l.value === value)?.label ?? value ?? "";
  const STATUS: Record<string, string> = { pending: "À valider", awaiting_pastor: "Attend le pasteur", approved: "Validée", rejected: "Refusée" };
  const lines = [
    csvLine(["Date", "Sens", "Montant", "Catégorie", "Libellé", "Compte", "Personne", "Moyen", "Référence", "Statut", "N°", "Motif"]),
    ...((ops ?? []) as unknown as {
      op_date: string; direction: string; amount: number; category: string; label: string | null; account_id: string;
      method: string | null; reference: string | null; status: string; receipt_no: string | null; anonymous: boolean; reason: string | null;
      person: { first_name: string; last_name: string } | null;
    }[]).map((o) =>
      csvLine([
        o.op_date,
        o.direction === "in" ? "Recette" : "Dépense",
        o.amount,
        label(o.direction === "in" ? "income_category" : "expense_category", o.category),
        o.label,
        accounts?.find((a) => a.id === o.account_id)?.name,
        o.anonymous ? "Anonyme" : o.person ? `${o.person.last_name} ${o.person.first_name}` : "",
        label("payment_method", o.method),
        o.reference,
        STATUS[o.status] ?? o.status,
        o.receipt_no,
        o.reason,
      ]),
    ),
  ];
  // BOM UTF-8 pour qu'Excel affiche correctement les accents.
  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="caisse-${month}.csv"`,
    },
  });
}
