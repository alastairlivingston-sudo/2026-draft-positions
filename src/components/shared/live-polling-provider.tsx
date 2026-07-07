"use client";

import type { ReactNode } from "react";

import { StaleBuildBanner } from "@/components/shared/stale-build-banner";
import { LiveStatusContext } from "@/lib/contexts/live-status-context";
import { useLivePolling } from "@/lib/hooks/use-live-polling";
import { useSupabaseSnapshotPolling } from "@/lib/hooks/use-supabase-snapshot-polling";

function EspnPolling({ children }: { children: ReactNode }) {
  const status = useLivePolling();
  return (
    <LiveStatusContext.Provider value={status}>
      <StaleBuildBanner />
      {children}
    </LiveStatusContext.Provider>
  );
}

function SupabasePolling({ children }: { children: ReactNode }) {
  const status = useSupabaseSnapshotPolling();
  return (
    <LiveStatusContext.Provider value={status}>
      <StaleBuildBanner />
      {children}
    </LiveStatusContext.Provider>
  );
}

/**
 * Activates the live-data poll for the whole league section and exposes its
 * status via context - reading from Supabase (see docs/supabase-migration.md
 * Phase 2) when NEXT_PUBLIC_USE_SUPABASE is on, or the existing client-side
 * ESPN-derived path otherwise. Split into two child components rather than
 * branching which hook to call inside one component, since the flag is a
 * build-time constant but the two hooks have different shapes/effects.
 */
export function LivePollingProvider({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_USE_SUPABASE === "true") {
    return <SupabasePolling>{children}</SupabasePolling>;
  }
  return <EspnPolling>{children}</EspnPolling>;
}
