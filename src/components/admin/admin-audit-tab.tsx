"use client";

import { formatDistanceToNow } from "date-fns";

import { useLeagueStore } from "@/lib/store/league-store";
import type { AuditAction } from "@/lib/types";

const ACTION_LABELS: Record<AuditAction, string> = {
  create_event: "Event created",
  update_event: "Event updated",
  delete_event: "Event deleted",
  manual_adjustment: "Manual adjustment",
  delete_adjustment: "Adjustment deleted",
  update_scoring_rules: "Scoring rules updated",
  recalculate_points: "Points recalculated",
  lock_match: "Match locked",
  unlock_match: "Match unlocked",
  update_squad_asset: "Squad mapping updated",
};

export function AdminAuditTab() {
  const auditLog = useLeagueStore((s) => s.auditLog);

  const entries = auditLog
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Audit log ({entries.length})
      </h3>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No admin actions recorded yet.</p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold">{ACTION_LABELS[entry.action]}</span>
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
              </span>
            </div>
            {(entry.assetName || entry.managerName) && (
              <p className="text-xs text-muted-foreground">
                {entry.assetName ?? entry.managerName}
                {entry.assetName && entry.managerName ? ` · ${entry.managerName}` : ""}
              </p>
            )}
            {(entry.oldValue || entry.newValue) && (
              <p className="text-xs text-muted-foreground">
                <span className="line-through opacity-70">{entry.oldValue}</span>
                {" -> "}
                <span className="font-semibold text-foreground">{entry.newValue}</span>
              </p>
            )}
            {entry.reason && <p className="text-xs text-muted-foreground/80">{entry.reason}</p>}
            <p className="text-[11px] text-muted-foreground/70">by {entry.actor}</p>
          </div>
        ))
      )}
    </div>
  );
}
