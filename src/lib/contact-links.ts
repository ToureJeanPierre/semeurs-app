/**
 * Liens qui ouvrent les applications du téléphone (Téléphone, Messages, WhatsApp)
 * avec un message déjà écrit. Rien ne part tout seul : la personne relit et
 * touche « Envoyer » elle-même (seule l'API WhatsApp payante permettrait mieux).
 */

/** Remplace {prénom} (et {prenom}, sans accent) par le prénom du fidèle. */
export function fillTemplate(body: string, firstName: string): string {
  return body.replaceAll("{prénom}", firstName).replaceAll("{prenom}", firstName);
}

export function telHref(phone: string): string {
  return `tel:${phone}`;
}

/** Messages (SMS) : `sms:+225…?body=…`, compris par Android. */
export function smsHref(phone: string, text?: string): string {
  return text ? `sms:${phone}?body=${encodeURIComponent(text)}` : `sms:${phone}`;
}

/** WhatsApp : wa.me attend le numéro sans « + ». */
export function whatsappHref(phone: string, text?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
