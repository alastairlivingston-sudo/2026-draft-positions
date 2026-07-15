"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Cast, LayoutDashboard, LineChart, ScrollText, Trophy } from "lucide-react";

import { LiveStatusIndicator } from "@/components/shared/live-status-indicator";
import { cn } from "@/lib/utils";

const BASE = "/league/world-cup-draft";

const NAV_ITEMS = [
  { href: BASE, label: "Leaderboard", icon: Trophy, match: (p: string) => p === BASE || p.startsWith(`${BASE}/manager`) },
  { href: `${BASE}/matches`, label: "Matches", icon: CalendarDays, match: (p: string) => p.startsWith(`${BASE}/matches`) },
  { href: `${BASE}/trends`, label: "Race", icon: LineChart, match: (p: string) => p.startsWith(`${BASE}/trends`) },
  { href: `${BASE}/events`, label: "Feed", icon: ScrollText, match: (p: string) => p.startsWith(`${BASE}/events`) },
  { href: `${BASE}/rules`, label: "Rules", icon: BookOpen, match: (p: string) => p.startsWith(`${BASE}/rules`) },
  { href: `${BASE}/admin`, label: "Admin", icon: LayoutDashboard, match: (p: string) => p.startsWith(`${BASE}/admin`) },
];

export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href={BASE} className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-base font-black text-background shadow-lg shadow-primary/20">
            🏆
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-extrabold tracking-tight">World Cup Draft</span>
            <span className="text-[11px] text-muted-foreground">8-Manager Fantasy League</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LiveStatusIndicator />
          <Link
            href={`${BASE}/cast`}
            className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            target="_blank"
          >
            <Cast className="h-4 w-4" />
            <span className="hidden sm:inline">Cast mode</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
