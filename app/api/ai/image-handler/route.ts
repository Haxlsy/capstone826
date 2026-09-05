import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import sharp from "sharp"
import { createAdminClient } from "@/lib/supabase/admin"


const PROMPT = `You are an image validator for a professional automotive detailing and installation workshop. Technicians upload photos to document their work on customer vehicles. Bad photos hurt the company's reputation with customers.
Be strict about rejecting selfies. A face photo with no vehicle is always REJECTED.

APPROVE only if the image clearly shows:
- A vehicle (car, truck, van, SUV, motorcycle, jeep, bus, etc.)
- A specific vehicle part: engine bay, tires, wheels, bumpers, hood, dashboard, exhaust, headlights, mirrors, brakes, door panels, seats, body panels
- A vehicle interior or exterior being detailed, wrapped, installed, or inspected
- A garage, workshop bay, or car lift (automotive work area)
- Automotive-specific tools: torque wrench, car jack, detailing buffer, PPF tools, window tint tools, etc.
- A screen or photo clearly displaying a vehicle

REJECT if the image shows:
- A human face or selfie with no vehicle present
- Hands, body parts, or people with no vehicle present
- Computer hardware, electronics, or non-automotive equipment
- Food, household objects, furniture, or everyday items
- Pets or animals
- Random indoor or outdoor scenery with no vehicles
- Completely dark, blurry beyond recognition, or blank images
- Sexually explicit or offensive content

KEY RULES:
- Slightly dark or slightly blurry automotive photos → APPROVE
- A person AND a vehicle both visible → APPROVE
- A garage floor or workspace with no vehicle → APPROVE
- A photo of a vehicle on a screen or in a magazine → APPROVE
- Anything not clearly automotive → REJECT
- When uncertain → REJECT

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "approved": true or false,
  "category": one of ["vehicle", "vehicle_part", "workspace", "unrelated", "inappropriate"],
  "reason": "One short phrase, max 8-20 words explain what they took a photo of, or why it was rejected  (e.g. 'selfie with no vehicle', 'car wheel being detailed', 'blurry photo of garage floor', 'photo of a cat', 'explicit content')",
  "message": "One or two friendly sentences. If rejected, instruct them to upload a clear photo of the vehicle they are working on."
}`

if(!process.env.GEMINI_API_KEY){
  console.warn("GEMINI_API_KEY is not set. Image validation will be unavailable.")
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
})

async function generateWithRetry(
  mimeType: string,
  base64: string,
  retries = 3
) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents:[
          {
            parts:[
              {inlineData: {mimeType, data: base64}}
            ]
          }
        ],
        config: {
          systemInstruction: PROMPT,
          temperature: 0,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
        },
      })
      return response
    } catch (err: unknown) {
      const isRetryable =
        err instanceof Error &&
        (err.message.includes("503") || err.message.includes("429"))

      const isLastAttempt = attempt === retries - 1

      if (!isRetryable || isLastAttempt) throw err

      // Short backoff — stay within Vercel's 10s function timeout
      const delay = 300 * (attempt + 1)
      console.warn(`Gemini attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
      await new Promise((res) => setTimeout(res, delay))
    }
  }
  throw new Error("Unreachable")
}

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
    const isTestMode = process.env.GEMINI_API_KEY_TEST

    if(isTestMode){
      console.log("TEST MODE: Skipping Gemini validation");
      return NextResponse.json({
        approved: true,
        category: "vehicle",
        reason: "Test mode enabled - validation skipped",
        message: "Image uploaded successfully (Bypassed AI).",
      })
    }

    // Admin master switch. Checked before the body is parsed and the image is
    // resized, so an "off" toggle costs nothing. Auto-approves in the same shape
    // as serviceError(), so the caller's `!approved` branch simply falls through
    // and the upload proceeds unvalidated.
    if (!(await isMediaValidationEnabled())) {
      return NextResponse.json({
        approved: true,
        category: "vehicle",
        reason: "AI media validation is disabled by the administrator",
        message: "Image uploaded successfully.",
      })
    }

    if (isRateLimited()) {
      return serviceError() // auto-approve and skip validation
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Videos are not validated — auto-approve
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({
        approved: true,
        category: "vehicle",
        reason: "Video files are not validated",
        message: "Video uploaded successfully.",
      })
    }

    const arrayBuffer = await file.arrayBuffer()
    const resized = await sharp(Buffer.from(arrayBuffer))
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .toFormat("jpeg", { quality: 75 })
      .toBuffer()
    const base64 = resized.toString("base64")

    const response = await generateWithRetry("image/jpeg", base64);
    
    const text = response.text ?? ""

    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      const result = JSON.parse(cleaned) as {
        approved: boolean
        category: string
        reason: string
        message: string
      }
      return NextResponse.json(result)
    } catch {
      console.error("Could not parse Gemini response:", text)
      return serviceError()
    }
  } catch (err: unknown) {
    console.error("Image validation error:", err)
    return serviceError()
  }
}

/**
 * Reads the `enable_media_validation` master switch from chatbot_config.
 * Fails OPEN (returns true) on any error: a settings-read blip should leave
 * validation running, not silently disable a safety check.
 */
async function isMediaValidationEnabled(): Promise<boolean> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("chatbot_config")
      .select("settings")
      .limit(1)
      .single()

    const settings = data?.settings as { enable_media_validation?: boolean } | null
    return settings?.enable_media_validation !== false
  } catch (err) {
    console.error("[image-handler] media validation flag read failed:", err)
    return true
  }
}

function serviceError() {
  return NextResponse.json({
    approved: true,
    category: "vehicle",
    reason: "Validation unavailable — approved by default",
    message: "Image uploaded successfully.",
  })
}
