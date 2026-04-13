import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("concern")
      .select(
        `id, title, description, status, response_note,
         submitted_at, resolved_at,
         job:job_order_id(id, status),
         submitter:submitted_by_id(id, full_name, role),
         resolver:resolved_by_id(full_name),
         media:concern_media(id, file_url, media_type)`
      )
      .eq("id", id)
      .single()

    if (error || !data) return NextResponse.json({ error: "Not found." }, { status: 404 })
    return NextResponse.json({ concern: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const body = await request.json()
    const { status, response_note } = body

    if (!status) return NextResponse.json({ error: "status is required." }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()
    const updates: Record<string, any> = { status }
    if (status === "Resolved") {
      updates.resolved_by_id = user.id
      updates.resolved_at    = new Date().toISOString()
      updates.response_note  = response_note ?? null
    }

    const { error } = await admin
      .from("concern")
      .update(updates)
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
