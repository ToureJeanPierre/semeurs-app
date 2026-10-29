import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Photos de profil (stockage privé « photos ») : liens signés valables une heure,
 * demandés en une seule fois pour toute une liste.
 */
export async function signPhotos(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("photos").createSignedUrls(unique, 3600);
  const urls = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  return urls;
}
