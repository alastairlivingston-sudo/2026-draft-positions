"use client";

import type { ReactNode } from "react";

import { useLivePolling } from "@/lib/hooks/use-live-polling";

/** Activates the 60s live-event poll for the whole league section. */
export function LivePollingProvider({ children }: { children: ReactNode }) {
  useLivePolling();
  return <>{children}</>;
}
