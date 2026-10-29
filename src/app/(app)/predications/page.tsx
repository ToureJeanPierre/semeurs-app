import type { Metadata } from "next";
import { BookOpen, ExternalLink, Search, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ListItem } from "@/components/ui/ListItem";
import { moduleImage } from "@/lib/navigation";
import { SermonForm } from "@/components/sermons/SermonForm";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getAccess, hasAny } from "@/lib/access";
import { loadPeopleOptions, personName } from "@/lib/admin";
import { formatFullDate, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { deleteSermon } from "./actions";

export const metadata: Metadata = { title: "Prédications" };

type Sermon = {
  id: string;
  title: string;
  sermon_date: string;
  preacher_name: string | null;
  theme: string | null;
  bible_text: string | null;
  summary: string | null;
  media_url: string | null;
  audio_path: string | null;
  preacher: { first_name: string; last_name: string } | null;
};

/** Médiathèque des prédications : écouter, relire, chercher par thème, texte ou prédicateur. */
export default async function SermonsPage({ searchParams }: PageProps<"/predications">) {
  const access = await getAccess();
  const manager = hasAny(access, ["sermons.manage"]);
  const q = String((await searchParams).q ?? "").trim();
  const supabase = await createClient();
  let query = supabase
    .from("sermons")
    .select("id, title, sermon_date, preacher_name, theme, bible_text, summary, media_url, audio_path, preacher:people!sermons_preacher_id_fkey(first_name, last_name)")
    .order("sermon_date", { ascending: false })
    .limit(50);
  if (q) {
    const like = `%${q.replace(/[%,()]/g, " ")}%`;
    query = query.or(`title.ilike.${like},theme.ilike.${like},bible_text.ilike.${like},preacher_name.ilike.${like},summary.ilike.${like}`);
  }
  const [{ data }, people] = await Promise.all([query, manager ? loadPeopleOptions() : Promise.resolve([])]);
  const sermons = (data ?? []) as unknown as Sermon[];
  const art = await moduleImage("sermons");
  const paths = sermons.map((s) => s.audio_path).filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length ? await supabase.storage.from("predications").createSignedUrls(paths, 3 * 3600) : { data: [] };
  const audioUrl = (p: string | null) => (p ? signed?.find((s) => s.path === p)?.signedUrl ?? undefined : undefined);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Prédications" intro="Réécouter la Parole, à tout moment." />
      <form action="/predications" className="flex min-h-13 items-center rounded-2xl border-2 border-line bg-surface px-3">
        <Search aria-hidden className="mr-2 size-5 text-muted" />
        <input name="q" defaultValue={q} type="search" placeholder="Thème, texte biblique, prédicateur…" aria-label="Chercher une prédication" className="w-full bg-transparent py-3 outline-none" />
      </form>
      {sermons.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">{q ? "Aucune prédication ne correspond." : "Les prédications seront bientôt ici."}</p>}
      {sermons.map((s) => (
        <ListItem
          key={s.id}
          title={s.title}
          tone="gold"
          image={art}
          icon="book-open"
          badge={audioUrl(s.audio_path) ? "Audio" : s.media_url ? "Vidéo" : undefined}
          meta={[
            { icon: "person", text: (s.preacher ? personName(s.preacher) : s.preacher_name) ?? "" },
            { icon: "clock", text: formatFullDate(s.sermon_date) },
          ]}
        >
          {(s.theme || s.bible_text) && (
            <p className="flex items-start gap-1.5 rounded-xl bg-[#fff4d6] px-3 py-2 text-sm font-medium text-night">
              <BookOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-royal" />
              {[s.theme, s.bible_text].filter(Boolean).join(" · ")}
            </p>
          )}
          {audioUrl(s.audio_path) && <audio controls preload="none" src={audioUrl(s.audio_path)} className="w-full" />}
          {s.media_url && (
            <a href={s.media_url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 text-sm font-semibold text-royal">
              <ExternalLink aria-hidden className="size-4" /> Regarder ou écouter
            </a>
          )}
          {s.summary && (
            <details className="rounded-xl bg-cloud px-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Résumé</summary>
              <p className="whitespace-pre-wrap pb-3 text-sm">{s.summary}</p>
            </details>
          )}
          {manager && (
            <form action={deleteSermon} className="self-end">
              <input type="hidden" name="sermon_id" value={s.id} />
              <SubmitButton aria-label="Retirer cette prédication" className="grid size-11 place-items-center rounded-full text-alert-text hover:bg-alert-bg">
                <Trash2 aria-hidden className="size-4" />
              </SubmitButton>
            </form>
          )}
        </ListItem>
      ))}
      {manager && (
        <Card className="shadow-card">
          <h2 className="mb-2 text-lg font-semibold">Publier une prédication</h2>
          <SermonForm people={people} today={todayIso()} />
        </Card>
      )}
    </div>
  );
}
