import type { ReactNode } from "react";

import { BottomNav } from "@/components/shared/bottom-nav";
import { TopBar } from "@/components/shared/top-bar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-24 pt-4 md:px-6 md:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
