"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, LogOut, X } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { ModuleIcon } from "@/components/ui/icons";
import { markMenuNavigation } from "./NavTrail";
import type { menuLinks } from "@/lib/navigation";

/** Menu complet : panneau qui glisse depuis le côté du bouton, entrées qui apparaissent en cascade. */
export function MenuSheet({
  open,
  onClose,
  items,
  side = "left",
}: {
  side?: "left" | "right";
  open: boolean;
  onClose: () => void;
  items: ReturnType<typeof menuLinks>;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40">
          <motion.button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-night/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.nav
            aria-label="Menu complet"
            className={`absolute inset-y-0 ${side === "left" ? "left-0" : "right-0"} flex w-[min(20rem,86vw)] flex-col bg-cloud shadow-float`}
            initial={{ x: side === "left" ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "left" ? "-100%" : "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="flex items-center gap-3 bg-royal px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
              <Logo size={48} />
              <p className="min-w-0 flex-1 font-display font-semibold leading-tight">
                Les Semeurs de la Parole
              </p>
              <button
                type="button"
                onClick={onClose}
                className="grid size-11 place-items-center rounded-full hover:bg-white/10"
                aria-label="Fermer le menu"
              >
                <X aria-hidden className="size-6" />
              </button>
            </div>

            <motion.ul
              className="flex-1 overflow-y-auto p-3"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.035, delayChildren: 0.08 } } }}
            >
              {items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <motion.li
                    key={item.href}
                    variants={{
                      hidden: { opacity: 0, x: side === "left" ? -24 : 24 },
                      show: { opacity: 1, x: 0 },
                    }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (!active) markMenuNavigation();
                        onClose();
                      }}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 ${
                        active ? "bg-royal/10" : "hover:bg-surface"
                      }`}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-royal text-white">
                        <ModuleIcon name={item.icon} className="size-5" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink">{item.label}</span>
                        {item.description && (
                          <span className="block truncate text-xs text-muted">{item.description}</span>
                        )}
                      </span>
                      {item.soon ? (
                        <span className="shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-night">
                          Bientôt
                        </span>
                      ) : (
                        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                      )}
                    </Link>
                  </motion.li>
                );
              })}
            </motion.ul>

            <form
              action={signOut}
              className="border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <button
                type="submit"
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 font-semibold text-alert-text hover:bg-alert-bg"
              >
                <LogOut aria-hidden className="size-5" />
                Se déconnecter
              </button>
            </form>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  );
}
