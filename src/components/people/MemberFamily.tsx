import { CakeSlice, MessageCircle, Phone, Sparkles } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ChatEntry } from "@/components/groups/ChatEntry";
import { ContactButtons } from "@/components/alerts/ContactButtons";
import { Card } from "@/components/ui/Card";
import { daysUntilBirthday } from "@/lib/birthdays";
import { fillTemplate, telHref, whatsappHref } from "@/lib/contact-links";
import { addDays, todayIso } from "@/lib/format";
import { loadMessageTemplate } from "@/lib/message-templates";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { Avatar } from "@/components/people/Avatar";

type Member = {
  id: string;
  first_name: string;
  name: string;
  function: string | null;
  phone: string | null;
  birthday: string | null; // MM-JJ
  joined_on: string | null;
  is_me: boolean;
  photo_path: string | null;
};
type Family = { id: string; name: string; members: Member[] };

/** Appeler / WhatsApp en deux petits boutons, pour les listes. */
function QuickContact({ member, message }: { member: Member; message?: string }) {
  if (!member.phone) return null;
  return (
    <span className="flex shrink-0 gap-1">
      <a href={telHref(member.phone)} aria-label={`Appeler ${member.name}`} className="grid size-11 place-items-center rounded-full bg-royal text-white">
        <Phone aria-hidden className="size-5" />
      </a>
      <a
        href={whatsappHref(member.phone, message)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Écrire à ${member.name} sur WhatsApp`}
        className="grid size-11 place-items-center rounded-full bg-[#1f8f4e] text-white"
      >
        <MessageCircle aria-hidden className="size-5" />
      </a>
    </span>
  );
}

/**
 * « Ma famille » pour un simple membre : se connaître, se joindre, accueillir les nouveaux,
 * se souhaiter les anniversaires. Les liens de fraternité avant tout.
 */
export async function MemberFamily() {
  const supabase = await createClient();
  const [{ data }, welcome, birthday] = await Promise.all([
    supabase.rpc("my_family"),
    loadMessageTemplate("family_welcome", "Bienvenue {prénom} dans la famille ! Que Dieu te bénisse."),
    loadMessageTemplate("birthday", "Joyeux anniversaire {prénom} !"),
  ]);
  const family = data as Family | null;
  const photos = await signPhotos((family?.members ?? []).map((m) => m.photo_path));
  const face = (m: Member) => <Avatar name={m.name} url={m.photo_path ? photos.get(m.photo_path) : null} size={44} />;
  if (!family) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pt-5">
        <PageTitle title="Ma famille" intro="Vous n'êtes pas encore rattaché(e) à une famille de l'église. Parlez-en au pasteur ou à l'administrateur." />
      </div>
    );
  }
  const today = todayIso();
  const recent = addDays(today, -30);
  const bureau = family.members.filter((m) => m.function);
  const newcomers = family.members.filter((m) => !m.is_me && m.joined_on && m.joined_on >= recent);
  const birthdays = family.members
    .filter((m) => !m.is_me && m.birthday)
    .map((m) => ({ m, inDays: daysUntilBirthday(`2000-${m.birthday}`, today) }))
    .filter((b) => b.inDays <= 7)
    .sort((a, b) => a.inDays - b.inDays);
  const others = family.members.filter((m) => !m.function);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title={family.name} intro={`${family.members.length} frères et sœurs`} />
      <ChatEntry groupId={family.id} label="Discussion de la famille" />

      {newcomers.length > 0 && (
        <Card className="flex flex-col gap-2 border-2 border-gold/60 shadow-card">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles aria-hidden className="size-5 text-gold" /> Bienvenue aux nouveaux
          </h2>
          <ul className="flex flex-col divide-y divide-line">
            {newcomers.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2">
                {face(m)}
                <span className="min-w-0 flex-1 font-semibold">{m.name}</span>
                {m.phone && (
                  <a
                    href={whatsappHref(m.phone, fillTemplate(welcome, m.first_name))}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center gap-2 rounded-full bg-[#1f8f4e] px-4 text-sm font-semibold text-white"
                  >
                    <MessageCircle aria-hidden className="size-4" /> Souhaiter la bienvenue
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {birthdays.length > 0 && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CakeSlice aria-hidden className="size-5 text-warm" /> Anniversaires de la semaine
          </h2>
          <ul className="flex flex-col divide-y divide-line">
            {birthdays.map(({ m, inDays }) => (
              <li key={m.id} className="flex items-center gap-2 py-2">
                {face(m)}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block text-sm text-muted">{inDays === 0 ? "Aujourd'hui !" : inDays === 1 ? "Demain" : `Dans ${inDays} jours`}</span>
                </span>
                {m.phone && (
                  <a
                    href={whatsappHref(m.phone, fillTemplate(birthday, m.first_name))}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center gap-2 rounded-full bg-[#1f8f4e] px-4 text-sm font-semibold text-white"
                  >
                    <MessageCircle aria-hidden className="size-4" /> Souhaiter
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {bureau.map((m) => (
        <Card key={m.id} className="flex flex-col gap-3 shadow-card">
          <p>
            <span className="block text-sm text-muted">{m.function}</span>
            <span className="block text-lg font-semibold">{m.name}</span>
          </p>
          {m.phone && !m.is_me && <ContactButtons name={m.name} phone={m.phone} />}
        </Card>
      ))}

      <Card className="flex flex-col gap-1 shadow-card">
        <h2 className="text-lg font-semibold">Frères et sœurs</h2>
        <ul className="flex flex-col divide-y divide-line">
          {others.map((m) => (
            <li key={m.id} className="flex min-h-14 items-center gap-2 py-1">
              {face(m)}
              <span className="min-w-0 flex-1 font-semibold">
                {m.name}
                {m.is_me && <span className="ml-2 text-sm font-normal text-muted">(moi)</span>}
              </span>
              {!m.is_me && <QuickContact member={m} />}
            </li>
          ))}
        </ul>
        <p className="pt-2 text-xs text-muted">Vous préférez ne pas montrer votre numéro ? Réglez-le dans Profil.</p>
      </Card>
    </div>
  );
}
