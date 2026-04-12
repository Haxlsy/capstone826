import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ── Mock concerns for the logged-in user (shown when DB has no rows) ──────────
const MOCK_CONCERNS = [
  {
    id: "HTC-M01",
    title: "Heat gun stopped working",
    description: "Heat gun stopped working during film application on JO-2026-001. Need replacement or repair ASAP.",
    status: "Pending",
    response_note: null,
    submitted_at: "Apr 11, 2026 — 8:30 AM",
    media: [],
  },
  {
    id: "HTC-M02",
    title: "PPF material defects",
    description: "The PPF roll received has visible air pockets and discolouration on one edge. Around 30% of the roll is unusable.",
    status: "Resolved",
    response_note: "Replacement roll has been ordered and will arrive Apr 14. Use the backup stock in storage cabinet B in the meantime.",
    submitted_at: "Apr 10, 2026 — 2:15 PM",
    media: [],
  },
]

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

// ── GET — fetch own submitted concerns ───────────────────────────────────────
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    const { data, error } = await admin
      .from("concern")
      .select(`
        id, title, description, status, response_note,
        submitted_at, resolved_at,
        media:concern_media(id, file_url, media_type)
      `)
      .eq("submitted_by_id", user.id)
      .order("submitted_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // No real concerns yet — return mock data
    if (!data || data.length === 0) {
      return NextResponse.json({ concerns: MOCK_CONCERNS })
    }

    const shaped = data.map((c: any) => ({
      id:            c.id,
      title:         c.title,
      description:   c.description,
      status:        c.status,
      response_note: c.response_note ?? null,
      submitted_at:  fmtDate(c.submitted_at),
      media:         (c.media ?? []).map((m: any) => ({ url: m.file_url, type: m.media_type })),
    }))

    return NextResponse.json({ concerns: shaped })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

// ── POST — submit a new concern ───────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const body = await request.json()
    const { title, description } = body as { title?: string; description?: string }

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from("concern")
      .insert({
        title:           title.trim(),
        description:     description.trim(),
        submitted_by_id: user.id,
        status:          "Pending",
        submitted_at:    new Date().toISOString(),
      })
      .select("id")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, id: (data as any)?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
