import { NextRequest, NextResponse } from "next/server"
import { validateAutomotiveImage, isMediaValidationEnabled, testModeApproval, serviceError } from "@/lib/ai/media-validation"
import { extractVideoFrame } from "@/lib/media/video"

const requestTimestamps: number[] = []
const RATE_LIMIT = 10 // max requests per minute

function isRateLimited(): boolean {
  const now = Date.now()
  const oneMinuteAgo = now - 60_000
  // Remove old timestamps
  while (requestTimestamps.length && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift()
  }
  if (requestTimestamps.length >= RATE_LIMIT) return true
  requestTimestamps.push(now)
  return false
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.GEMINI_API_KEY_TEST) {
      console.log("TEST MODE: Skipping Gemini validation")
      return NextResponse.json(testModeApproval())
    }

    // Admin master switch. Checked before the body is parsed and the image is
    // resized, so an "off" toggle costs nothing. Auto-approves in the same shape
    // as a failed validation, so the caller's `!approved` branch simply falls
    // through and the upload proceeds unvalidated.
    if (!(await isMediaValidationEnabled())) {
      return NextResponse.json({
        approved: true,
        category: "vehicle",
        reason: "AI media validation is disabled by the administrator",
        message: "Media uploaded successfully.",
      })
    }

    if (isRateLimited()) {
      return NextResponse.json(serviceError())
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()

    // Video: pull one representative frame and validate that through the same
    // pipeline as a photo, rather than skipping video entirely.
    if (!file.type.startsWith("image/")) {
      try {
        const frame = await extractVideoFrame(Buffer.from(arrayBuffer))
        return NextResponse.json(await validateAutomotiveImage(frame))
      } catch (err: unknown) {
        console.error("Video frame extraction failed:", err)
        return NextResponse.json(serviceError())
      }
    }

    return NextResponse.json(await validateAutomotiveImage(Buffer.from(arrayBuffer)))
  } catch (err: unknown) {
    console.error("Image validation error:", err)
    return NextResponse.json(serviceError())
  }
}
