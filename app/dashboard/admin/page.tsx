import { createAdminClient } from "@/lib/supabase/admin"
import AdminDashboard from "@/components/AdminSide/AdminDashboard"

export default async function AdminPage() {
  const supabase = createAdminClient()

  const [
    { count: totalAccounts },
    { count: totalServices },
    { data: allCustomerRows },
    { data: activeCustomerRows },
  ] = await Promise.all([
    supabase.from("user_account").select("*", { count: "exact", head: true }).eq("is_archived", false),
    supabase.from("service").select("*", { count: "exact", head: true }).eq("is_archived", false),
    supabase.from("job_order").select("customer_name"),
    supabase.from("job_order").select("customer_name").in("status", ["Pending", "Ongoing", "For Rework", "For Inspection", "For Release", "Delayed"]),
  ])

  const totalCustomers  = new Set((allCustomerRows ?? []).map((r) => r.customer_name)).size
  const activeCustomers = new Set((activeCustomerRows ?? []).map((r) => r.customer_name)).size

  return (
    <AdminDashboard
      totalAccounts={totalAccounts ?? 0}
      totalServices={totalServices ?? 0}
      totalCustomers={totalCustomers}
      activeCustomers={activeCustomers}
    />
  )
}
