"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { RotateCw } from "lucide-react";

import { useLiveStatus } from "@/lib/contexts/live-status-context";
import { cn } from "@/lib/utils";

interface LiveStatusIndicatorProps {
  className?: string;
}

/** Shows when the league data was last synced from the live provider, with a manual refresh button. */
export function LiveStatusIndicator({ className }: LiveStatusIndicatorProps) {
  const { lastUpdatedAt, isFetching, source, refresh } = useLiveStatus();

  // Re-render periodically so the relative "Updated Xs ago" label stays fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const label = isFetching
    ? "Updating…"
    : lastUpdatedAt
      ? `Updated ${formatDistanceToNowStrict(lastUpdatedAt, { addSuffix: true })}`
      : "Not yet synced";

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={isFetching}
      title={source === "mock" ? "Showing demo data · tap to refresh" : "Live data from ESPN · tap to refresh"}
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60",
        className,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {source === "api" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", source === "api" ? "bg-primary" : "bg-sky-400")} />
      </span>
      <span className="live-status-label hidden sm:inline">{label}</span>
      <RotateCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
    </button>
  );
}
