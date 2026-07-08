"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { CountryFlag } from "@/components/shared/country-flag";
import { PositionChip } from "@/components/shared/position-chip";
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
import { Switch } from "@/components/ui/switch";
import { COUNTRY_CODES } from "@/lib/countries";
import { useLeagueActions } from "@/lib/hooks/use-league-actions";
import { getManagerAssets } from "@/lib/selectors";
import { useLeagueStore } from "@/lib/store/league-store";
import type { AssetType, Position, SquadAsset } from "@/lib/types";

const POSITIONS: Position[] = ["Goalkeeper", "Defender", "Midfielder", "Striker", "Team"];
const ASSET_TYPES: AssetType[] = ["player", "team"];
const COUNTRIES = Object.keys(COUNTRY_CODES).sort((a, b) => a.localeCompare(b));

export function AdminMappingTab() {
  const data = useLeagueStore((s) => s);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        This is the current mapping of squad assets to players/teams and countries. If
        anything looks wrong, edit the row to correct the name, country, position or asset
        type - changes apply immediately and are recorded in the audit log.
      </p>
      {data.managers.map((manager) => (
        <div key={manager.id} className="flex flex-col gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{manager.name}</h3>
          <div className="flex flex-col gap-2">
            {getManagerAssets(data, manager.id).map((asset) => (
              <AssetRow key={asset.id} asset={asset} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AssetRow({ asset }: { asset: SquadAsset }) {
  const { updateSquadAsset } = useLeagueActions();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState(asset.name);
  const [country, setCountry] = useState(asset.country);
  const [position, setPosition] = useState<Position>(asset.position);
  const [assetType, setAssetType] = useState<AssetType>(asset.assetType);

  function handleOpenChange(next: boolean) {
    if (next) {
      setName(asset.name);
      setCountry(asset.country);
      setPosition(asset.position);
      setAssetType(asset.assetType);
    }
    setOpen(next);
  }

  function handleSave() {
    if (!name.trim() || !country) return;
    updateSquadAsset(asset.id, { name: name.trim(), country, position, assetType });
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
      <CountryFlag countryCode={asset.countryCode} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-bold">{asset.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {asset.country} · Slot {asset.slot} · {asset.assetType === "team" ? "Team asset" : "Player"}
        </span>
      </div>
      <PositionChip position={asset.position} />

      <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        Unavailable
        <Switch
          size="sm"
          checked={!!asset.unavailable}
          onCheckedChange={(checked) => updateSquadAsset(asset.id, { unavailable: checked })}
        />
      </label>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Edit mapping" />}>
          <Pencil className="h-4 w-4" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit squad mapping</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Country</Label>
              <Select value={country} onValueChange={(value) => setCountry(value as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Position</Label>
              <Select value={position} onValueChange={(value) => setPosition(value as Position)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Asset type</Label>
              <Select value={assetType} onValueChange={(value) => setAssetType(value as AssetType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === "player" ? "Player" : "Team"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!name.trim() || !country}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
