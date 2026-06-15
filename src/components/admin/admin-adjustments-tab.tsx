"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Plus, Settings2, Trash2 } from "lucide-react";

import { PointsPill } from "@/components/shared/points-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getManagerAssets } from "@/lib/selectors";
import { useLeagueStore } from "@/lib/store/league-store";
import type { ManualAdjustment } from "@/lib/types";

const MANAGER_TOTAL = "manager-total";

export function AdminAdjustmentsTab() {
  const data = useLeagueStore((s) => s);
  const addManualAdjustment = useLeagueStore((s) => s.addManualAdjustment);

  const [managerId, setManagerId] = useState(data.managers[0]?.id ?? "");
  const [assetId, setAssetId] = useState(MANAGER_TOTAL);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");

  const assets = getManagerAssets(data, managerId);

  const adjustments = data.manualAdjustments
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function handleAdd() {
    const value = Number(points);
    if (!managerId || !points || Number.isNaN(value) || !reason.trim()) return;
    addManualAdjustment({
      managerId,
      assetId: assetId === MANAGER_TOTAL ? null : assetId,
      points: value,
      reason,
    });
    setPoints("");
    setReason("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Add manual adjustment</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Manager</Label>
            <Select
              value={managerId}
              onValueChange={(value) => {
                setManagerId(value as string);
                setAssetId(MANAGER_TOTAL);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Apply to</Label>
            <Select value={assetId} onValueChange={(value) => setAssetId(value as string)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MANAGER_TOTAL}>Manager total (not asset-specific)</SelectItem>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Points adjustment</Label>
            <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="e.g. -1 or 2" />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required - shown in the audit log and event feed" />
          </div>
        </div>
        <Button onClick={handleAdd} disabled={!points || !reason.trim()} className="self-start">
          <Plus className="h-4 w-4" />
          Add adjustment
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          All adjustments ({adjustments.length})
        </h3>
        {adjustments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No manual adjustments yet.</p>
        ) : (
          adjustments.map((adj) => <AdjustmentRow key={adj.id} adjustment={adj} />)
        )}
      </div>
    </div>
  );
}

function AdjustmentRow({ adjustment }: { adjustment: ManualAdjustment }) {
  const data = useLeagueStore((s) => s);
  const deleteManualAdjustment = useLeagueStore((s) => s.deleteManualAdjustment);

  const manager = data.managers.find((m) => m.id === adjustment.managerId);
  const asset = adjustment.assetId ? data.squadAssets.find((a) => a.id === adjustment.assetId) : undefined;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  function handleDeleteSubmit() {
    if (!deleteReason.trim()) return;
    deleteManualAdjustment(adjustment.id, deleteReason);
    setDeleteOpen(false);
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Settings2 className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold">{asset ? asset.name : `${manager?.name} (total)`}</span>
          <PointsPill points={adjustment.points} size="sm" />
        </div>
        <p className="truncate text-xs text-muted-foreground">{adjustment.reason}</p>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground/70">
          <span>{manager?.name}</span>
          <span>{formatDistanceToNow(new Date(adjustment.createdAt), { addSuffix: true })}</span>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Delete adjustment" />}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete adjustment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the {adjustment.points >= 0 ? "+" : ""}
            {adjustment.points} pt adjustment for {asset ? asset.name : `${manager?.name}'s total`}.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Reason for deletion</Label>
            <Textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Required for the audit log" />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDeleteSubmit} disabled={!deleteReason.trim()}>
              Delete adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
