"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/** Toutes les animations Framer Motion respectent le réglage « réduire les animations ». */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
