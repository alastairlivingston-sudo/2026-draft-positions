"use client";

import { useEffect } from "react";

import { getApiProvider } from "@/lib/api";
import { useLeagueStore } from "@/lib/store/league-store";

/**
 * While any match is live, polls the active API provider every
 * `intervalMs` (default 60s) for new fantasy events and ingests them
 * into the store. New API events are deduped via `ingestApiEvents`.
 */
export function useLivePolling(intervalMs = 60_000) {
  const hasLiveMatch = useLeagueStore((state) => state.matches.some((m) => m.status === "live"));
  const matches = useLeagueStore((state) => state.matches);
  const ingestApiEvents = useLeagueStore((state) => state.ingestApiEvents);

  useEffect(() => {
    if (!hasLiveMatch) return;

    const provider = getApiProvider();
    let cancelled = false;

    const poll = async () => {
      const events = await provider.getLiveEvents(matches);
      if (!cancelled && events.length > 0) {
        ingestApiEvents(events, "mock");
      }
    };

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLiveMatch, intervalMs]);
}
