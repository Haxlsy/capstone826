import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const jobOrderId = url.searchParams.get("jobOrderId")

    const supabase = createAdminClient()

    let query = supabase
      .from("job_stage_progress")
      .select(
        `id, job_order_id, status, rework_instructions, handoff_notes, completed_at,
         stage:service_stage_id(id, name, category, sequence_order),
         completed_by:completed_by_id(full_name),
         media:stage_media(id, file_url, media_type, uploaded_at)`
      )
      .order("service_stage_id")

    if (jobOrderId) {
      query = query.eq("job_order_id", jobOrderId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ stages: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status, rework_instructions, handoff_notes } = body

    if (!id) {
      return NextResponse.json({ error: "Missing stage progress ID" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()
    const updatePayload: Record<string, any> = {}

    if (status !== undefined) {
      updatePayload.status = status
      if (status === "done") {
        updatePayload.completed_at     = new Date().toISOString()
        updatePayload.completed_by_id  = user.id
      }
    }
    if (rework_instructions !== undefined) updatePayload.rework_instructions = rework_instructions
    if (handoff_notes !== undefined)        updatePayload.handoff_notes       = handoff_notes

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    }

    const { data, error } = await admin
      .from("job_stage_progress")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (status !== undefined) {
      const { data: profile } = await admin.from("user_account").select("full_name, role").eq("id", user.id).single()
      if (profile) {
        const stageName = (data as any).custom_name ?? `Stage ${id}`
        logAudit({
          user_id:   user.id,
          user_name: profile.full_name,
          role:      profile.role,
          category:  "update",
          action:    status === "done" ? "Marked stage as done" : `Updated stage status to ${status}`,
          target:    stageName,
        })
      }
    }

    return NextResponse.json({ success: true, stage: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
