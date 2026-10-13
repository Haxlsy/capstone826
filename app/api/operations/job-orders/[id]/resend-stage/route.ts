import { NextResponse } from "next/server"
import { STAGE_OVERRIDE_COLUMNS, loadStageCatalog, resolveJobStage } from "@/lib/job-stages"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendMessengerTextDetailed, sendMessengerImage, sendMessengerVideo, describeSendError, type MessengerSendError } from "@/lib/messenger/graph"
import { buildStageUpdateMessage } from "@/lib/messenger/stage-update"
import { getRoleCaller } from "@/lib/auth/caller"
import { recipientFromVehicle } from "@/lib/messenger/recipient"
import { jobCustomer } from "@/lib/operations/job-customer"

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
        `id, status, ${STAGE_OVERRIDE_COLUMNS},
         media:stage_media(shareable_link, media_type, rework_round)`
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
        `customer_record_id,
         customer:customer_record_id(plate_number, vehicle_unit, owner:customer!customer_id(psid, full_name, contact_number), booked_by:customer!booked_by_customer_id(psid)),
         service:service_id(name),
         customer_name, plate_number, vehicle_unit`
      )
      .eq("id", jobId)
      .single()

    const j            = job as any
    const s            = stage as any
    const psid         = recipientFromVehicle(j?.customer).psid
    const cust         = jobCustomer(j)
    const customerName = cust.name ?? "Customer"
    // Resolved through lib/job-stages.ts so a stage renamed or added for this
    // job is named to the customer the way Operations sees it.
    const resolved     = resolveJobStage(s, await loadStageCatalog(admin, [s]))
    const stageName    = resolved.name ?? "Stage"
    const categoryName = resolved.category?.name ?? null
    const serviceName  = j?.service?.name ?? null
    const vehicleUnit  = cust.vehicle
    const plate        = cust.plate
    // Only round 0 (the original, pre-rework upload) ever reaches the
    // customer — any rework resubmission is operations-only. See
    // supabase/migrations/20260917000004_stage_media_rework_rounds.sql.
    const photos       = (s.media ?? [])
      .filter((m: any) => m.media_type === "photo" && m.shareable_link && (m.rework_round ?? 0) === 0)
      .map((m: any) => m.shareable_link as string)
    const videos       = (s.media ?? [])
      .filter((m: any) => m.media_type === "video" && m.shareable_link && (m.rework_round ?? 0) === 0)
      .map((m: any) => m.shareable_link as string)

    // Progress across the whole job.
    const { data: allStages } = await admin
      .from("job_stage_progress")
      .select("status")
      .eq("job_order_id", jobId)
    const totalCount     = (allStages ?? []).length
    const completedCount = (allStages ?? []).filter((r: any) => r.status === "done").length

    let sendSuccess = false
    let sendError: MessengerSendError | null = null

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
        const { mid: textMid, error } = await sendMessengerTextDetailed(psid, message, "UPDATE")
        sendError = error
        if (textMid) {
          // Optionally attach first photo/video if available
          if (photos.length > 0) {
            await sendMessengerImage(psid, photos[0], "UPDATE")
          }
          if (videos.length > 0) {
            await sendMessengerVideo(psid, videos[0], "UPDATE")
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
        : describeSendError(sendError)

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
