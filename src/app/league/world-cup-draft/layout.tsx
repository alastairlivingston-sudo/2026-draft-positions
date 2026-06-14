import type { ReactNode } from "react";

import { LivePollingProvider } from "@/components/shared/live-polling-provider";

export default function WorldCupDraftLayout({ children }: { children: ReactNode }) {
  return <LivePollingProvider>{children}</LivePollingProvider>;
}
