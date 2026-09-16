import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { getHeadTechnicianJobs } from "@/lib/head-technician/jobs-data"
import { getRoleCaller } from "@/lib/auth/caller"

export async function GET() {
  try {
    const auth = await getRoleCaller(["head_detailer", "head_installer"])
    if ("error" in auth) return auth.error

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const { jobs, userRole } = await getHeadTechnicianJobs(user.id)
    return NextResponse.json({ jobs, user_role: userRole })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
