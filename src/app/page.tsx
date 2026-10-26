import Link from "next/link";
import { ChevronRight, Fingerprint } from "lucide-react";
import { HomeBanner } from "@/components/home/HomeBanner";
import { NextServiceCard } from "@/components/home/NextServiceCard";
import { ShortcutGrid } from "@/components/home/ShortcutGrid";
import { AppShell } from "@/components/layout/AppShell";
import { isDeviceLockedFor, requireUser } from "@/lib/auth/session";
import { loadHomeData } from "@/lib/home";
import { loadModules, moduleHref } from "@/lib/navigation";
import { formatTime, nextService } from "@/lib/services";
import { pickDailyVerse } from "@/lib/verses";

// Abidjan = UTC toute l'année.
const dayLabel = new Intl.DateTimeFormat("fr-CI", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: "Africa/Abidjan",
});

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function HomePage() {
  const user = await requireUser();
  const [passkeyActive, home, modules] = await Promise.all([
    isDeviceLockedFor(user.id),
    loadHomeData(),
    loadModules(),
  ]);

  const now = new Date();
  const next = nextService(home.services, now);
  const verse = pickDailyVerse(home.verses, now);
  const servicesModule = modules.find((m) => m.code === "services");
  const shortcuts = modules
    .filter((m) => m.home_position !== null)
    .map((m) => ({ code: m.code, label: m.label, icon: m.icon, href: moduleHref(m) }));

  return (
    <AppShell>
      <HomeBanner imageUrl={home.bannerImage} verse={verse} />

      <div className="relative mx-auto -mt-8 flex w-full max-w-lg flex-col gap-6 px-4">
        {next && (
          <NextServiceCard
            name={next.service.short_name ?? next.service.name}
            when={`${capitalize(dayLabel.format(next.startsAt))} · ${formatTime(next.service.start_time)}`}
            href={servicesModule ? moduleHref(servicesModule) : "/"}
            startsAt={next.startsAt.toISOString()}
            endsAt={next.endsAt.toISOString()}
            serverNow={now.toISOString()}
          />
        )}

        <ShortcutGrid items={shortcuts} />

        {!passkeyActive && (
          <Link
            href="/profil"
            className="flex items-center gap-3 rounded-card bg-royal/5 p-3 text-sm font-semibold text-royal"
          >
            <Fingerprint aria-hidden className="size-6 shrink-0" />
            <span className="flex-1">Ouvrir l&apos;appli avec votre empreinte ou votre schéma</span>
            <ChevronRight aria-hidden className="size-5 shrink-0" />
          </Link>
        )}
      </div>
    </AppShell>
  );
}
