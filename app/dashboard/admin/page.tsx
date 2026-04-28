import { createAdminClient } from "@/lib/supabase/admin"
import AdminDashboard from "@/components/AdminSide/AdminDashboard"

export default async function AdminPage() {
  const supabase = createAdminClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: totalAccounts },
    { count: totalServices },
    { count: totalInquiries },
    { count: inquiriesThisMonth },
  ] = await Promise.all([
    supabase.from("user_account").select("*", { count: "exact", head: true }).eq("is_archived", false),
    supabase.from("service").select("*", { count: "exact", head: true }).eq("is_archived", false),
    supabase.from("inquiry").select("*", { count: "exact", head: true }),
    supabase.from("inquiry").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
  ])

  return (
    <AdminDashboard
      totalAccounts={totalAccounts ?? 0}
      totalServices={totalServices ?? 0}
      totalInquiries={totalInquiries ?? 0}
      inquiriesThisMonth={inquiriesThisMonth ?? 0}
    />
  )
}
