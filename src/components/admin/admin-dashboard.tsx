"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { AdminAdjustmentsTab } from "@/components/admin/admin-adjustments-tab";
import { AdminAuditTab } from "@/components/admin/admin-audit-tab";
import { AdminEventsTab } from "@/components/admin/admin-events-tab";
import { AdminMatchesTab } from "@/components/admin/admin-matches-tab";
import { AdminScoringTab } from "@/components/admin/admin-scoring-tab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AdminDashboard() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage events, adjustments, scoring rules and matches</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>

      <Tabs defaultValue="events">
        <div className="overflow-x-auto">
          <TabsList className="w-fit">
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
            <TabsTrigger value="scoring">Scoring</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="events" className="pt-3">
          <AdminEventsTab />
        </TabsContent>
        <TabsContent value="adjustments" className="pt-3">
          <AdminAdjustmentsTab />
        </TabsContent>
        <TabsContent value="scoring" className="pt-3">
          <AdminScoringTab />
        </TabsContent>
        <TabsContent value="matches" className="pt-3">
          <AdminMatchesTab />
        </TabsContent>
        <TabsContent value="audit" className="pt-3">
          <AdminAuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
