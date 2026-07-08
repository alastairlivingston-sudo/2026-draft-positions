"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ResetResult } from "@/app/api/admin/reset/route";

const CONFIRM_PHRASE = "RESET";

/**
 * Wipes every table (see /api/admin/reset) - for recovering from a bad
 * ingest or duplicate events by starting clean and re-seeding. This is
 * the one genuinely destructive admin action, so it asks the admin to
 * type a confirmation phrase rather than just click through a dialog.
 */
export function AdminResetButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    const typed = window.prompt(`This permanently deletes every manager, squad, match and event. Type ${CONFIRM_PHRASE} to continue.`);
    if (typed !== CONFIRM_PHRASE) return;

    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/admin/reset", { method: "POST" });
      const data: ResetResult = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-destructive/40 bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Clear all data</p>
          <p className="text-xs text-muted-foreground">Deletes every row in every table. Use &quot;Seed database&quot; afterwards to start clean.</p>
        </div>
        <Button size="sm" variant="destructive" onClick={handleReset} disabled={status === "loading"}>
          <Trash2 className={status === "loading" ? "animate-pulse" : undefined} />
          Clear all
        </Button>
      </div>
      {status === "done" && result && (
        <Alert>
          <AlertTitle>Cleared</AlertTitle>
          <AlertDescription>{result.cleared.join(", ")}</AlertDescription>
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
