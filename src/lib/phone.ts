/**
 * Numéros de téléphone ivoiriens (plan à 10 chiffres depuis 2021).
 * Mobiles : 01 (Moov), 05 (MTN), 07 (Orange). Fixes : 21, 25, 27.
 */

const COUNTRY_CODE = "225";
const VALID_PREFIXES = ["01", "05", "07", "21", "25", "27"];

/**
 * Domaine technique des comptes : Supabase identifie les comptes à mot de passe
 * par une adresse e-mail. On en dérive une, invisible pour l'utilisateur, à partir
 * du numéro. « .invalid » est un domaine réservé (RFC 2606) : aucun e-mail ne
 * peut jamais y être envoyé.
 */
export const AUTH_EMAIL_DOMAIN = "telephone.semeurs.invalid";

export type IvorianPhone = {
  /** 10 chiffres nationaux, ex. « 0708310433 » */
  national: string;
  /** Format international, ex. « +2250708310433 » */
  e164: string;
};

/** Accepte « 07 08 31 04 33 », « +225 0708310433 », « 002250708310433 »… */
export function parseIvorianPhone(input: string): IvorianPhone | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 13 && digits.startsWith(COUNTRY_CODE)) {
    digits = digits.slice(COUNTRY_CODE.length);
  }
  if (digits.length !== 10) return null;
  if (!VALID_PREFIXES.includes(digits.slice(0, 2))) return null;
  return { national: digits, e164: `+${COUNTRY_CODE}${digits}` };
}

export function phoneToAuthEmail(phone: IvorianPhone): string {
  return `${COUNTRY_CODE}${phone.national}@${AUTH_EMAIL_DOMAIN}`;
}

/** Retrouve le numéro à partir de l'adresse technique du compte. */
export function authEmailToPhone(email: string | null | undefined): IvorianPhone | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (domain !== AUTH_EMAIL_DOMAIN) return null;
  return parseIvorianPhone(local);
}

/** « 0708310433 » → « 07 08 31 04 33 » */
export function formatPhone(phone: IvorianPhone): string {
  return phone.national.replace(/(\d{2})(?=\d)/g, "$1 ");
}
