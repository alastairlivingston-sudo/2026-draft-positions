"use client";

import type { ReactNode } from "react";

import { StaleBuildBanner } from "@/components/shared/stale-build-banner";
import { LiveStatusContext } from "@/lib/contexts/live-status-context";
import { useLivePolling } from "@/lib/hooks/use-live-polling";

/** Activates the live-data poll for the whole league section and exposes its status via context. */
export function LivePollingProvider({ children }: { children: ReactNode }) {
  const status = useLivePolling();
  return (
    <LiveStatusContext.Provider value={status}>
      <StaleBuildBanner />
      {children}
    </LiveStatusContext.Provider>
  );
}
