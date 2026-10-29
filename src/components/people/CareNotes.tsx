import { Lock } from "lucide-react";
import { addCareNote } from "@/app/(app)/fideles/actions";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { TextAreaField } from "@/components/ui/SelectField";
import { open } from "@/lib/care-crypto";
import { serverEnv } from "@/lib/env";
import { formatFullDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** Dossier de cure d'âme : visible du seul pasteur ; notes déchiffrées sur le serveur, à l'affichage. */
export async function CareNotes({ personId }: { personId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("care_notes")
    .select("id, ciphertext, iv, tag, created_at")
    .eq("person_id", personId)
    .order("created_at", { ascending: false });
  if (error) return null;
  const key = serverEnv.careNotesKey;
  return (
    <Card className="flex flex-col gap-3 border-2 border-night/20 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Lock aria-hidden className="size-5 text-night" /> Cure d&apos;âme
      </h2>
      <p className="-mt-2 text-xs text-muted">Visible de vous seul. Les notes sont chiffrées : même la base de données ne peut pas les lire.</p>
      {(data ?? []).map((n) => (
        <div key={n.id} className="rounded-2xl bg-cloud p-3">
          <p className="text-xs font-semibold text-muted">{formatFullDate(n.created_at)}</p>
          <p className="whitespace-pre-wrap text-sm">{open(n, key) ?? "Note illisible (clé changée ?)"}</p>
        </div>
      ))}
      <ActionForm action={addCareNote} hidden={{ person_id: personId }} submitLabel="Ajouter la note">
        <TextAreaField label="Nouvelle note" name="body" rows={3} />
      </ActionForm>
    </Card>
  );
}
