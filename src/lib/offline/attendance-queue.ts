"use client";

import Dexie, { type EntityTable } from "dexie";
import { createClient } from "@/lib/supabase/client";

/**
 * File d'attente du pointage hors connexion (docs/02 §6.3).
 *
 * Chaque geste du protocole est d'abord écrit dans le téléphone (IndexedDB),
 * puis envoyé dès que le réseau le permet, dans l'ordre. Les envois sont
 * idempotents : l'identifiant de la présence est créé sur le téléphone, et un
 * doublon (déjà pointé) est considéré comme réussi.
 */
// `at` : heure du geste sur le téléphone (ajoutée par enqueue), utile pour le dépannage.
export type QueuedOp = (
  | { key?: number; kind: "add"; id: string; sessionId: string; personId: string; mode: "list" | "manual" }
  | { key?: number; kind: "remove"; sessionId: string; personId: string }
  | { key?: number; kind: "qr"; id: string; sessionId: string; token: string }
) & { at?: number };

class AttendanceDb extends Dexie {
  queue!: EntityTable<QueuedOp, "key">;
  constructor() {
    super("semeurs-pointage");
    this.version(1).stores({ queue: "++key, sessionId" });
  }
}

let db: AttendanceDb | null = null;
function database() {
  db ??= new AttendanceDb();
  return db;
}

export async function enqueue(op: QueuedOp) {
  await database().queue.add({ ...op, at: Date.now() } as QueuedOp);
}

export async function pendingCount(sessionId?: string): Promise<number> {
  const q = database().queue;
  return sessionId ? q.where("sessionId").equals(sessionId).count() : q.count();
}

let running: Promise<number> | null = null;

/**
 * Envoie la file dans l'ordre ; s'arrête au premier échec réseau (on réessaiera).
 * Un seul envoi à la fois : un geste pendant un envoi attend la fin du précédent.
 */
export async function flush(onQrResult?: (name: string | null, error?: string) => void): Promise<number> {
  while (running) await running;
  running = send(onQrResult).finally(() => {
    running = null;
  });
  return running;
}

async function send(onQrResult?: (name: string | null, error?: string) => void): Promise<number> {
  const supabase = createClient();
  const ops = await database().queue.orderBy("key").toArray();
  let sent = 0;
  for (const op of ops) {
    let error: { code?: string; message: string } | null = null;
    if (op.kind === "add") {
      ({ error } = await supabase
        .from("attendance")
        .insert({ id: op.id, session_id: op.sessionId, person_id: op.personId, mode: op.mode }));
      if (error?.code === "23505") error = null; // déjà pointé
    } else if (op.kind === "remove") {
      ({ error } = await supabase
        .from("attendance")
        .delete()
        .eq("session_id", op.sessionId)
        .eq("person_id", op.personId));
    } else {
      const res = await supabase.rpc("record_attendance_by_qr", { p_session: op.sessionId, p_token: op.token, p_id: op.id });
      error = res.error;
      if (!error || error.code === "P0001") onQrResult?.(res.data ?? null, error?.message);
      if (error?.code === "P0001") error = null; // code inconnu : inutile de réessayer
    }
    // Erreur réseau (pas de code) : on garde l'opération et on réessaiera.
    if (error && !error.code) break;
    await database().queue.delete(op.key!);
    sent++;
  }
  return sent;
}
