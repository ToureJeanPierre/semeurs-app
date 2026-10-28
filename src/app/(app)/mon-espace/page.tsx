import type { Metadata } from "next";
import QRCode from "qrcode";
import { CalendarX2, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { AbsenceForm } from "@/components/people/AbsenceForm";
import { Card } from "@/components/ui/Card";
import { getAccess } from "@/lib/access";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { HomeLocator } from "@/components/location/HomeLocator";
import { MyCommitments } from "@/components/my-space/MyCommitments";
import { MyPositions } from "@/components/my-space/MyPositions";
import { removeAbsence, saveMyHome } from "./actions";

export const metadata: Metadata = { title: "Mon espace" };

const dateFormat = new Intl.DateTimeFormat("fr-CI", { day: "numeric", month: "long", timeZone: "UTC" });

export default async function MySpacePage() {
  const access = await getAccess();
  const supabase = await createClient();
  if (!access.personId) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pt-5">
        <PageTitle title="Mon espace" intro="Votre compte n'est pas encore rattaché à une fiche. Parlez-en à l'administrateur." />
      </div>
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: token }, { data: absences }, reasons, { data: home }] = await Promise.all([
    supabase.rpc("my_qr_token"),
    supabase
      .from("excused_absences")
      .select("id, starts_on, ends_on, reason, note")
      .eq("person_id", access.personId)
      .gte("ends_on", today)
      .order("starts_on"),
    loadValueList("absence_reason"),
    supabase.from("people_locations").select("set_at").eq("person_id", access.personId).maybeSingle(),
  ]);
  const qr = token ? await QRCode.toString(token, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0B2A6F" } }) : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      <PageTitle title="Mon espace" />

      <MyCommitments personId={access.personId} />
      <MyPositions personId={access.personId} />

      {qr && (
        <Card className="flex flex-col items-center gap-3 text-center shadow-card">
          <h2 className="text-lg font-semibold">Mon code de présence</h2>
          <div className="w-60 rounded-2xl bg-white p-2" role="img" aria-label="Mon code QR de présence" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-sm text-muted">Présentez ce code au protocole à l&apos;entrée du culte.</p>
        </Card>
      )}

      <Card className="flex flex-col gap-2 shadow-card">
        <h2 className="text-lg font-semibold">Ma maison</h2>
        <p className="text-sm text-muted">
          Quand vous êtes chez vous, touchez le bouton : votre père de famille pourra vous rendre visite plus facilement.
        </p>
        <HomeLocator
          save={saveMyHome}
          savedLabel={home ? `Maison enregistrée le ${dateFormat.format(new Date(home.set_at))}. Vous pouvez la mettre à jour.` : null}
        />
      </Card>

      <Card className="flex flex-col gap-3 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarX2 aria-hidden className="size-5 text-royal" />
          Je serai absent(e)
        </h2>
        <p className="-mt-1 text-sm text-muted">Voyage, maladie, travail : prévenez, et personne ne s&apos;inquiétera de votre absence. Vous ne serez pas programmé(e) ces jours-là.</p>
        {(absences ?? []).length > 0 && (
          <ul className="flex flex-col divide-y divide-line">
            {(absences ?? []).map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    Du {dateFormat.format(new Date(a.starts_on))} au {dateFormat.format(new Date(a.ends_on))}
                  </span>
                  <span className="block text-sm text-muted">
                    {reasons.find((r) => r.value === a.reason)?.label ?? a.reason}
                    {a.note ? ` · ${a.note}` : ""}
                  </span>
                </span>
                <form action={removeAbsence}>
                  <input type="hidden" name="absence_id" value={a.id} />
                  <button type="submit" aria-label="Retirer cette absence" className="grid size-11 place-items-center rounded-full text-alert-text hover:bg-alert-bg">
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AbsenceForm reasons={reasons} />
      </Card>
    </div>
  );
}
