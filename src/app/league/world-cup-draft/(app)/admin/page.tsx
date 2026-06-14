import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminLogin } from "@/components/admin/admin-login";
import { isAdminAuthenticated } from "@/lib/auth";

export default async function AdminPage() {
  const isAdmin = await isAdminAuthenticated();

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <AdminLogin />
      </div>
    );
  }

  return <AdminDashboard />;
}
