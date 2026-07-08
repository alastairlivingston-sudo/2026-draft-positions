"use client";

import type { ReactNode } from "react";

import { StaleBuildBanner } from "@/components/shared/stale-build-banner";
import { LiveStatusContext } from "@/lib/contexts/live-status-context";
import { useSupabaseSnapshotPolling } from "@/lib/hooks/use-supabase-snapshot-polling";

/** Activates the Supabase snapshot poll for the whole league section and exposes its status via context. */
export function LivePollingProvider({ children }: { children: ReactNode }) {
  const status = useSupabaseSnapshotPolling();
  return (
    <LiveStatusContext.Provider value={status}>
      <StaleBuildBanner />
      {children}
    </LiveStatusContext.Provider>
  );
}
