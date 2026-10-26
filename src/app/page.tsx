import { PasskeySetupCard } from "@/components/auth/PasskeySetupCard";
import { HomeHero } from "@/components/home/HomeHero";
import { NextServiceCard } from "@/components/home/NextServiceCard";
import { ShortcutGrid } from "@/components/home/ShortcutGrid";
import { VerseCard } from "@/components/home/VerseCard";
import { WeekProgramme } from "@/components/home/WeekProgramme";
import { BottomNav } from "@/components/ui/BottomNav";
import { isDeviceLockedFor, requireUser } from "@/lib/auth/session";
import { loadHomeData } from "@/lib/home";
import { formatTime, nextService, weekProgramme } from "@/lib/services";
import { pickDailyVerse } from "@/lib/verses";

// Abidjan = UTC toute l'année.
const TZ = "Africa/Abidjan";
const dayLong = new Intl.DateTimeFormat("fr-CI", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const dayShort = new Intl.DateTimeFormat("fr-CI", { weekday: "short", timeZone: TZ });
const dayNumber = new Intl.DateTimeFormat("fr-CI", { day: "numeric", timeZone: TZ });

function greetingFor(now: Date) {
  const hour = now.getUTCHours();
  if (hour < 12) return "Bonjour,";
  if (hour < 17) return "Bon après-midi,";
  return "Bonsoir,";
}

export default async function HomePage() {
  const user = await requireUser();
  const [passkeyActive, home] = await Promise.all([isDeviceLockedFor(user.id), loadHomeData()]);

  const now = new Date();
  const next = nextService(home.services, now);
  const verse = pickDailyVerse(home.verses, now);
  const programme = weekProgramme(home.services, now).map((o) => ({
    id: o.service.id,
    day: dayShort.format(o.startsAt).replace(".", ""),
    date: dayNumber.format(o.startsAt),
    name: o.service.name,
    hours: `${formatTime(o.service.start_time)} – ${formatTime(o.service.end_time)}`,
    isNext: o.service.id === next?.service.id,
  }));

  return (
    <>
      <main className="flex flex-1 flex-col pb-28">
        <HomeHero
          greeting={greetingFor(now)}
          churchName={home.profile.name}
          tagline={home.profile.tagline}
        />

        <div className="relative mx-auto -mt-14 flex w-full max-w-lg flex-col gap-5 px-4">
          {next && (
            <NextServiceCard
              name={next.service.short_name ?? next.service.name}
              when={`${dayLong.format(next.startsAt)}, ${formatTime(next.service.start_time)} – ${formatTime(next.service.end_time)}`}
              place={next.service.place}
              startsAt={next.startsAt.toISOString()}
              endsAt={next.endsAt.toISOString()}
              serverNow={now.toISOString()}
            />
          )}

          <ShortcutGrid modules={home.modules} />

          {!passkeyActive && <PasskeySetupCard />}

          {verse && <VerseCard reference={verse.reference} text={verse.text} translation={verse.translation} />}

          <WeekProgramme items={programme} />
        </div>
      </main>
      <BottomNav />
    </>
  );
}
