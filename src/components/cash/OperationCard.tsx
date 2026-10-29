import { ArrowDownLeft, ArrowUpRight, Paperclip } from "lucide-react";
import { rejectOperation, reverseOperation, validateOperation } from "@/app/(app)/caisse/actions";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { personName } from "@/lib/admin";
import type { CashOperation } from "@/lib/cash-server";
import { formatMoney, formatShortDay } from "@/lib/format";

const STATUS: Record<CashOperation["status"], { label: string; cls: string }> = {
  pending: { label: "À valider", cls: "bg-warn-bg text-warn-text" },
  awaiting_pastor: { label: "Attend le pasteur", cls: "bg-warn-bg text-warn-text" },
  approved: { label: "Validée", cls: "bg-ok-bg text-ok-text" },
  rejected: { label: "Refusée", cls: "bg-alert-bg text-alert-text" },
};

/**
 * Une opération de caisse et ce que la personne connectée peut en faire :
 * valider (autre caissier ou pasteur au-delà du plafond), refuser avec motif, annuler par contre-opération.
 */
export function OperationCard({
  op,
  me,
  accountName,
  categoryLabel,
  canManage,
  canApprove,
  reversed,
  attachmentUrl,
}: {
  op: CashOperation;
  me: string | null;
  accountName: string;
  categoryLabel: string;
  canManage: boolean;
  canApprove: boolean;
  reversed: boolean;
  attachmentUrl?: string | null;
}) {
  const income = op.direction === "in";
  const canCheck = canManage && op.status === "pending" && op.entered_by !== me;
  const canPastor = canApprove && op.status === "awaiting_pastor";
  const who = op.anonymous ? "Anonyme" : op.person ? personName(op.person) : null;
  return (
    <Card className="flex flex-col gap-2 shadow-card">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${income ? "bg-ok-bg text-ok-text" : "bg-alert-bg text-alert-text"}`}>
          {income ? <ArrowDownLeft aria-hidden className="size-5" /> : <ArrowUpRight aria-hidden className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            {op.amount < 0 ? "Annulation · " : ""}
            {op.label || categoryLabel}
          </span>
          <span className="block text-sm text-muted">
            {categoryLabel} · {accountName} · {formatShortDay(op.op_date)}
            {who ? ` · ${who}` : ""}
            {op.reference ? ` · réf. ${op.reference}` : ""}
          </span>
        </span>
        <span className={`shrink-0 font-display text-lg font-bold ${income ? "text-ok-text" : "text-alert-text"} ${reversed ? "line-through" : ""}`}>
          {income ? "+" : "−"}
          {formatMoney(Math.abs(op.amount))}
        </span>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS[op.status].cls}`}>{STATUS[op.status].label}</span>
        {op.receipt_no && <span className="text-muted">n° {op.receipt_no}</span>}
        {op.source === "declaration" && <span className="text-muted">déclarée par le fidèle</span>}
        {op.source === "count" && <span className="text-muted">comptage à deux</span>}
        {op.reason && <span className="text-muted">« {op.reason} »</span>}
        {attachmentUrl && (
          <a href={attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-royal">
            <Paperclip aria-hidden className="size-3.5" /> Justificatif
          </a>
        )}
      </p>
      {canManage && op.status === "pending" && op.entered_by === me && (
        <p className="text-xs text-muted">Vous l&apos;avez saisie : un autre caissier doit la valider.</p>
      )}
      {(canCheck || canPastor) && (
        <div className="flex flex-col gap-2">
          <form action={validateOperation}>
            <input type="hidden" name="operation_id" value={op.id} />
            <SubmitButton className="min-h-11 w-full rounded-full bg-ok-ring font-semibold text-white">
              {canPastor ? "Approuver la dépense" : "Valider"}
            </SubmitButton>
          </form>
          <details className="rounded-xl bg-cloud px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-alert-text">Refuser</summary>
            <ActionForm action={rejectOperation} hidden={{ operation_id: op.id }} submitLabel="Refuser" className="flex flex-col gap-3 pb-3">
              <TextField label="Motif" name="reason" required />
            </ActionForm>
          </details>
        </div>
      )}
      {canManage && op.status === "approved" && op.amount > 0 && !reversed && (
        <details className="rounded-xl bg-cloud px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-alert-text">Annuler (contre-opération)</summary>
          <ActionForm action={reverseOperation} hidden={{ operation_id: op.id }} submitLabel="Enregistrer l'annulation" className="flex flex-col gap-3 pb-3">
            <TextField label="Motif (obligatoire)" name="reason" required />
          </ActionForm>
        </details>
      )}
    </Card>
  );
}
