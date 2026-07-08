"use client";

import { useState } from "react";
import { DatabaseZap } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SeedResult } from "@/app/api/admin/seed/route";

/**
 * One-time (but safe to re-run) trigger for /api/admin/seed - loads the
 * curated league data into Supabase. Exists as a button, not just a curl
 * command, so first-time setup doesn't require a terminal (e.g. from a
 * phone/tablet): tap it, enter the passphrase, done. Uses the one-off
 * `x-admin-secret` header like AdminSupabaseRefresh, since it's called
 * rarely.
 */
export function AdminSeedButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    if (!window.confirm("Load the curated league data into Supabase? Safe to re-run, but overwrites any admin edits made to seeded rows since the last run.")) {
      return;
    }
    const secret = window.prompt("Admin passphrase");
    if (!secret) return;

    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/admin/seed", { method: "POST", headers: { "x-admin-secret": secret } });
      const data: SeedResult = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Supabase database seed</p>
          <p className="text-xs text-muted-foreground">Load managers, squads, matches and curated events into a freshly-created database.</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleSeed} disabled={status === "loading"}>
          <DatabaseZap className={status === "loading" ? "animate-pulse" : undefined} />
          Seed database
        </Button>
      </div>
      {status === "done" && result && (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{result.steps.map((s) => `${s.table}: ${s.count}`).join(", ")}</AlertDescription>
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
