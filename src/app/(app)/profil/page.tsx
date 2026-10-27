import type { Metadata } from "next";
import { CircleCheck, Fingerprint, LogOut, Trash2, UserRound } from "lucide-react";
import { changePassword, removePasskey, signOut } from "@/app/actions/auth";
import { ActionForm } from "@/components/people/ActionForm";
import { TextField } from "@/components/ui/TextField";
import { PasskeySetupCard } from "@/components/auth/PasskeySetupCard";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { isDeviceLockedFor, requireUser } from "@/lib/auth/session";
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
  const thisPhoneEnrolled = await isDeviceLockedFor(user.id);
  // RLS : la personne ne reçoit que ses propres clés.
  const { data: passkeys } = await supabase
    .from("webauthn_credentials")
    .select("id, device_label, created_at, last_used_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-5">
        <Reveal>
          <Card className="flex items-center gap-4 shadow-card">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-royal text-white">
              <UserRound aria-hidden className="size-8" strokeWidth={1.8} />
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-royal">Mon compte</p>
              <p className="text-muted">{user.phone ? formatPhone(user.phone) : "Numéro inconnu"}</p>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="flex flex-col gap-4 shadow-card">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-royal/10 text-royal">
                <Fingerprint aria-hidden className="size-6" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Empreinte ou schéma</h2>
                <p className="text-sm text-muted">Téléphones autorisés à ouvrir votre compte d&apos;un geste.</p>
              </div>
            </div>

            {passkeys && passkeys.length > 0 ? (
              <ul className="flex flex-col divide-y divide-line">
                {passkeys.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.device_label}</p>
                      <p className="text-sm text-muted">Ajouté le {dateFormat.format(new Date(p.created_at))}</p>
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
              <p className="text-sm text-muted">Aucun téléphone pour l&apos;instant.</p>
            )}

            {/* Sur un téléphone déjà enregistré, pas de bouton : il créerait une clé en double. */}
            {thisPhoneEnrolled ? (
              <p className="flex items-center gap-2 rounded-2xl bg-ok-bg px-3 py-2 text-sm font-semibold text-ok-text">
                <CircleCheck aria-hidden className="size-5 shrink-0" />
                Ce téléphone est enregistré.
              </p>
            ) : (
              <PasskeySetupCard compact />
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.12}>
          <Card className="shadow-card">
            <h2 className="mb-3 text-lg font-semibold">Changer mon mot de passe</h2>
            <ActionForm action={changePassword} submitLabel="Changer le mot de passe">
              <TextField label="Mot de passe actuel" name="current" type="password" autoComplete="current-password" />
              <TextField label="Nouveau mot de passe (8 caractères ou plus)" name="next" type="password" autoComplete="new-password" />
              <TextField label="Nouveau mot de passe, encore une fois" name="confirm" type="password" autoComplete="new-password" />
            </ActionForm>
          </Card>
        </Reveal>

        <Reveal delay={0.16}>
          <form action={signOut}>
            <button
              type="submit"
              className="flex min-h-14 w-full items-center gap-3 rounded-card bg-surface px-5 font-semibold text-alert-text shadow-card"
            >
              <LogOut aria-hidden className="size-5" />
              Se déconnecter
            </button>
          </form>
        </Reveal>
      </div>
    </>
  );
}
