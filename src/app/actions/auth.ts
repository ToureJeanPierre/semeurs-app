"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseIvorianPhone, phoneToAuthEmail } from "@/lib/phone";
import {
  clearDeviceLock,
  clearUnlock,
  getCurrentUser,
  setUnlocked,
} from "@/lib/auth/session";

export type FormState =
  | { error?: string; fieldErrors?: Record<string, string>; success?: string }
  | undefined;

const loginSchema = z.object({
  phone: z.string().trim().min(1, "Saisissez votre numéro de téléphone."),
  password: z.string().min(1, "Saisissez votre mot de passe."),
});

/** Connexion par numéro + mot de passe. */
export async function loginWithPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }

  const phone = parseIvorianPhone(parsed.data.phone);
  if (!phone) {
    return {
      fieldErrors: {
        phone: "Numéro invalide : 10 chiffres commençant par 01, 05, 07, 21, 25 ou 27.",
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToAuthEmail(phone),
    password: parsed.data.password,
  });
  if (error || !data.user) {
    // Message volontairement identique : on ne révèle pas si le numéro existe.
    return { error: "Numéro ou mot de passe incorrect. Vérifiez et réessayez." };
  }

  await setUnlocked(data.user.id);
  redirect("/");
}

/** Déverrouillage de secours par mot de passe (si l'empreinte ne marche pas). */
export async function unlockWithPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { fieldErrors: { password: "Saisissez votre mot de passe." } };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!data?.claims?.sub || !email) redirect("/connexion");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Mot de passe incorrect. Réessayez." };

  await setUnlocked(data.claims.sub);
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearUnlock();
  redirect("/connexion");
}

/** Retire une clé d'accès (la règle RLS garantit qu'elle appartient à la personne). */
export async function removePasskey(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  await supabase.from("webauthn_credentials").delete().eq("id", id);

  const { count } = await supabase
    .from("webauthn_credentials")
    .select("id", { count: "exact", head: true });
  if (!count) await clearDeviceLock();

  revalidatePath("/profil");
}
