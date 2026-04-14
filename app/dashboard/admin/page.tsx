import { createAdminClient } from "@/lib/supabase/admin"
import AdminDashboard from "@/components/AdminSide/AdminDashboard"
import { ActivityItem } from "@/components/AdminSide/RecentActivity"

export default async function AdminPage() {
  const supabase = createAdminClient()

  // Total non-archived accounts (including all roles)
  const { count: totalAccounts } = await supabase
    .from("user_account")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false)

  // Active (non-archived) services
  const { count: activeServices } = await supabase
    .from("service")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false)

  // Active (non-archived) reports/inquiries
  const { count: totalReports } = await supabase
    .from("inquiry_record")
    .select("*", { count: "exact", head: true })
    .eq("inquiry_type", "Report")
    .eq("is_archived", false)

  // Recent activity: latest 5 account creations + latest 5 service creations
  const [{ data: recentAccounts }, { data: recentServices }] =
    await Promise.all([
      supabase
        .from("user_account")
        .select("id, full_name, role, is_archived, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("service")
        .select("id, name, is_archived, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ])

  const activityItems: ActivityItem[] = []

  for (const p of recentAccounts ?? []) {
    const roleLabel =
      p.role === "head_detailer"
        ? "Head Detailer"
        : p.role === "head_installer"
        ? "Head Installer"
        : p.role === "operations"
        ? "Operations"
        : p.role === "sales"
        ? "Sales"
        : p.role

    const description = p.is_archived
      ? `Account archived — "${p.full_name}"`
      : `New ${roleLabel} account created — "${p.full_name}"`

    activityItems.push({
      id: `account-${p.id}`,
      description,
      timestamp: p.created_at,
      type: "account",
    })
  }

  for (const s of recentServices ?? []) {
    const description = s.is_archived
      ? `Service archived — "${s.name}"`
      : `New service added — "${s.name}"`

    activityItems.push({
      id: `service-${s.id}`,
      description,
      timestamp: s.created_at,
      type: "service",
    })
  }

  // Sort merged list by timestamp descending, take top 5
  activityItems.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  const recentActivity = activityItems.slice(0, 5)

  return (
    <AdminDashboard
      totalAccounts={totalAccounts ?? 0}
      activeServices={activeServices ?? 0}
      reportsGenerated={totalReports ?? 0}
      recentActivity={recentActivity}
    />
  )
}
