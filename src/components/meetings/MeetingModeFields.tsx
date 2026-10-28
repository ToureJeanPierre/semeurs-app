"use client";

import { useState } from "react";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";

/** « Comment » puis « Lieu » : le lieu n'est demandé que si l'on se retrouve sur place. */
export function MeetingModeFields() {
  const [mode, setMode] = useState("in_person");
  return (
    <>
      <SelectField
        label="Comment"
        name="mode"
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        options={[
          { value: "in_person", label: "Sur place" },
          { value: "online", label: "En ligne (chacun chez soi)" },
          { value: "hybrid", label: "Sur place et en ligne" },
        ]}
      />
      {mode === "online" ? (
        <p className="rounded-2xl bg-ok-bg px-3 py-2 text-sm text-ok-text">La salle en ligne est créée pour vous : rien à installer, gratuit.</p>
      ) : (
        <TextField label="Lieu" name="place" placeholder="Chez le père de famille, Niangon" required />
      )}
    </>
  );
}
