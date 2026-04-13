import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/head-technician/jobs/[id]/stages/[stageId]/media
// Accepts a multipart form with file field "file".
// Uploads to Supabase Storage (stage-media bucket) and records in stage_media.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const { id: jobId, stageId } = await params

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

    const maxBytes = isPhoto ? 5 * 1024 * 1024 : 50 * 1024 * 1024
    if (file.size > maxBytes) {
      const limit = isPhoto ? "5 MB" : "50 MB"
      return NextResponse.json({ error: `File too large. Maximum is ${limit}.` }, { status: 400 })
    }

    const ext        = file.name.split(".").pop() ?? (isPhoto ? "jpg" : "mp4")
    const storagePath = `${jobId}/${stageId}/${Date.now()}.${ext}`

    const admin = createAdminClient()
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadErr } = await admin.storage
      .from("stage-media")
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

    const { data: { publicUrl } } = admin.storage
      .from("stage-media")
      .getPublicUrl(storagePath)

    const { data: mediaRow, error: dbErr } = await admin
      .from("stage_media")
      .insert({
        job_stage_progress_id: stageId,
        media_type:            isPhoto ? "photo" : "video",
        file_url:              publicUrl,
        shareable_link:        publicUrl,
        file_size_bytes:       file.size,
        uploaded_by_id:        user.id,
      })
      .select("id, file_url, media_type")
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    return NextResponse.json({ success: true, media: mediaRow }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/head-technician/jobs/[id]/stages/[stageId]/media
// Body: { media_id: string }
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const { stageId } = await params
    const { media_id } = await request.json()
    if (!media_id) return NextResponse.json({ error: "media_id is required." }, { status: 400 })

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    const { data: row } = await admin
      .from("stage_media")
      .select("file_url")
      .eq("id", media_id)
      .eq("job_stage_progress_id", stageId)
      .single()

    if (row?.file_url) {
      // Extract storage path from the public URL: everything after /stage-media/
      const storagePath = row.file_url.split("/stage-media/")[1]
      if (storagePath) {
        await admin.storage.from("stage-media").remove([storagePath])
      }
    }

    await admin.from("stage_media").delete().eq("id", media_id)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
