import { BottomNav } from "@/components/ui/BottomNav";
import { Card } from "@/components/ui/Card";
import { LightRays } from "@/components/ui/LightRays";
import { VigilanceAvatar } from "@/components/ui/VigilanceAvatar";
import { PasskeySetupCard } from "@/components/auth/PasskeySetupCard";
import { isDeviceLockedFor, requireUser } from "@/lib/auth/session";
import { formatPhone } from "@/lib/phone";

export default async function HomePage() {
  const user = await requireUser();
  const passkeyActive = await isDeviceLockedFor(user.id);

  return (
    <>
      <main className="flex flex-1 flex-col pb-24">
        <header className="relative overflow-hidden bg-royal px-6 pb-14 pt-10 text-white">
          <LightRays />
          <div className="relative mx-auto max-w-lg">
            <p className="text-white/85">Bonjour,</p>
            <h1 className="text-3xl font-extrabold">Bienvenue aux Semeurs</h1>
            {user.phone && (
              <p className="mt-2 text-sm text-white/85">Connecté avec le {formatPhone(user.phone)}</p>
            )}
          </div>
        </header>

        <div className="relative mx-auto -mt-8 flex w-full max-w-lg flex-col gap-4 px-4">
          {!passkeyActive && <PasskeySetupCard />}

          <Card>
            <h2 className="text-xl font-semibold">L&apos;anneau de vigilance</h2>
            <p className="mt-1 text-muted">
              Aperçu : chaque fidèle sera entouré d&apos;un anneau qui montre son assiduité. Les
              vrais fidèles arrivent au lot 1.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-y-5 sm:grid-cols-5">
              <VigilanceAvatar name="Awa Koné" level="ok" showLabel />
              <VigilanceAvatar name="Yao Kouassi" level="attention" showLabel />
              <VigilanceAvatar name="Marie Gnagne" level="urgent" showLabel />
              <VigilanceAvatar name="Paul Aka" level="critical" showLabel />
              <VigilanceAvatar name="Ange Brou" level="lost" showLabel />
            </div>
          </Card>

        </div>
      </main>
      <BottomNav />
    </>
  );
}
