import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuditCaller, getRoleCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"

// POST /api/head-technician/concerns/[id]/media
// Accepts multipart form with field "file".
// Uploads to Supabase Storage (concern-media bucket) and records in concern_media.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getRoleCaller(["head_detailer", "head_installer"])
    if ("error" in auth) return auth.error

    const { id: concernId } = await params

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const form = await request.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 })

    const isPhoto = file.type.startsWith("image/")
    const isVideo = file.type.startsWith("video/")
    if (!isPhoto && !isVideo) {
      return NextResponse.json({ error: "Only image or video files are supported." }, { status: 400 })
    }

    const maxBytes = 50 * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "File too large. Maximum is 50 MB." }, { status: 400 })
    }

    const ext         = file.name.split(".").pop() ?? (isPhoto ? "jpg" : "mp4")
    const storagePath = `${concernId}/${Date.now()}.${ext}`

    const admin       = createAdminClient()
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadErr } = await admin.storage
      .from("concern-media")
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

    const { data: { publicUrl } } = admin.storage
      .from("concern-media")
      .getPublicUrl(storagePath)

    const { data: mediaRow, error: dbErr } = await admin
      .from("concern_media")
      .insert({
        concern_id:      concernId,
        media_type:      isPhoto ? "photo" : "video",
        file_url:        publicUrl,
        shareable_link:  publicUrl,
        file_size_bytes: file.size,
      })
      .select("id, file_url, media_type")
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    const { data: concernRow } = await admin
      .from("concern")
      .select("job_order_id")
      .eq("id", concernId)
      .single()
    let concernCustomerName: string | null = null
    if ((concernRow as any)?.job_order_id) {
      const { data: jobRow } = await admin
        .from("job_order")
        .select("customer_name")
        .eq("id", (concernRow as any).job_order_id)
        .single()
      concernCustomerName = (jobRow as any)?.customer_name ?? null
    }

    const caller = await getAuditCaller()
    if (caller) {
      logAuditCall(caller, {
        category: "create",
        action:   "Attached media to concern",
        target:   `${concernCustomerName ?? `concern ${concernId}`} (${isPhoto ? "photo" : "video"})`,
      })
    }

    return NextResponse.json({ success: true, media: mediaRow }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
