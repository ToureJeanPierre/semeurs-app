import type { Metadata } from "next";
import { Fingerprint, LogOut, Trash2 } from "lucide-react";
import { removePasskey, signOut } from "@/app/actions/auth";
import { PasskeySetupCard } from "@/components/auth/PasskeySetupCard";
import { BottomNav } from "@/components/ui/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Profil" };

const dateFormat = new Intl.DateTimeFormat("fr-CI", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Abidjan",
});

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  // RLS : la personne ne reçoit que ses propres clés.
  const { data: passkeys } = await supabase
    .from("webauthn_credentials")
    .select("id, device_label, created_at, last_used_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pb-24 pt-8">
        <h1 className="text-3xl font-extrabold">Mon profil</h1>

        <Card>
          <p className="text-sm text-muted">Numéro de connexion</p>
          <p className="font-display text-2xl font-semibold">
            {user.phone ? formatPhone(user.phone) : "—"}
          </p>
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold">Empreinte ou schéma</h2>
            <p className="mt-1 text-muted">Téléphones autorisés à ouvrir votre compte d&apos;un geste.</p>
          </div>

          {passkeys && passkeys.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line">
              {passkeys.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <Fingerprint aria-hidden className="size-6 shrink-0 text-royal" strokeWidth={1.8} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.device_label}</p>
                    <p className="text-sm text-muted">
                      Ajouté le {dateFormat.format(new Date(p.created_at))}
                    </p>
                  </div>
                  <form action={removePasskey}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="grid size-11 place-items-center rounded-full text-alert-text hover:bg-alert-bg"
                      aria-label={`Retirer ${p.device_label}`}
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Aucun téléphone pour l&apos;instant.</p>
          )}

          <PasskeySetupCard compact />
        </Card>

        <form action={signOut}>
          <Button type="submit" variant="ghost" fullWidth>
            <LogOut aria-hidden className="size-5" />
            Se déconnecter
          </Button>
        </form>
      </main>
      <BottomNav />
    </>
  );
}
