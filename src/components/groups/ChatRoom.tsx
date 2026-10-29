"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizontal, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ChatMessage = { id: string; author_id: string; body: string; created_at: string; deleted_at: string | null };

const time = new Intl.DateTimeFormat("fr-CI", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const day = new Intl.DateTimeFormat("fr-CI", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Discussion d'un groupe : messages en temps réel (Supabase Realtime, sous RLS), envoi
 * immédiat à l'écran puis confirmé par la base, retrait de son message (ou modération).
 */
export function ChatRoom({
  groupId,
  me,
  names,
  initial,
  canModerate,
}: {
  groupId: string;
  me: string;
  names: Record<string, string>;
  initial: ChatMessage[];
  canModerate: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Temps réel : nouveaux messages et messages retirés.
  useEffect(() => {
    const markRead = () =>
      supabase.from("group_reads").upsert({ group_id: groupId, person_id: me, last_read_at: new Date().toISOString() }).then(() => undefined);
    void markRead();
    const channel = supabase
      .channel(`chat-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` }, (payload) => {
        const row = payload.new as ChatMessage;
        setMessages((list) => {
          const i = list.findIndex((m) => m.id === row.id);
          if (i >= 0) return list.map((m) => (m.id === row.id ? row : m));
          return [...list, row];
        });
        void markRead();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, groupId, me]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const row: ChatMessage = { id: crypto.randomUUID(), author_id: me, body, created_at: new Date().toISOString(), deleted_at: null };
    setMessages((list) => [...list, row]);
    setText("");
    setError(null);
    const { error: e2 } = await supabase.from("group_messages").insert({ id: row.id, group_id: groupId, author_id: me, body });
    if (e2) {
      setMessages((list) => list.filter((m) => m.id !== row.id));
      setText(body);
      setError("Message non envoyé. Vérifiez votre connexion et réessayez.");
    }
  }

  async function remove(id: string) {
    const deleted_at = new Date().toISOString();
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, deleted_at } : m)));
    await supabase.from("group_messages").update({ deleted_at, deleted_by: me }).eq("id", id);
  }

  const dayOf = (m: ChatMessage) => day.format(new Date(m.created_at));
  return (
    <div className="flex h-[calc(100dvh-12.5rem-env(safe-area-inset-bottom))] flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-3" aria-live="polite">
        {messages.length === 0 && (
          <p className="mx-auto mt-8 max-w-xs text-center text-muted">Soyez le premier à écrire : un mot d&apos;encouragement, une nouvelle, un sujet de prière…</p>
        )}
        {messages.map((m, i) => {
          const mine = m.author_id === me;
          const d = dayOf(m);
          const showDay = i === 0 || dayOf(messages[i - 1]) !== d;
          return (
            <div key={m.id}>
              {showDay && <p className="my-3 text-center text-xs font-semibold text-muted first-letter:uppercase">{d}</p>}
              <div className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-card ${mine ? "rounded-br-sm bg-royal text-white" : "rounded-bl-sm bg-surface"}`}>
                  {!mine && <p className="text-xs font-semibold text-royal">{names[m.author_id] ?? "Ancien membre"}</p>}
                  {m.deleted_at ? (
                    <p className={`text-sm italic ${mine ? "text-white/70" : "text-muted"}`}>Message retiré</p>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  )}
                  <p className={`mt-0.5 flex items-center justify-end gap-2 text-[11px] ${mine ? "text-white/70" : "text-muted"}`}>
                    {time.format(new Date(m.created_at))}
                    {!m.deleted_at && (mine || canModerate) && (
                      <button type="button" onClick={() => void remove(m.id)} aria-label="Retirer ce message" className="grid size-7 place-items-center rounded-full">
                        <Trash2 aria-hidden className="size-3.5" />
                      </button>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {error && <p role="alert" className="mx-3 rounded-xl bg-alert-bg px-3 py-2 text-sm text-alert-text">{error}</p>}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-line bg-surface px-3 py-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          maxLength={2000}
          placeholder="Écrire un message…"
          aria-label="Votre message"
          className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border-2 border-line bg-cloud px-3 py-2.5 text-base focus:border-ink/40"
        />
        <button type="submit" aria-label="Envoyer" disabled={!text.trim()} className="grid size-12 shrink-0 place-items-center rounded-full bg-royal text-white disabled:opacity-40">
          <SendHorizontal aria-hidden className="size-5" />
        </button>
      </form>
    </div>
  );
}
