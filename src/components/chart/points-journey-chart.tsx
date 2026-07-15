"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Table2, TrendingUp } from "lucide-react";

import { ManagerAvatar } from "@/components/shared/manager-avatar";
import { useLeagueStore } from "@/lib/store/league-store";
import { computeDailyProgression } from "@/lib/selectors";
import { cn } from "@/lib/utils";

/** Height of a single bar row, in px. */
const ROW_H = 46;
/** Playback time to advance one full day, in ms. */
const DAY_MS = 1500;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function PointsJourneyChart() {
  const data = useLeagueStore((s) => s);
  const progression = useMemo(() => computeDailyProgression(data), [data]);
  const { days, series } = progression;
  const lastIndex = Math.max(0, days.length - 1);

  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const startedRef = useRef(false);

  // Kick off autoplay once (or jump straight to the final standings when the
  // viewer prefers reduced motion). Deferred to an animation frame so we never
  // call setState synchronously inside the effect body.
  useEffect(() => {
    if (startedRef.current || lastIndex <= 0) return;
    startedRef.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const raf = requestAnimationFrame(() => {
      if (reduced) setProgress(lastIndex);
      else setPlaying(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [lastIndex]);

  // Playback clock: advance `progress` (in day units) each frame while playing.
  useEffect(() => {
    if (!playing || reducedMotion || lastIndex <= 0) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      let reachedEnd = false;
      setProgress((p) => {
        const next = p + dt / DAY_MS;
        if (next >= lastIndex) {
          reachedEnd = true;
          return lastIndex;
        }
        return next;
      });
      if (reachedEnd) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, reducedMotion, lastIndex]);

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
        <TrendingUp className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">The points race starts at kick-off</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Once the first fantasy points are scored, watch the managers race up the board day by day.
        </p>
      </div>
    );
  }

  const p = Math.min(Math.max(progress, 0), lastIndex);
  const low = Math.floor(p);
  const high = Math.min(low + 1, lastIndex);
  const frac = p - low;
  const atEnd = p >= lastIndex;

  const valueOf = (totals: number[]) => lerp(totals[low] ?? 0, totals[high] ?? 0, frac);

  const rows = series
    .map((s) => ({ s, value: valueOf(s.totals) }))
    .sort((a, b) => b.value - a.value || a.s.manager.name.localeCompare(b.s.manager.name));

  // Scale to the current leader so their bar always fills the track and the
  // axis rescales as the field climbs — the signature bar-chart-race feel.
  const domainMax = Math.max(1, rows[0]?.value ?? 0);

  const currentDay = days[Math.min(Math.round(p), lastIndex)];

  const togglePlay = () => {
    if (reducedMotion) return;
    if (atEnd) {
      setProgress(0);
      setPlaying(true);
    } else {
      setPlaying((v) => !v);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            disabled={reducedMotion}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105 disabled:opacity-40"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
          </button>
          <button
            onClick={() => {
              setProgress(0);
              if (!reducedMotion) setPlaying(true);
            }}
            className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Replay
          </button>
        </div>
        <button
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold transition-colors",
            showTable ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Table2 className="h-3.5 w-3.5" /> Table
        </button>
      </div>

      {/* Race */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4">
        {/* Header: leader + big day counter */}
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Leading</div>
            <div className="flex items-center gap-1.5 text-lg font-black leading-tight">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: rows[0].s.manager.color }} />
              <span className="truncate">{rows[0].s.manager.name}</span>
              <span className="tabular-nums text-muted-foreground">{Math.round(rows[0].value)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black leading-none tracking-tight tabular-nums sm:text-3xl">
              {currentDay.label}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Day {Math.min(low + 1, lastIndex + 1)} of {lastIndex + 1}
            </div>
          </div>
        </div>

        <div className="relative" style={{ height: series.length * ROW_H }} role="img" aria-label={`Points race, ${currentDay.label}`}>
          {rows.map(({ s, value }, slot) => {
            const pct = Math.max(0, Math.min(100, (value / domainMax) * 100));
            const rounded = Math.round(value);
            const labelInside = pct > 86;
            const isLeader = slot === 0;
            return (
              <div
                key={s.manager.id}
                className="absolute inset-x-0 flex items-center gap-2"
                style={{
                  height: ROW_H,
                  transform: `translateY(${slot * ROW_H}px)`,
                  transition: reducedMotion ? "none" : "transform 650ms cubic-bezier(0.34, 1.2, 0.64, 1)",
                }}
              >
                <span className="w-4 shrink-0 text-right text-xs font-bold tabular-nums text-muted-foreground">
                  {slot + 1}
                </span>
                <ManagerAvatar manager={s.manager} size="sm" className="h-7 w-7 text-[10px]" />
                <span className="w-16 shrink-0 truncate text-xs font-bold sm:w-20 sm:text-sm">{s.manager.name}</span>

                {/* bar track */}
                <div className="relative h-7 min-w-0 flex-1">
                  <div
                    className="absolute inset-y-0 left-0 flex items-center justify-end rounded-r-lg pr-2"
                    style={{
                      width: `${pct}%`,
                      minWidth: 2,
                      background: `linear-gradient(90deg, ${s.manager.color}bb, ${s.manager.color})`,
                      boxShadow: isLeader ? `0 0 14px ${s.manager.color}66` : "0 1px 2px rgba(0,0,0,0.35)",
                    }}
                  >
                    {labelInside && (
                      <span className="text-xs font-black tabular-nums text-black/80">{rounded}</span>
                    )}
                  </div>
                  {!labelInside && (
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-xs font-black tabular-nums"
                      style={{ left: `calc(${pct}% + 6px)`, color: s.manager.color }}
                    >
                      {rounded}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline scrubber */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{days[0].label}</span>
          <input
            type="range"
            min={0}
            max={lastIndex}
            step={0.001}
            value={p}
            onChange={(e) => {
              setPlaying(false);
              setProgress(Number(e.target.value));
            }}
            aria-label="Scrub through tournament days"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            style={{
              background: `linear-gradient(90deg, var(--primary) ${(p / lastIndex) * 100}%, var(--muted) ${(p / lastIndex) * 100}%)`,
            }}
          />
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{days[lastIndex].label}</span>
        </div>
      </div>

      {/* Accessible table view */}
      {showTable && (
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
          <table className="w-full text-xs">
            <caption className="sr-only">Cumulative points by day for each manager</caption>
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th scope="col" className="sticky left-0 bg-card px-3 py-2 font-semibold">
                  Manager
                </th>
                {days.map((day) => (
                  <th key={day.date} scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...series]
                .sort((a, b) => b.finalTotal - a.finalTotal || a.manager.name.localeCompare(b.manager.name))
                .map((s) => (
                  <tr key={s.manager.id} className="border-b border-border/40 last:border-0">
                    <th scope="row" className="sticky left-0 whitespace-nowrap bg-card px-3 py-2 text-left font-semibold">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: s.manager.color }} />
                      {s.manager.name}
                    </th>
                    {s.totals.map((total, i) => (
                      <td key={days[i].date} className="px-3 py-2 text-right tabular-nums">
                        {total}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
