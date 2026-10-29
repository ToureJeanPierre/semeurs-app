import { PageTitle } from "@/components/admin/AdminCard";
import { ContactButtons } from "@/components/alerts/ContactButtons";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

type Family = { id: string; name: string; members: { id: string; name: string; function: string | null; phone: string | null }[] };

/** « Ma famille » pour un simple membre : qui en fait partie, et comment joindre le père ou la mère de famille. */
export async function MemberFamily() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_family");
  const family = data as Family | null;
  if (!family) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pt-5">
        <PageTitle title="Ma famille" intro="Vous n'êtes pas encore rattaché(e) à une famille de l'église. Parlez-en au pasteur ou à l'administrateur." />
      </div>
    );
  }
  const bureau = family.members.filter((m) => m.function);
  const others = family.members.filter((m) => !m.function);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title={family.name} intro={`${family.members.length} membre${family.members.length > 1 ? "s" : ""}`} />
      {bureau.map((m) => (
        <Card key={m.id} className="flex flex-col gap-3 shadow-card">
          <p>
            <span className="block text-sm text-muted">{m.function}</span>
            <span className="block text-lg font-semibold">{m.name}</span>
          </p>
          {m.phone && <ContactButtons name={m.name} phone={m.phone} />}
        </Card>
      ))}
      <Card className="flex flex-col gap-1 shadow-card">
        <h2 className="text-lg font-semibold">Les membres</h2>
        <ul className="flex flex-col divide-y divide-line">
          {others.map((m) => (
            <li key={m.id} className="flex min-h-11 items-center font-semibold">
              {m.name}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
