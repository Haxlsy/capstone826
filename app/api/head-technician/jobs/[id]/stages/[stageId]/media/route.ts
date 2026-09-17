import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { extractVideoFrame, stripAudio } from "@/lib/media/video"
import { validateAutomotiveImage, isMediaValidationEnabled } from "@/lib/ai/media-validation"
import {
  MAX_PHOTO_MB, MAX_VIDEO_MB, MAX_PHOTO_BYTES, MAX_VIDEO_BYTES,
  MAX_PHOTOS_PER_ROUND, MAX_VIDEOS_PER_ROUND,
} from "@/lib/media/limits"
import { getRoleCaller } from "@/lib/auth/caller"

// POST /api/head-technician/jobs/[id]/stages/[stageId]/media
// Accepts a multipart form with file field "file".
// Uploads to Supabase Storage (stage-media bucket) and records in stage_media.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const auth = await getRoleCaller(["head_detailer", "head_installer"])
    if ("error" in auth) return auth.error

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

    const maxBytes = isPhoto ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES
    if (file.size > maxBytes) {
      const limit = isPhoto ? `${MAX_PHOTO_MB} MB` : `${MAX_VIDEO_MB} MB`
      return NextResponse.json({ error: `File too large. Maximum is ${limit}.` }, { status: 400 })
    }

    const admin = createAdminClient()

    // Tag this upload with the stage's currently-active round (0 = initial,
    // 1+ = a rework redo — see supabase/migrations/20260917000004_stage_media_rework_rounds.sql)
    // and enforce the photo/video cap for that round specifically, server-side
    // — a direct API call must not be able to skip the client's own cap check.
    const { data: stageForUpload } = await admin
      .from("job_stage_progress")
      .select("current_rework_round")
      .eq("id", stageId)
      .single()
    const currentRound = (stageForUpload?.current_rework_round as number | null) ?? 0

    const { data: roundMedia } = await admin
      .from("stage_media")
      .select("media_type")
      .eq("job_stage_progress_id", stageId)
      .eq("rework_round", currentRound)
    const roundPhotoCount = (roundMedia ?? []).filter((m) => m.media_type === "photo").length
    const roundVideoCount = (roundMedia ?? []).filter((m) => m.media_type === "video").length

    if (isPhoto && roundPhotoCount >= MAX_PHOTOS_PER_ROUND) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PHOTOS_PER_ROUND} photos already uploaded for this round.` },
        { status: 400 }
      )
    }
    if (isVideo && roundVideoCount >= MAX_VIDEOS_PER_ROUND) {
      return NextResponse.json(
        { error: `Maximum ${MAX_VIDEOS_PER_ROUND} video already uploaded for this round.` },
        { status: 400 }
      )
    }

    let uploadBuffer: Buffer | ArrayBuffer = await file.arrayBuffer()
    // Tracks whether `uploadBuffer` was replaced by stripAudio()'s MP4-container
    // output. That output is ALWAYS an MP4 regardless of the source format (a
    // phone-recorded video is very commonly .mov/video-quicktime) — storing it
    // under the original extension/content-type would label MP4 bytes as
    // QuickTime, which is exactly the kind of mismatch a strict external
    // consumer like Facebook's video-attachment fetcher can silently reject.
    let mutedToMp4 = false

    if (isVideo) {
      // Videos are validated (one extracted frame, run through the same
      // Gemini check as a photo) and always muted before being stored — see
      // lib/media/video.ts and lib/ai/media-validation.ts. Rework-round
      // uploads are operations-only evidence (never sent to the customer),
      // so the automotive-content check that's meant to keep customer-facing
      // media on-topic is skipped for them.
      const original = Buffer.from(uploadBuffer)
      if (currentRound === 0 && await isMediaValidationEnabled()) {
        try {
          const frame = await extractVideoFrame(original)
          const result = await validateAutomotiveImage(frame, "video")
          if (!result.approved) {
            return NextResponse.json({ ...result, error: result.message }, { status: 400 })
          }
        } catch (err) {
          // Frame extraction/validation hiccup — never block the upload on
          // tooling failure, same philosophy as the AI validator itself.
          console.error("[stage-media] video validation failed, approving by default:", err)
        }
      }
      try {
        uploadBuffer = await stripAudio(original)
        mutedToMp4 = true
      } catch (err) {
        // Muting failed — fall back to storing the original (with audio)
        // rather than lose the technician's upload entirely. The original
        // bytes are in their original format, so the original extension/
        // content-type below is still correct in this one fallback case.
        console.error("[stage-media] audio stripping failed, storing original:", err)
        uploadBuffer = original
      }
    }

    const ext = mutedToMp4 ? "mp4" : (file.name.split(".").pop() ?? (isPhoto ? "jpg" : "mp4"))
    const storagePath = `${jobId}/${stageId}/${Date.now()}.${ext}`
    const contentType = mutedToMp4 ? "video/mp4" : file.type

    const { error: uploadErr } = await admin.storage
      .from("stage-media")
      .upload(storagePath, uploadBuffer, { contentType, upsert: false })

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
        file_size_bytes:       uploadBuffer instanceof Buffer ? uploadBuffer.length : file.size,
        uploaded_by_id:        user.id,
        rework_round:          currentRound,
      })
      .select("id, file_url, media_type, rework_round")
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
    const auth = await getRoleCaller(["head_detailer", "head_installer"])
    if ("error" in auth) return auth.error

    const { stageId } = await params
    const { media_id } = await request.json()
    if (!media_id) return NextResponse.json({ error: "media_id is required." }, { status: 400 })

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    // A round's media is only removable while it's still the active round and
    // the stage isn't done — once superseded by a later rework round (or the
    // stage is marked done), it's permanently locked as historical evidence.
    // The UI already hides/disables this, but that alone is bypassable via a
    // direct API call, so enforce it here too.
    const [{ data: stageRow }, { data: row }] = await Promise.all([
      admin
        .from("job_stage_progress")
        .select("status, current_rework_round")
        .eq("id", stageId)
        .single(),
      admin
        .from("stage_media")
        .select("file_url, rework_round")
        .eq("id", media_id)
        .eq("job_stage_progress_id", stageId)
        .single(),
    ])

    const isCurrentRound = row?.rework_round === stageRow?.current_rework_round
    if (!isCurrentRound || stageRow?.status === "done") {
      return NextResponse.json(
        { error: "This media is locked and can't be removed." },
        { status: 403 }
      )
    }

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
