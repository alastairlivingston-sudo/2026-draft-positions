"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Passphrase gate for the admin dashboard, active only when
 * NEXT_PUBLIC_USE_SUPABASE is on - the shared-passphrase auth model isn't
 * needed for the existing open-access localStorage mode. Checks
 * /api/admin/session on mount; on failure, shows a form that POSTs to
 * /api/admin/login and sets an httpOnly session cookie for subsequent
 * admin mutate calls (see useLeagueActions).
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "authed" | "unauthed">("loading");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data) => setStatus(data.authed ? "authed" : "unauthed"))
      .catch(() => setStatus("unauthed"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Incorrect passphrase");
      setStatus("authed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") return null;

  if (status === "unauthed") {
    return (
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-sm flex-col gap-3 rounded-2xl border border-border/60 bg-card p-6">
        <div>
          <h1 className="text-lg font-black tracking-tight">Admin login</h1>
          <p className="text-sm text-muted-foreground">Enter the shared admin passphrase to continue.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="passphrase">Passphrase</Label>
          <Input
            id="passphrase"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoFocus
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={!passphrase || submitting}>
          Log in
        </Button>
      </form>
    );
  }

  return children;
}
