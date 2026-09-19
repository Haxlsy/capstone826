import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fmtDateTime } from "@/lib/time-display"
import { getAuditCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { sendPushToUser } from "@/lib/push/send"
import { getRoleCaller } from "@/lib/auth/caller"

// ── GET — fetch own submitted concerns ───────────────────────────────────────
export async function GET() {
  try {
    const auth = await getRoleCaller(["head_detailer", "head_installer"])
    if ("error" in auth) return auth.error

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    let data:  any[] | null = null
    let error: any          = null

    const primary = await admin
      .from("concern")
      .select(`
        id, title, description, status, response_note,
        submitted_at, resolved_at,
        job:job_order_id(id, job_order_code),
        stage:stage_id(id, custom_name, custom_sequence_order,
          service_stage:service_stage_id(name, sequence_order)),
        media:concern_media(id, file_url, media_type)
      `)
      .eq("submitted_by_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(50)

    data  = primary.data as any[] | null
    error = primary.error

    // Fallback: stage_id column may not exist yet (migration pending)
    if (error?.message?.includes("stage_id")) {
      const fallback = await admin
        .from("concern")
        .select(`
          id, title, description, status, response_note,
          submitted_at, resolved_at,
          job:job_order_id(id, job_order_code),
          media:concern_media(id, file_url, media_type)
        `)
        .eq("submitted_by_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(50)
      data  = fallback.data as any[] | null
      error = fallback.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const shaped = (data ?? []).map((c: any) => {
      const stageRow = c.stage as any
      const stageName =
        stageRow?.custom_name ??
        stageRow?.service_stage?.name ??
        null
      const stageOrder =
        stageRow?.custom_sequence_order ??
        stageRow?.service_stage?.sequence_order ??
        null

      return {
        id:              c.id,
        title:           c.title,
        description:     c.description,
        status:          c.status,
        response_note:   c.response_note ?? null,
        submitted_at:    fmtDateTime(c.submitted_at),
        job_display_id:  c.job?.job_order_code ?? null,
        stage_name:      stageOrder != null && stageName ? `${stageOrder}. ${stageName}` : stageName,
        media:           (c.media ?? []).map((m: any) => ({ id: m.id, url: m.file_url, type: m.media_type })),
      }
    })

    return NextResponse.json({ concerns: shaped })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST — submit a new concern ───────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const auth = await getRoleCaller(["head_detailer", "head_installer"])
    if ("error" in auth) return auth.error

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const body = await request.json()
    const { description, job_order_id, stage_id } = body as {
      description?:  string
      job_order_id?: string
      stage_id?:     string
    }

    if (!description?.trim()) return NextResponse.json({ error: "Description is required." }, { status: 400 })
    if (!job_order_id?.trim()) return NextResponse.json({ error: "A related job is required." }, { status: 400 })

    const admin = createAdminClient()

    // Auto-generate title from job + optional stage
    let autoTitle = "Job Concern"
    const { data: jobRow } = await admin
      .from("job_order")
      .select("id, job_order_code")
      .eq("id", job_order_id.trim())
      .single()
    if (jobRow) {
      autoTitle = `${(jobRow as any).job_order_code} Concern`
    }
    if (stage_id?.trim()) {
      const { data: stageRow } = await admin
        .from("job_stage_progress")
        .select("service_stage:service_stage_id(name)")
        .eq("id", stage_id.trim())
        .single()
      const stageName = (stageRow as any)?.service_stage?.name
      if (stageName) autoTitle = `${autoTitle} — ${stageName}`
    }

    const basePayload = {
      title:           autoTitle,
      description:     description.trim(),
      job_order_id:    job_order_id.trim(),
      submitted_by_id: user.id,
      status:          "Pending",
      submitted_at:    new Date().toISOString(),
    }

    let result = await admin
      .from("concern")
      .insert({ ...basePayload, ...(stage_id?.trim() ? { stage_id: stage_id.trim() } : {}) })
      .select("id")
      .single()

    // Fallback: stage_id column may not exist yet (migration pending)
    if (result.error?.message?.includes("stage_id")) {
      result = await admin
        .from("concern")
        .insert(basePayload)
        .select("id")
        .single()
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
    const data = result.data

    const caller = await getAuditCaller()
    if (caller) {
      logAuditCall(caller, {
        category: "create",
        action:   "Submitted concern",
        target:   autoTitle,
      })
    }

    // ── Notify all active Operations users ──────────────────────────────────
    try {
      const { data: opsUsers } = await admin
        .from("user_account")
        .select("id")
        .eq("role", "operations")
        .eq("is_archived", false)

      if (opsUsers?.length) {
        const concernId = (data as any)?.id
        const notifRows = opsUsers.map((u: any) => ({
          user_id:      u.id,
          type:         "concern",
          message:      autoTitle,
          job_order_id: job_order_id.trim(),
          stage_id:     stage_id?.trim() || null,
          concern_id:   concernId ?? null,
          is_read:      false,
        }))
        await admin.from("notification").insert(notifRows)
        await Promise.all(
          notifRows.map((n) =>
            sendPushToUser(n.user_id, { title: "New concern", body: autoTitle, url: concernId ? `/dashboard/concerns?concern=${concernId}` : "/dashboard/concerns" })
          )
        )
      }
    } catch (notifErr) {
      console.error("[head-technician/concerns] notification fan-out failed:", notifErr)
    }

    return NextResponse.json({ success: true, id: (data as any)?.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
