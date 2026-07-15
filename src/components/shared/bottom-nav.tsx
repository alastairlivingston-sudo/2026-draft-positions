"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, LayoutDashboard, LineChart, ScrollText, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

const BASE = "/league/world-cup-draft";

const NAV_ITEMS = [
  { href: BASE, label: "League", icon: Trophy, match: (p: string) => p === BASE || p.startsWith(`${BASE}/manager`) },
  { href: `${BASE}/matches`, label: "Matches", icon: CalendarDays, match: (p: string) => p.startsWith(`${BASE}/matches`) },
  { href: `${BASE}/trends`, label: "Race", icon: LineChart, match: (p: string) => p.startsWith(`${BASE}/trends`) },
  { href: `${BASE}/events`, label: "Feed", icon: ScrollText, match: (p: string) => p.startsWith(`${BASE}/events`) },
  { href: `${BASE}/rules`, label: "Rules", icon: BookOpen, match: (p: string) => p.startsWith(`${BASE}/rules`) },
  { href: `${BASE}/admin`, label: "Admin", icon: LayoutDashboard, match: (p: string) => p.startsWith(`${BASE}/admin`) },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-card/90 backdrop-blur-lg md:hidden">
      <div className="mx-auto flex max-w-2xl items-stretch justify-between px-2">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_var(--primary)]")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
