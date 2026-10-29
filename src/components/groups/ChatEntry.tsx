import Link from "next/link";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/** Bouton « Discussion » d'un groupe, avec le nombre de messages non lus. */
export async function ChatEntry({ groupId, label }: { groupId: string; label: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_unread_messages");
  const unread = ((data ?? []) as { group_id: string; unread: number }[]).find((u) => u.group_id === groupId)?.unread ?? 0;
  return (
    <Link href={`/mes-groupes/${groupId}/discussion`} className="flex min-h-16 items-center gap-3 rounded-card bg-royal p-4 text-white shadow-card active:scale-[0.99]">
      <MessagesSquare aria-hidden className="size-7 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-white/80">{unread ? `${unread} nouveau${unread > 1 ? "x" : ""} message${unread > 1 ? "s" : ""}` : "Échanger entre frères et sœurs"}</span>
      </span>
      {unread > 0 && <span className="grid min-w-7 place-items-center rounded-full bg-gold px-2 py-0.5 text-sm font-bold text-night">{unread}</span>}
      <ChevronRight aria-hidden className="size-5 shrink-0" />
    </Link>
  );
}
