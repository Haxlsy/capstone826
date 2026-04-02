import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import AdminDashboard from "@/components/AdminSide/AdminDashboard"
import { ActivityItem } from "@/components/AdminSide/RecentActivity"

export default async function AdminPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Total non-archived accounts (excluding admin role)
  const { count: totalAccounts } = await supabase
    .from("profile")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false)
    .neq("role", "admin")

  // Active (non-archived) services
  const { count: activeServices } = await supabase
    .from("service")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false)

  // Recent activity: latest 5 profile creations + latest 5 service creations
  const [{ data: recentProfiles }, { data: recentServices }] =
    await Promise.all([
      supabase
        .from("profile")
        .select("user_id, full_name, role, is_archived, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("service")
        .select("service_id, service_name, is_archived, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ])

  const activityItems: ActivityItem[] = []

  for (const p of recentProfiles ?? []) {
    const roleLabel =
      p.role === "technician"
        ? "Technician"
        : p.role === "head_technician"
        ? "Head Technician"
        : p.role === "operations"
        ? "Operations"
        : p.role === "sales"
        ? "Sales"
        : p.role

    const description = p.is_archived
      ? `Account archived — "${p.full_name}"`
      : `New ${roleLabel} account created — "${p.full_name}"`

    activityItems.push({
      id: `profile-${p.user_id}`,
      description,
      timestamp: p.created_at,
      type: "account",
    })
  }

  for (const s of recentServices ?? []) {
    const description = s.is_archived
      ? `Service archived — "${s.service_name}"`
      : `New service added — "${s.service_name}"`

    activityItems.push({
      id: `service-${s.service_id}`,
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
      reportsGenerated={0}
      recentActivity={recentActivity}
    />
  )
}
