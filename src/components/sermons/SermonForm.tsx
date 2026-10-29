"use client";

import { useActionState, useState } from "react";
import { saveSermon } from "@/app/(app)/predications/actions";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { PersonPicker, type PersonOption } from "@/components/admin/PersonPicker";
import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { createClient } from "@/lib/supabase/client";

/** Publier une prédication : l'audio part directement du téléphone vers le stockage (jusqu'à 50 Mo). */
export function SermonForm({ people, today }: { people: PersonOption[]; today: string }) {
  const [state, action, pending] = useActionState(saveSermon, undefined);
  const [audioPath, setAudioPath] = useState("");
  const [upload, setUpload] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setUpload("error");
      return;
    }
    setUpload("sending");
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${today.slice(0, 4)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from("predications").upload(path, file, { contentType: file.type || "audio/mpeg" });
    if (error) {
      setUpload("error");
      return;
    }
    setAudioPath(path);
    setUpload("done");
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="audio_path" value={audioPath} />
      <TextField label="Titre" name="title" placeholder="La foi qui déplace les montagnes" required />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Date" name="sermon_date" type="date" defaultValue={today} />
        <TextField label="Texte biblique" name="bible_text" placeholder="Marc 11.22-24" />
      </div>
      <PersonPicker name="preacher_id" label="Prédicateur" people={people} />
      <TextField label="… ou prédicateur invité" name="preacher_name" />
      <TextField label="Thème" name="theme" />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Enregistrement audio (MP3, M4A… 50 Mo au plus)
        <input type="file" accept="audio/*" onChange={onFile} className="min-h-12 rounded-2xl border-2 border-dashed border-line bg-cloud p-3 text-sm font-normal" />
        <span className="font-normal text-muted">
          {upload === "sending" && "Envoi en cours… gardez l'écran ouvert."}
          {upload === "done" && "Audio envoyé ✓"}
          {upload === "error" && "Échec de l'envoi (fichier trop lourd ou réseau). Réessayez ou utilisez un lien."}
        </span>
      </label>
      <TextField label="… ou lien YouTube / Facebook" name="media_url" type="url" placeholder="https://youtu.be/…" />
      <TextAreaField label="Résumé, notes" name="summary" rows={4} />
      <FormFeedback state={state} />
      <Button type="submit" loading={pending} disabled={upload === "sending"}>
        Publier la prédication
      </Button>
    </form>
  );
}
