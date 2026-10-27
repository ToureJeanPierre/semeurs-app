"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, CloudUpload, QrCode, Search, WifiOff } from "lucide-react";
import { enqueue, flush, pendingCount } from "@/lib/offline/attendance-queue";
import { QrScanner, canScanQr } from "./QrScanner";

export type RosterRow = { person_id: string; name: string; family: string | null; present: boolean };

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/**
 * Liste à cocher du protocole et scan des QR codes. Chaque geste est gardé dans
 * le téléphone puis envoyé dès que possible : une coupure de réseau ne fait rien perdre.
 */
export function AttendanceBoard({
  sessionId,
  title,
  dateLabel,
  roster,
}: {
  sessionId: string;
  title: string;
  dateLabel: string;
  roster: RosterRow[];
}) {
  const [present, setPresent] = useState(() => new Set(roster.filter((r) => r.present).map((r) => r.person_id)));
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const scanSupported = useSyncExternalStore(() => () => {}, canScanQr, () => false);

  const showFlash = useCallback((text: string, ok: boolean) => {
    setFlash({ text, ok });
    if (ok) navigator.vibrate?.(60);
    setTimeout(() => setFlash(null), 1800);
  }, []);

  const sync = useCallback(async () => {
    await flush((name, error) => {
      if (name) showFlash(`${name} : présent(e)`, true);
      else if (error) showFlash(error, false);
    });
    setPending(await pendingCount(sessionId));
  }, [sessionId, showFlash]);

  // Envoi au retour du réseau, et toutes les 15 secondes.
  useEffect(() => {
    const first = setTimeout(sync, 0);
    const timer = setInterval(sync, 15_000);
    window.addEventListener("online", sync);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("online", sync);
    };
  }, [sync]);

  async function toggle(row: RosterRow) {
    const isPresent = present.has(row.person_id);
    setPresent((prev) => {
      const next = new Set(prev);
      if (isPresent) next.delete(row.person_id);
      else next.add(row.person_id);
      return next;
    });
    if (!isPresent) navigator.vibrate?.(20);
    await enqueue(
      isPresent
        ? { kind: "remove", sessionId, personId: row.person_id }
        : { kind: "add", id: crypto.randomUUID(), sessionId, personId: row.person_id, mode: "list" },
    );
    await sync();
  }

  const onCode = useCallback(
    async (token: string) => {
      await enqueue({ kind: "qr", id: crypto.randomUUID(), sessionId, token });
      if (!navigator.onLine) showFlash("Code QR gardé : il sera envoyé au retour du réseau.", true);
      await sync();
    },
    [sessionId, sync, showFlash],
  );

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return q ? roster.filter((r) => normalize(`${r.name} ${r.family ?? ""}`).includes(q)) : roster;
  }, [roster, query]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 pb-8 pt-4">
      <div className="sticky top-16 z-10 -mx-4 flex flex-col gap-3 bg-cloud/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold">{title}</h1>
            <p className="text-sm text-muted">{dateLabel}</p>
          </div>
          <motion.p
            key={present.size}
            initial={{ scale: 1.25 }}
            animate={{ scale: 1 }}
            className="shrink-0 rounded-2xl bg-royal px-4 py-2 text-center font-display text-white"
            aria-live="polite"
          >
            <span className="block text-2xl font-extrabold leading-none">{present.size}</span>
            <span className="text-xs">présent{present.size > 1 ? "s" : ""}</span>
          </motion.p>
        </div>

        {(!online || pending > 0) && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-warn-bg px-3 py-2 text-sm font-medium text-warn-text">
            {online ? <CloudUpload aria-hidden className="size-5 shrink-0" /> : <WifiOff aria-hidden className="size-5 shrink-0" />}
            {online
              ? `${pending} pointage${pending > 1 ? "s" : ""} en cours d'envoi…`
              : `Pas de réseau : le pointage est gardé${pending ? ` (${pending} en attente)` : ""} et sera envoyé dès le retour de la connexion.`}
          </p>
        )}

        <div className="flex gap-2">
          <div className="flex min-h-12 flex-1 items-center rounded-2xl border-2 border-line bg-surface px-3 focus-within:border-ink/40">
            <Search aria-hidden className="mr-2 size-5 shrink-0 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un nom, une famille…"
              aria-label="Chercher dans la liste"
              className="w-full bg-transparent py-2.5 text-base outline-none"
            />
          </div>
          {scanSupported && (
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-gold px-4 font-semibold text-night"
            >
              <QrCode aria-hidden className="size-5" />
              Scanner
            </button>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((row) => {
          const isPresent = present.has(row.person_id);
          return (
            <li key={row.person_id}>
              <button
                type="button"
                onClick={() => toggle(row)}
                aria-pressed={isPresent}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition-colors ${
                  isPresent ? "border-ok-ring bg-ok-bg" : "border-transparent bg-surface shadow-card"
                }`}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full border-2 ${
                    isPresent ? "border-ok-ring bg-ok-ring text-white" : "border-line"
                  }`}
                >
                  {isPresent && <CircleCheck aria-hidden className="size-6" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{row.name}</span>
                  <span className="block truncate text-sm text-muted">{row.family ?? "Sans famille"}</span>
                </span>
                <span className={`text-sm font-semibold ${isPresent ? "text-ok-text" : "text-muted"}`}>
                  {isPresent ? "Présent(e)" : "—"}
                </span>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="rounded-card bg-surface p-4 text-sm text-muted">Personne ne correspond.</li>}
      </ul>

      {scanning && <QrScanner onCode={onCode} onClose={() => setScanning(false)} />}

      <AnimatePresence>
        {flash && (
          <motion.div
            role="status"
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className={`fixed inset-x-4 bottom-28 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-4 font-semibold shadow-float ${
              flash.ok ? "bg-ok-ring text-white" : "bg-alert-bg text-alert-text"
            }`}
          >
            <motion.span initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}>
              <CircleCheck aria-hidden className="size-7" />
            </motion.span>
            {flash.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
