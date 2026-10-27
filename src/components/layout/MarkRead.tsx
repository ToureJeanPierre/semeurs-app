"use client";

import { useEffect } from "react";
import { markAllRead } from "@/app/(app)/notifications/actions";

/** Une fois la page des notifications ouverte, elles sont considérées comme lues. */
export function MarkRead({ unread }: { unread: number }) {
  useEffect(() => {
    if (unread > 0) void markAllRead();
  }, [unread]);
  return null;
}
