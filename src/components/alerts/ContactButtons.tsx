import { MessageCircle, MessageSquareText, Phone } from "lucide-react";
import { smsHref, telHref, whatsappHref } from "@/lib/contact-links";

/**
 * Appeler, SMS, WhatsApp : chaque bouton ouvre l'application du téléphone,
 * le message (s'il y en a un) déjà écrit. La personne touche « Envoyer » elle-même.
 */
export function ContactButtons({
  name,
  phone,
  whatsapp,
  message,
  large = false,
}: {
  name: string;
  phone: string; // +225…
  whatsapp?: string | null; // numéro WhatsApp s'il est différent
  message?: string;
  large?: boolean;
}) {
  const base = large
    ? "flex min-h-14 items-center justify-center gap-2 rounded-card font-semibold text-white shadow-card"
    : "flex min-h-11 items-center justify-center gap-1.5 rounded-full text-sm font-semibold text-white";
  const icon = large ? "size-5" : "size-4";
  return (
    <div className="grid grid-cols-3 gap-2">
      <a href={telHref(phone)} aria-label={`Appeler ${name}`} className={`${base} bg-royal`}>
        <Phone aria-hidden className={icon} />
        Appeler
      </a>
      <a href={smsHref(phone, message)} aria-label={`Envoyer un SMS à ${name}`} className={`${base} bg-[#5b4bb7]`}>
        <MessageSquareText aria-hidden className={icon} />
        SMS
      </a>
      <a
        href={whatsappHref(whatsapp ?? phone, message)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Écrire à ${name} sur WhatsApp`}
        className={`${base} bg-[#1f8f4e]`}
      >
        <MessageCircle aria-hidden className={icon} />
        WhatsApp
      </a>
    </div>
  );
}
