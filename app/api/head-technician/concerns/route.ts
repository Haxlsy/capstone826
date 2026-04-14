import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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
        job:job_order_id(id, status),
        media:concern_media(id, file_url, media_type)
      `)
      .eq("submitted_by_id", user.id)
      .order("submitted_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const shaped = (data ?? []).map((c: any) => ({
      id:            c.id,
      title:         c.title,
      description:   c.description,
      status:        c.status,
      response_note: c.response_note ?? null,
      submitted_at:  fmtDate(c.submitted_at),
      job_id:        c.job?.id ?? null,
      media:         (c.media ?? []).map((m: any) => ({ id: m.id, url: m.file_url, type: m.media_type })),
    }))

    return NextResponse.json({ concerns: shaped })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
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
    const { title, description, job_order_id } = body as {
      title?: string
      description?: string
      job_order_id?: string
    }

    if (!title?.trim())         return NextResponse.json({ error: "Title is required." },         { status: 400 })
    if (!description?.trim())   return NextResponse.json({ error: "Description is required." },   { status: 400 })

    const admin = createAdminClient()

    const { data, error } = await admin
      .from("concern")
      .insert({
        title:           title.trim(),
        description:     description.trim(),
        ...(job_order_id?.trim() ? { job_order_id: job_order_id.trim() } : {}),
        submitted_by_id: user.id,
        status:          "Pending",
        submitted_at:    new Date().toISOString(),
      })
      .select("id")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, id: (data as any)?.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
