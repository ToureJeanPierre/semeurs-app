import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Réception de la position envoyée depuis un lien public (fidèle sans compte).
 * Le jeton, à usage unique et limité dans le temps, est la seule autorisation.
 */
export async function POST(request: NextRequest) {
  const parsed = z
    .object({
      token: z.string().regex(/^[0-9a-f]{36}$/),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracy: z.number().min(0).max(100000).optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });

  const admin = createAdminClient();
  // On « consomme » le jeton en une seule opération : impossible de l'utiliser deux fois.
  const { data: link } = await admin
    .from("location_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", parsed.data.token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("person_id, created_by")
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "Ce lien a déjà servi ou a expiré. Demandez-en un nouveau." }, { status: 410 });

  const { error } = await admin.from("people_locations").upsert({
    person_id: link.person_id,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    accuracy_m: parsed.data.accuracy ? Math.round(parsed.data.accuracy) : null,
    set_at: new Date().toISOString(),
    set_by: link.created_by,
  });
  if (error) return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
