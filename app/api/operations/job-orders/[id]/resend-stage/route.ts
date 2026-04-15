import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/operations/job-orders/[id]/resend-stage
// Body: { stage_id: string }
// Retries sending the stage completion update to the customer via Messenger.
// Updates messenger_sent + messenger_sent_at on job_stage_progress.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
         stage:service_stage_id(name, category),
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

    // Fetch customer PSID from the job order
    const { data: job } = await admin
      .from("job_order")
      .select(`customer:customer_record_id(psid, full_name), customer_name, plate_number`)
      .eq("id", jobId)
      .single()

    const psid         = (job as any)?.customer?.psid ?? null
    const customerName = (job as any)?.customer?.full_name ?? (job as any)?.customer_name ?? "Customer"
    const stageName    = (stage as any).stage?.name ?? "Stage"
    const photos       = ((stage as any).media ?? [])
      .filter((m: any) => m.media_type === "photo" && m.shareable_link)
      .map((m: any) => m.shareable_link as string)

    let sendSuccess = false

    if (psid && process.env.FB_PAGE_ACCESS_TOKEN) {
      // Build the update message
      const message = `✅ Stage Update: "${stageName}" has been completed for your vehicle (${(job as any)?.plate_number ?? ""}).\n\nThank you for your patience, ${customerName}!`

      try {
        // Send text message
        const textRes = await fetch(
          `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: psid },
              message:   { text: message },
            }),
          }
        )

        if (textRes.ok) {
          // Optionally attach first photo if available
          if (photos.length > 0) {
            await fetch(
              `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recipient: { id: psid },
                  message: {
                    attachment: {
                      type:    "image",
                      payload: { url: photos[0], is_reusable: true },
                    },
                  },
                }),
              }
            )
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
        : !process.env.FB_PAGE_ACCESS_TOKEN
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
