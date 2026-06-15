"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { EventIcon, EVENT_LABELS } from "@/components/shared/event-icon";
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
import { isEventEligible, LOGGABLE_EVENT_TYPES } from "@/lib/scoring";
import { useLeagueStore } from "@/lib/store/league-store";
import type { FantasyEvent, FantasyEventType } from "@/lib/types";

const NO_MATCH = "none";

export function AdminEventsTab() {
  const data = useLeagueStore((s) => s);
  const addFantasyEvent = useLeagueStore((s) => s.addFantasyEvent);

  const [managerId, setManagerId] = useState(data.managers[0]?.id ?? "");
  const [assetId, setAssetId] = useState("");
  const [type, setType] = useState<FantasyEventType | "">("");
  const [matchId, setMatchId] = useState(NO_MATCH);
  const [minute, setMinute] = useState("");
  const [detail, setDetail] = useState("");

  const assets = getManagerAssets(data, managerId);
  const effectiveAssetId = assets.some((a) => a.id === assetId) ? assetId : assets[0]?.id ?? "";
  const selectedAsset = assets.find((a) => a.id === effectiveAssetId);

  const eligibleTypes = selectedAsset ? LOGGABLE_EVENT_TYPES.filter((t) => isEventEligible(selectedAsset, t)) : [];
  const effectiveType = eligibleTypes.includes(type as FantasyEventType) ? (type as FantasyEventType) : eligibleTypes[0];

  const events = data.fantasyEvents
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function handleAdd() {
    if (!effectiveAssetId || !effectiveType) return;
    addFantasyEvent({
      matchId: matchId === NO_MATCH ? null : matchId,
      assetId: effectiveAssetId,
      type: effectiveType,
      minute: minute ? Number(minute) : null,
      detail,
    });
    setMinute("");
    setDetail("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Add fantasy event</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Manager</Label>
            <Select
              value={managerId}
              onValueChange={(value) => {
                setManagerId(value as string);
                setAssetId("");
                setType("");
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
            <Label>Squad asset</Label>
            <Select
              value={effectiveAssetId}
              onValueChange={(value) => {
                setAssetId(value as string);
                setType("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.position})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Event type</Label>
            <Select value={effectiveType} onValueChange={(value) => setType(value as FantasyEventType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eligibleTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {EVENT_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Match</Label>
            <Select value={matchId} onValueChange={(value) => setMatchId(value as string)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MATCH}>No match</SelectItem>
                {data.matches.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.homeTeam} vs {m.awayTeam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Minute</Label>
            <Input
              type="number"
              min={0}
              max={120}
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              placeholder="e.g. 67"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Detail (optional)</Label>
            <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. Header from corner" />
          </div>
        </div>
        <Button onClick={handleAdd} disabled={!effectiveAssetId || !effectiveType} className="self-start">
          <Plus className="h-4 w-4" />
          Add event
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">All events ({events.length})</h3>
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: FantasyEvent }) {
  const data = useLeagueStore((s) => s);
  const updateFantasyEvent = useLeagueStore((s) => s.updateFantasyEvent);
  const deleteFantasyEvent = useLeagueStore((s) => s.deleteFantasyEvent);

  const asset = data.squadAssets.find((a) => a.id === event.assetId);
  const manager = data.managers.find((m) => m.id === event.managerId);
  const match = event.matchId ? data.matches.find((m) => m.id === event.matchId) : undefined;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [type, setType] = useState<FantasyEventType>(event.type);
  const [matchId, setMatchId] = useState(event.matchId ?? NO_MATCH);
  const [minute, setMinute] = useState(event.minute !== null ? String(event.minute) : "");
  const [detail, setDetail] = useState(event.detail ?? "");
  const [reason, setReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  const eligibleTypes = asset ? LOGGABLE_EVENT_TYPES.filter((t) => isEventEligible(asset, t)) : [];

  function handleEditSubmit() {
    if (!reason.trim()) return;
    updateFantasyEvent(
      event.id,
      {
        type,
        matchId: matchId === NO_MATCH ? null : matchId,
        minute: minute ? Number(minute) : null,
        detail,
      },
      reason,
    );
    setReason("");
    setEditOpen(false);
  }

  function handleDeleteSubmit() {
    if (!deleteReason.trim()) return;
    deleteFantasyEvent(event.id, deleteReason);
    setDeleteOpen(false);
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
      <EventIcon type={event.type} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold">{asset?.name ?? manager?.name ?? "Manual adjustment"}</span>
          <PointsPill points={event.points} size="sm" />
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {EVENT_LABELS[event.type]}
          {event.minute !== null ? ` · ${event.minute}'` : ""}
          {manager ? ` · ${manager.name}` : ""}
          {match ? ` · ${match.homeTeam} vs ${match.awayTeam}` : ""}
        </div>
        {event.detail ? <p className="truncate text-xs text-muted-foreground/80">{event.detail}</p> : null}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Edit event" />}>
          <Pencil className="h-4 w-4" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit event</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Event type</Label>
              <Select value={type} onValueChange={(value) => setType(value as FantasyEventType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eligibleTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {EVENT_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Match</Label>
              <Select value={matchId} onValueChange={(value) => setMatchId(value as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MATCH}>No match</SelectItem>
                  {data.matches.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.homeTeam} vs {m.awayTeam}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Minute</Label>
              <Input type="number" min={0} max={120} value={minute} onChange={(e) => setMinute(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Detail</Label>
              <Input value={detail} onChange={(e) => setDetail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Reason for change</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required for the audit log" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditSubmit} disabled={!reason.trim()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Delete event" />}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove {EVENT_LABELS[event.type]} ({event.points >= 0 ? "+" : ""}
            {event.points} pts) for {asset?.name}.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Reason for deletion</Label>
            <Textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Required for the audit log" />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDeleteSubmit} disabled={!deleteReason.trim()}>
              Delete event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
