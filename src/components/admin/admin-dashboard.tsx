"use client";

import { AdminAdjustmentsTab } from "@/components/admin/admin-adjustments-tab";
import { AdminAuditTab } from "@/components/admin/admin-audit-tab";
import { AdminEventsTab } from "@/components/admin/admin-events-tab";
import { AdminMappingTab } from "@/components/admin/admin-mapping-tab";
import { AdminMatchesTab } from "@/components/admin/admin-matches-tab";
import { AdminScoringTab } from "@/components/admin/admin-scoring-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AdminDashboard() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage events, adjustments, scoring rules, matches and squad mapping</p>
      </div>

      <Tabs defaultValue="events">
        <div className="overflow-x-auto">
          <TabsList className="w-fit">
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
            <TabsTrigger value="scoring">Scoring</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="mapping">Mapping</TabsTrigger>
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
        <TabsContent value="mapping" className="pt-3">
          <AdminMappingTab />
        </TabsContent>
        <TabsContent value="audit" className="pt-3">
          <AdminAuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
