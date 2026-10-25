import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Client « administrateur » : contourne les règles RLS.
 * Réservé au serveur, pour des opérations précises et vérifiées
 * (clés d'accès, ouverture de session après empreinte). Jamais exposé au navigateur.
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
