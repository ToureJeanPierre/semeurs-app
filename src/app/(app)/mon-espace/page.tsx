import type { Metadata } from "next";
import QRCode from "qrcode";
import Link from "next/link";
import { Baby, CalendarX2, QrCode, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { AbsenceForm } from "@/components/people/AbsenceForm";
import { HashOpener } from "@/components/ui/HashOpener";
import { Card } from "@/components/ui/Card";
import { getAccess } from "@/lib/access";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { HomeLocator } from "@/components/location/HomeLocator";
import { MyCommitments } from "@/components/my-space/MyCommitments";
import { MyContributions } from "@/components/my-space/MyContributions";
import { MyGroupsNews } from "@/components/my-space/MyGroupsNews";
import { MyPath } from "@/components/my-space/MyPath";
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

  const pendingAbsences = (absences ?? []).length;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      <PageTitle title="Mon espace" />
      <HashOpener />

      {/* Raccourcis : ce que l'on vient faire ici le plus souvent. */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { href: "#signaler-absence", label: "Je serai absent(e)", icon: CalendarX2, cls: "bg-gradient-to-b from-royal to-night text-white" },
          { href: "#code", label: "Mon code de présence", icon: QrCode, cls: "bg-surface text-royal" },
          { href: "/evenements-de-vie", label: "Une nouvelle à partager", icon: Baby, cls: "bg-surface text-royal" },
        ].map((t) => {
          const cls = `flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-card p-2 text-center text-sm font-semibold shadow-card active:scale-95 ${t.cls}`;
          const body = (
            <>
              <t.icon aria-hidden className="size-6" />
              {t.label}
            </>
          );
          // Ancre dans la page : lien simple, pour que le volet visé s'ouvre (HashOpener).
          return t.href.startsWith("#") ? (
            <a key={t.href} href={t.href} className={cls}>
              {body}
            </a>
          ) : (
            <Link key={t.href} href={t.href} className={cls}>
              {body}
            </Link>
          );
        })}
      </div>

      <MyContributions personId={access.personId} />
      <MyGroupsNews personId={access.personId} />
      <MyCommitments personId={access.personId} />
      <MyPositions personId={access.personId} />
      <MyPath personId={access.personId} />

      <Card id="absence" className="flex scroll-mt-24 flex-col gap-3 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarX2 aria-hidden className="size-5 text-royal" />
          Mes absences prévues
        </h2>
        {pendingAbsences === 0 && <p className="text-sm text-muted">Aucune absence signalée.</p>}
        {pendingAbsences > 0 && (
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
        <details id="signaler-absence" className="scroll-mt-24 rounded-2xl border-2 border-[#bcd3f7] bg-gradient-to-b from-white to-[#eaf3ff] px-3">
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-display font-bold text-royal">
            <CalendarX2 aria-hidden className="size-5" /> Signaler une absence
          </summary>
          <div className="flex flex-col gap-2 pb-3">
            <p className="text-sm text-muted">Voyage, maladie, travail : prévenez, et personne ne s&apos;inquiétera. Vous ne serez pas programmé(e) ces jours-là.</p>
            <AbsenceForm reasons={reasons} />
          </div>
        </details>
      </Card>

      {qr && (
        <details id="code" className="scroll-mt-24 rounded-card bg-surface px-4 shadow-card">
          <summary className="flex min-h-14 cursor-pointer items-center gap-2 font-display text-lg font-bold text-night">
            <QrCode aria-hidden className="size-5 text-royal" /> Mon code de présence
          </summary>
          <div className="flex flex-col items-center gap-3 pb-4 text-center">
            <div className="w-60 rounded-2xl bg-white p-2" role="img" aria-label="Mon code QR de présence" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="text-sm text-muted">Présentez ce code au protocole à l&apos;entrée du culte.</p>
          </div>
        </details>
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
    </div>
  );
}
