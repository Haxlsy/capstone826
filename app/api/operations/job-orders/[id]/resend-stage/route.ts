import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendMessengerText, sendMessengerImage, sendMessengerVideo } from "@/lib/messenger/graph"
import { buildStageUpdateMessage } from "@/lib/messenger/stage-update"
import { getRoleCaller } from "@/lib/auth/caller"

// POST /api/operations/job-orders/[id]/resend-stage
// Body: { stage_id: string }
// Retries sending the stage completion update to the customer via Messenger.
// Updates messenger_sent + messenger_sent_at on job_stage_progress.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const { id: jobId } = await params
    const body = await request.json()
    const { stage_id } = body as { stage_id?: string }

    if (!stage_id) {
      return NextResponse.json({ error: "stage_id is required." }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    // Fetch the stage + job order + customer PSID
    const { data: stage, error: stageErr } = await admin
      .from("job_stage_progress")
      .select(
        `id, status,
         stage:service_stage_id(name, workflow_category:category_id(name)),
         media:stage_media(shareable_link, media_type)`
      )
      .eq("id", stage_id)
      .eq("job_order_id", jobId)
      .single()

    if (stageErr || !stage) {
      return NextResponse.json({ error: "Stage not found." }, { status: 404 })
    }

    if ((stage as any).status !== "done") {
      return NextResponse.json({ error: "Only completed stages can be resent." }, { status: 400 })
    }

    // Fetch customer PSID + everything the message needs from the job order
    const { data: job } = await admin
      .from("job_order")
      .select(
        `customer:customer_record_id(psid, full_name, vehicle_unit, plate_number),
         service:service_id(name),
         customer_name, plate_number, vehicle_unit`
      )
      .eq("id", jobId)
      .single()

    const j            = job as any
    const s            = stage as any
    const psid         = j?.customer?.psid ?? null
    const customerName = j?.customer?.full_name ?? j?.customer_name ?? "Customer"
    const stageName    = s.stage?.name ?? "Stage"
    const stageCat     = Array.isArray(s.stage?.workflow_category)
      ? s.stage.workflow_category[0]?.name
      : s.stage?.workflow_category?.name
    const categoryName = stageCat ?? null
    const serviceName  = j?.service?.name ?? null
    const vehicleUnit  = j?.customer?.vehicle_unit ?? j?.vehicle_unit ?? null
    const plate        = j?.customer?.plate_number ?? j?.plate_number ?? null
    const photos       = (s.media ?? [])
      .filter((m: any) => m.media_type === "photo" && m.shareable_link)
      .map((m: any) => m.shareable_link as string)
    const videos       = (s.media ?? [])
      .filter((m: any) => m.media_type === "video" && m.shareable_link)
      .map((m: any) => m.shareable_link as string)

    // Progress across the whole job.
    const { data: allStages } = await admin
      .from("job_stage_progress")
      .select("status")
      .eq("job_order_id", jobId)
    const totalCount     = (allStages ?? []).length
    const completedCount = (allStages ?? []).filter((r: any) => r.status === "done").length

    let sendSuccess = false

    if (psid && process.env.META_PAGE_ACCESS_TOKEN) {
      const message = buildStageUpdateMessage({
        customerName,
        stageName,
        categoryName,
        serviceName,
        vehicleUnit,
        plate,
        completedCount,
        totalCount,
      })

      try {
        const textMid = await sendMessengerText(psid, message)
        if (textMid) {
          // Optionally attach first photo/video if available
          if (photos.length > 0) {
            await sendMessengerImage(psid, photos[0])
          }
          if (videos.length > 0) {
            await sendMessengerVideo(psid, videos[0])
          }
          sendSuccess = true
        }
      } catch {
        sendSuccess = false
      }
    } else {
      // No PSID or token configured — mark as failed
      sendSuccess = false
    }

    // Persist the send result
    await admin
      .from("job_stage_progress")
      .update({
        messenger_sent:    sendSuccess,
        messenger_sent_at: new Date().toISOString(),
      })
      .eq("id", stage_id)

    if (!sendSuccess) {
      const reason = !psid
        ? "Customer has no Messenger PSID linked."
        : !process.env.META_PAGE_ACCESS_TOKEN
        ? "Messenger integration is not configured."
        : "Messenger API returned an error."

      return NextResponse.json(
        { error: `Send failed: ${reason}`, messenger_sent: false },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, messenger_sent: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
