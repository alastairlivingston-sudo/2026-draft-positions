"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { IngestResult } from "@/lib/server/ingest-live-data";

/**
 * On-demand trigger for /api/admin/refresh (the same ESPN-to-Supabase
 * ingest the cron job runs on a schedule) - for an admin who doesn't want
 * to wait for the next tick. Uses the one-off `x-admin-secret` header
 * (prompted per click) rather than the dashboard's login session, since
 * it's called rarely - see /api/admin/mutate for the frequently-called path.
 */
export function AdminSupabaseRefresh() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    const secret = window.prompt("Admin passphrase");
    if (!secret) return;

    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/admin/refresh", { method: "POST", headers: { "x-admin-secret": secret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Supabase live-data refresh</p>
          <p className="text-xs text-muted-foreground">Fetch ESPN and ingest matches/events into Supabase now, instead of waiting for the cron.</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleRefresh} disabled={status === "loading"}>
          <RefreshCw className={status === "loading" ? "animate-spin" : undefined} />
          Refresh now
        </Button>
      </div>
      {status === "done" && result && (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>
            {`Matches upserted: ${result.matchesUpserted}, result events: ${result.resultEventsUpserted}, live events: ${result.liveEventsUpserted} (source: ${result.source})`}
          </AlertDescription>
        </Alert>
      )}
      {status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
