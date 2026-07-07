"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LiveStatus } from "@/lib/contexts/live-status-context";
import { useLeagueStore } from "@/lib/store/league-store";
import type { LeagueData } from "@/lib/selectors";

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Supabase-backed counterpart of useLivePolling: polls /api/league-snapshot
 * (the DB rows the cron/admin-refresh ingest already wrote) and replaces the
 * store's data wholesale via hydrateFromSnapshot, instead of deriving
 * events from ESPN client-side. Active only when NEXT_PUBLIC_USE_SUPABASE
 * is on - see LivePollingProvider.
 */
export function useSupabaseSnapshotPolling(intervalMs?: number): LiveStatus {
  const hydrateFromSnapshot = useLeagueStore((state) => state.hydrateFromSnapshot);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [staleBuild, setStaleBuild] = useState(false);
  const fetchingRef = useRef(false);

  const poll = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsFetching(true);

    try {
      const res = await fetch("/api/league-snapshot");
      if (!res.ok) return;
      const { fetchedAt, ...data }: LeagueData & { fetchedAt: string } = await res.json();

      hydrateFromSnapshot(data);
      setLastUpdatedAt(new Date(fetchedAt));

      const versionRes = await fetch("/api/version");
      if (versionRes.ok) {
        const { buildId } = await versionRes.json();
        if (buildId && buildId !== process.env.NEXT_PUBLIC_BUILD_ID) setStaleBuild(true);
      }
    } finally {
      fetchingRef.current = false;
      setIsFetching(false);
    }
  }, [hydrateFromSnapshot]);

  useEffect(() => {
    const interval = intervalMs ?? (Number(process.env.NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS) || DEFAULT_INTERVAL_MS);
    poll();
    const id = setInterval(poll, interval);
    return () => clearInterval(id);
  }, [intervalMs, poll]);

  return { lastUpdatedAt, isFetching, source: "api", staleBuild, refresh: poll };
}
