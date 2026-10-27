"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeftRight, BookUser } from "lucide-react";
import { importContact } from "@/lib/contact-import";

// API Contact Picker (Chrome sur Android) : absente des définitions TypeScript.
type ContactsManager = {
  select: (props: ("name" | "tel")[], options?: { multiple?: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]>;
};

function contacts(): ContactsManager | undefined {
  return (navigator as Navigator & { contacts?: ContactsManager }).contacts;
}

const subscribe = () => () => {};

function setField(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement) field.value = value;
}

function getField(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement ? field.value : "";
}

/**
 * « Choisir dans mes contacts » : remplit nom, prénom et téléphone depuis le
 * répertoire du téléphone. Seul le contact choisi est lu ; le téléphone demande
 * l'accord. Invisible si le téléphone ne le permet pas (iPhone, ordinateur).
 */
export function ContactPickerButton() {
  const supported = useSyncExternalStore(subscribe, () => Boolean(contacts()), () => false);
  const ref = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<string>();
  const [imported, setImported] = useState(false);

  if (!supported) return null;

  async function pick() {
    const form = ref.current?.closest("form");
    if (!form) return;
    try {
      const [chosen] = await contacts()!.select(["name", "tel"], { multiple: false });
      if (!chosen) return;
      const c = importContact(chosen.name, chosen.tel);
      if (c.lastName) setField(form, "last_name", c.lastName);
      setField(form, "first_name", c.firstName);
      if (c.phone) setField(form, "phone", c.phone);
      setImported(true);
      setNote(
        c.phoneRejected
          ? "Ce contact n'a pas de numéro ivoirien valide : saisissez le téléphone à la main."
          : "Contact ajouté. Vérifiez que le nom et le prénom sont dans le bon ordre.",
      );
    } catch {
      setNote("Le répertoire n'a pas pu être ouvert. Saisissez les informations à la main.");
    }
  }

  function swap() {
    const form = ref.current?.closest("form");
    if (!form) return;
    const last = getField(form, "last_name");
    setField(form, "last_name", getField(form, "first_name"));
    setField(form, "first_name", last);
  }

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={pick}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-royal/10 px-5 font-semibold text-royal"
        >
          <BookUser aria-hidden className="size-5" />
          Choisir dans mes contacts
        </button>
        {imported && (
          <button
            type="button"
            onClick={swap}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-line px-4 text-sm font-semibold text-ink"
          >
            <ArrowLeftRight aria-hidden className="size-4" />
            Inverser nom et prénom
          </button>
        )}
      </div>
      {note && (
        <p role="status" className="text-sm text-muted">
          {note}
        </p>
      )}
    </div>
  );
}
