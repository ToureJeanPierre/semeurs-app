import { headers } from "next/headers";
import { MapPin, Navigation } from "lucide-react";
import { createLocationLink } from "@/app/(app)/fideles/actions";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { LocationLinkForm } from "./LocationLinkForm";

const dateFormat = new Intl.DateTimeFormat("fr-CI", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

/**
 * Domicile sur la fiche : itinéraire (si l'on fait partie du périmètre autorisé :
 * père de famille, délégué, pasteur et assistants), et lien de position à envoyer.
 */
export async function PersonHome({
  personId,
  firstName,
  phone,
  canManage,
}: {
  personId: string;
  firstName: string;
  phone: string | null;
  canManage: boolean;
}) {
  const supabase = await createClient();
  const { data: home } = await supabase.from("people_locations").select("lat, lng, set_at").eq("person_id", personId).maybeSingle();
  if (!home && !canManage) return null;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  return (
    <section aria-labelledby="domicile">
      <h2 id="domicile" className="mb-2 text-lg font-semibold">Domicile</h2>
      <Card className="flex flex-col gap-3 shadow-card">
        {home ? (
          <>
            <p className="flex items-center gap-2 text-sm text-muted">
              <MapPin aria-hidden className="size-4 text-alert-ring" />
              Position enregistrée le {dateFormat.format(new Date(home.set_at))}
            </p>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${home.lat},${home.lng}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-royal font-semibold text-white"
            >
              <Navigation aria-hidden className="size-5" />
              Itinéraire jusqu&apos;à chez {firstName}
            </a>
          </>
        ) : (
          <p className="text-sm text-muted">La position du domicile n&apos;est pas encore enregistrée.</p>
        )}
        {canManage && (
          <LocationLinkForm action={createLocationLink} personId={personId} firstName={firstName} phone={phone} origin={origin} />
        )}
      </Card>
    </section>
  );
}
