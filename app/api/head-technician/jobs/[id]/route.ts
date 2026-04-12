import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ── Mock detail records (keyed by raw_id "1" / "2") ─────────────────────────
const MOCK_DETAILS: Record<string, object> = {
  "1": {
    job_id:           "JO-2026-001",
    raw_id:           "1",
    customer_name:    "Juan Dela Cruz",
    plate_number:     "ABC-1234",
    car_make:         "Toyota Fortuner",
    car_color:        "White",
    service:          "Ceramic Coating",
    technician_name:  "Pedro Santos",
    scheduled_start:  "Apr 12, 2026",
    status:           "Ongoing",
    timeline: [
      { status: "Pending",  changed_at: "Apr 10, 2026 — 8:00 AM",  changed_by: "System" },
      { status: "Ongoing",  changed_at: "Apr 12, 2026 — 9:00 AM",  changed_by: "Pedro Santos" },
    ],
    handoff_notes: null,
    stages: [
      {
        stage_template_id: 1,
        name:         "Surface Preparation",
        order:        1,
        category:     "preparation",
        done:         true,
        submitted_at: "Apr 12, 2026 — 9:30 AM",
        media:        [],
      },
      {
        stage_template_id: 2,
        name:         "Base Coat Application",
        order:        2,
        category:     "preparation",
        done:         true,
        submitted_at: "Apr 12, 2026 — 11:00 AM",
        media:        [],
      },
      {
        stage_template_id: 3,
        name:         "Top Coat & Curing",
        order:        3,
        category:     "preparation",
        done:         false,
        submitted_at: null,
        media:        [],
      },
    ],
  },
  "2": {
    job_id:           "JO-2026-002",
    raw_id:           "2",
    customer_name:    "Maria Reyes",
    plate_number:     "XYZ-5678",
    car_make:         "Honda CR-V",
    car_color:        "Black",
    service:          "Window Tinting",
    technician_name:  "Rosa Tan",
    scheduled_start:  "Apr 13, 2026",
    status:           "Pending",
    handoff_notes:    "Surface cleaned and prepped. Rear windows need extra care — previous tint residue.",
    timeline: [
      { status: "Pending", changed_at: "Apr 11, 2026 — 3:00 PM", changed_by: "System" },
    ],
    stages: [
      {
        stage_template_id: 4,
        name:         "Window Cleaning",
        order:        1,
        category:     "preparation",
        done:         true,
        submitted_at: "Apr 13, 2026 — 10:30 AM",
        media:        [],
      },
      {
        stage_template_id: 5,
        name:         "Tint Film Application",
        order:        2,
        category:     "installation",
        done:         false,
        submitted_at: null,
        media:        [],
      },
    ],
  },
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Auth check
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    // Return mock detail for IDs "1" and "2"
    if (MOCK_DETAILS[id]) {
      return NextResponse.json({ job: MOCK_DETAILS[id] })
    }

    // ── Real DB path (UUID) ──────────────────────────────────────────────────
    const admin = createAdminClient()

    const { data: job, error } = await admin
      .from("job_order")
      .select(`
        id, status, scheduled_at, created_at,
        customer:customer_record_id(full_name, plate_number, vehicle_unit),
        service:service_id(name)
      `)
      .eq("id", id)
      .single()

    if (error || !job) return NextResponse.json({ error: "Not found." }, { status: 404 })

    const { data: team } = await admin
      .from("job_order_team")
      .select("role_in_job, user_account:user_account_id(full_name)")
      .eq("job_order_id", id)

    const { data: history } = await admin
      .from("job_order_history")
      .select("status, created_at, changed_by:changed_by_id(full_name)")
      .eq("job_order_id", id)
      .order("created_at", { ascending: true })

    const { data: stages } = await admin
      .from("job_stage_progress")
      .select(`
        id, status, completed_at,
        stage:service_stage_id(name, sequence_order, category),
        media:stage_media(id, file_url, media_type)
      `)
      .eq("job_order_id", id)
      .order("service_stage_id")

    const j      = job as any
    const leader = (team ?? []).find(
      (t: any) => t.role_in_job === "head_detailer" || t.role_in_job === "head_installer"
    )

    return NextResponse.json({
      job: {
        job_id:           `JO-${new Date(j.created_at).getFullYear()}-${id.slice(-3)}`,
        raw_id:           j.id,
        customer_name:    (j.customer as any)?.full_name    ?? "—",
        plate_number:     (j.customer as any)?.plate_number ?? "—",
        car_make:         (j.customer as any)?.vehicle_unit ?? "—",
        car_color:        "",
        service:          (j.service as any)?.name          ?? "—",
        technician_name:  (leader?.user_account as any)?.full_name ?? "—",
        scheduled_start:  fmtDate(j.scheduled_at),
        status:           j.status,
        timeline: (history ?? []).map((h: any) => ({
          status:     h.status,
          changed_at: fmtDate(h.created_at),
          changed_by: (h.changed_by as any)?.full_name ?? "System",
        })),
        handoff_notes: null,
        stages: (stages ?? []).map((s: any, idx: number) => ({
          stage_template_id: idx + 1,
          name:              (s.stage as any)?.name           ?? "Stage",
          order:             (s.stage as any)?.sequence_order ?? idx + 1,
          category:          (s.stage as any)?.category       ?? "preparation",
          done:              s.status === "done",
          submitted_at:      s.completed_at ? fmtDate(s.completed_at) : null,
          media:             (s.media ?? []).map((m: any) => ({
            url:  m.file_url,
            type: m.media_type,
          })),
        })),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

// ── PATCH — stage actions (mark done, approve, flag rework) ──────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body   = await request.json()
    const { action, stage_id, handoff_notes, rework_stage_ids, rework_instructions } = body

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    // Mock IDs — acknowledge without touching DB
    if (id === "1" || id === "2") {
      return NextResponse.json({ success: true })
    }

    const admin = createAdminClient()

    if (action === "mark_stage_done") {
      await admin
        .from("job_stage_progress")
        .update({ status: "done", completed_at: new Date().toISOString(), completed_by_id: user.id })
        .eq("id", stage_id)
      return NextResponse.json({ success: true })
    }

    if (action === "approve") {
      // Set job status: head_detailer → "Ongoing" (handoff), head_installer → "For Release"
      const { data: profile } = await admin
        .from("user_account").select("role").eq("id", user.id).single()
      const newStatus = (profile as any)?.role === "head_installer" ? "For Release" : "Ongoing"
      await admin.from("job_order").update({ status: newStatus }).eq("id", id)
      if (handoff_notes) {
        await admin.from("job_order_team")
          .update({ handoff_notes })
          .eq("job_order_id", id).eq("user_account_id", user.id)
      }
      return NextResponse.json({ success: true })
    }

    if (action === "flag_rework") {
      await admin.from("job_stage_progress")
        .update({ status: "rework", rework_instructions })
        .in("id", rework_stage_ids)
      await admin.from("job_order").update({ status: "For Rework" }).eq("id", id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
