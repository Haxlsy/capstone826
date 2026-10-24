import { NextRequest, NextResponse } from "next/server"
import {
  validateAutomotiveImage, validateAutomotiveVideo, unreadableVideo,
  isMediaValidationEnabled, testModeApproval, serviceError,
} from "@/lib/ai/media-validation"
import { extractVideoFrames } from "@/lib/media/video"

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
      console.warn("[media-validation] rate limit hit (10/min), approving without a check")
      return NextResponse.json(serviceError())
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()

    // Video: frames sampled across the whole clip, every one must show a real
    // vehicle. A video that can't be read is rejected (re-record), not passed.
    if (!file.type.startsWith("image/")) {
      let frames: Buffer[]
      try {
        frames = await extractVideoFrames(Buffer.from(arrayBuffer))
      } catch (err: unknown) {
        console.error("Video frame extraction failed, rejecting:", err)
        return NextResponse.json(unreadableVideo())
      }
      return NextResponse.json(await validateAutomotiveVideo(frames))
    }

    return NextResponse.json(await validateAutomotiveImage(Buffer.from(arrayBuffer)))
  } catch (err: unknown) {
    console.error("Image validation error:", err)
    return NextResponse.json(serviceError())
  }
}
