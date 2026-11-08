import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PosterPicker } from "@/components/events/PosterPicker";
import { PromoSection } from "@/components/home/PromoSection";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { FormCard } from "@/components/ui/FormCard";
import { SelectField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { requirePermission } from "@/lib/access";
import { formatShortDay } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { deletePromo, movePromo, savePromo, togglePromo } from "./actions";

export const metadata: Metadata = { title: "Bannières de l'accueil" };

type Slide = {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  image_path: string | null;
  theme: string;
  effect: string;
  duration_seconds: number;
  starts_on: string | null;
  ends_on: string | null;
  active: boolean;
};

type Option = { value: string; label: string };

/** Champs d'une bannière (création et modification). */
function Fields({ s, themes, effects }: { s?: Slide; themes: Option[]; effects: Option[] }) {
  return (
    <>
      <TextField label="Petite étiquette (facultatif)" name="eyebrow" placeholder="Nouveau, Ce dimanche, Grande nouvelle…" defaultValue={s?.eyebrow ?? ""} maxLength={30} />
      <TextField label="Grand titre" name="title" placeholder="Grande croisade de Yopougon" defaultValue={s?.title ?? ""} maxLength={70} required />
      <TextField label="Texte (facultatif)" name="subtitle" placeholder="Venez nombreux avec vos amis et voisins." defaultValue={s?.subtitle ?? ""} maxLength={160} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Bouton (facultatif)" name="cta_label" placeholder="Je participe" defaultValue={s?.cta_label ?? ""} maxLength={30} />
        <TextField label="Il ouvre la page" name="cta_href" placeholder="/evenements" defaultValue={s?.cta_href ?? ""} />
      </div>
      <PosterPicker name="image_path" label={s ? "Changer l'image (facultatif)" : "Image ou photo (facultatif)"} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Couleur" name="theme" options={themes} defaultValue={s?.theme ?? "royal"} />
        <SelectField label="Animation" name="effect" options={effects} defaultValue={s?.effect ?? "mix"} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Durée (s)" name="duration_seconds" inputMode="numeric" defaultValue={String(s?.duration_seconds ?? 6)} />
        <TextField label="Du" name="starts_on" type="date" defaultValue={s?.starts_on ?? ""} />
        <TextField label="Au" name="ends_on" type="date" defaultValue={s?.ends_on ?? ""} />
      </div>
    </>
  );
}

/**
 * Bannières animées de l'accueil : aperçu en direct, ordre de passage, période d'affichage,
 * couleur, animation et durée de chaque message. Les prochains événements s'y ajoutent seuls.
 */
export default async function PromosPage() {
  await requirePermission("promos.manage");
  const supabase = await createClient();
  const [{ data }, themes, effects] = await Promise.all([
    supabase.from("promo_slides").select("*").order("position").order("created_at"),
    loadValueList("promo_theme"),
    loadValueList("promo_effect"),
  ]);
  const slides = (data ?? []) as Slide[];
  const paths = slides.map((s) => s.image_path).filter((p): p is string => !!p);
  const { data: signed } = paths.length ? await supabase.storage.from("affiches").createSignedUrls(paths, 3600) : { data: [] };
  const thumb = (s: Slide) => (s.image_path ? (signed ?? []).find((x) => x.path === s.image_path)?.signedUrl : null) ?? s.image_url;
  const label = (list: Option[], v: string) => list.find((o) => o.value === v)?.label ?? v;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      <PageTitle title="Bannières de l'accueil" intro="Les messages qui défilent en haut de l'accueil, avec leurs animations. Les prochains événements s'y ajoutent tout seuls." />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Aperçu en direct</h2>
        <PromoSection />
      </section>

      <FormCard title="Nouvelle bannière" subtitle="Elle défilera tout de suite sur l'accueil." icon="megaphone" tone="gold">
        <ActionForm action={savePromo} submitLabel="Ajouter la bannière" variant="primary">
          <Fields themes={themes} effects={effects} />
        </ActionForm>
      </FormCard>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ordre de passage ({slides.length})</h2>
        {slides.map((s, i) => {
          const img = thumb(s);
          return (
            <Card key={s.id} className={`flex flex-col gap-3 shadow-card ${s.active ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-royal/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- vignette (image signée ou de l'appli) */}
                  {img && <img src={img} alt="" className={s.image_path ? "size-full object-cover" : "size-full object-contain p-1"} />}
                </span>
                <span className="min-w-0 flex-1">
                  {s.eyebrow && <span className="text-xs font-bold uppercase text-[#a86b00]">{s.eyebrow}</span>}
                  <span className="block font-display font-bold leading-tight text-night">{s.title}</span>
                  <span className="block text-xs text-muted">
                    {label(themes, s.theme)} · {label(effects, s.effect)} · {s.duration_seconds} s
                    {s.starts_on || s.ends_on
                      ? ` · ${s.starts_on ? `du ${formatShortDay(s.starts_on)}` : ""}${s.ends_on ? ` au ${formatShortDay(s.ends_on)}` : ""}`
                      : ""}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={movePromo}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="dir" value="up" />
                  <SubmitButton disabled={i === 0} className="grid size-11 place-items-center rounded-full bg-cloud text-royal" aria-label="Monter">
                    <ArrowUp aria-hidden className="size-4" />
                  </SubmitButton>
                </form>
                <form action={movePromo}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="dir" value="down" />
                  <SubmitButton disabled={i === slides.length - 1} className="grid size-11 place-items-center rounded-full bg-cloud text-royal" aria-label="Descendre">
                    <ArrowDown aria-hidden className="size-4" />
                  </SubmitButton>
                </form>
                <form action={togglePromo}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value={s.active ? "0" : "1"} />
                  <SubmitButton className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${s.active ? "bg-ok-bg text-ok-text" : "bg-cloud text-muted"}`}>
                    {s.active ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
                    {s.active ? "Affichée" : "Cachée"}
                  </SubmitButton>
                </form>
              </div>
              <details className="rounded-xl bg-cloud px-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Modifier</summary>
                <ActionForm action={savePromo} hidden={{ id: s.id }} submitLabel="Enregistrer" className="flex flex-col gap-3 pb-3">
                  <Fields s={s} themes={themes} effects={effects} />
                </ActionForm>
              </details>
              <details className="rounded-xl bg-cloud px-3">
                <summary className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-alert-text">
                  <Trash2 aria-hidden className="size-4" /> Supprimer
                </summary>
                <form action={deletePromo} className="pb-3">
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton className="min-h-11 w-full rounded-full bg-alert-ring font-semibold text-white">Supprimer cette bannière</SubmitButton>
                </form>
              </details>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
