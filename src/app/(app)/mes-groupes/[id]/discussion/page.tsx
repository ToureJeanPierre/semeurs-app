import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatRoom, type ChatMessage } from "@/components/groups/ChatRoom";
import { getAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Discussion" };

/** Discussion d'un groupe (famille, équipe, cellule…), réservée à ses membres. */
export default async function GroupChatPage({ params }: PageProps<"/mes-groupes/[id]/discussion">) {
  const { id } = await params;
  const supabase = await createClient();
  const access = await getAccess();
  if (!access.personId) notFound();
  const [{ data: group }, { data: cap }, { data: people }, { data: messages, error }, { data: leads }] = await Promise.all([
    supabase.from("groups").select("name").eq("id", id).maybeSingle(),
    supabase.from("group_capabilities").select("group_id").eq("group_id", id).eq("capability_code", "chat").maybeSingle(),
    supabase.rpc("group_people", { p_group: id }),
    supabase.from("group_messages").select("id, author_id, body, created_at, deleted_at").eq("group_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.rpc("my_groups_with", { p_permission: "groups.manage" }),
  ]);
  if (!group || !cap || error) notFound();
  const names = Object.fromEntries(((people ?? []) as { person_id: string; name: string }[]).map((p) => [p.person_id, p.name]));
  const canModerate = ((leads ?? []) as { id: string }[]).some((g) => g.id === id);

  return (
    <div className="mx-auto w-full max-w-lg">
      <h1 className="sr-only">Discussion : {group.name}</h1>
      <p className="border-b border-line bg-surface px-4 py-2 text-sm font-semibold text-royal">{group.name}</p>
      <ChatRoom groupId={id} me={access.personId} names={names} initial={((messages ?? []) as ChatMessage[]).reverse()} canModerate={canModerate} />
    </div>
  );
}
