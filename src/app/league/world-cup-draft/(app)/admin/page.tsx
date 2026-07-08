import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminGate } from "@/components/admin/admin-gate";

export default function AdminPage() {
  if (process.env.NEXT_PUBLIC_USE_SUPABASE === "true") {
    return (
      <AdminGate>
        <AdminDashboard />
      </AdminGate>
    );
  }
  return <AdminDashboard />;
}
