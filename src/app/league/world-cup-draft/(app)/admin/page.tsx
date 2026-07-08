import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminGate } from "@/components/admin/admin-gate";

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  );
}
