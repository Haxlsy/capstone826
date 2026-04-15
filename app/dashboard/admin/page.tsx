import { createAdminClient } from "@/lib/supabase/admin"
import AdminDashboard from "@/components/AdminSide/AdminDashboard"

export default async function AdminPage() {
  const supabase = createAdminClient()

  const { count: totalAccounts } = await supabase
    .from("user_account")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false)

  return <AdminDashboard totalAccounts={totalAccounts ?? 0} />
}
