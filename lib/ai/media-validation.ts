import { GoogleGenAI } from "@google/genai"
import sharp from "sharp"
import { createAdminClient } from "@/lib/supabase/admin"

function buildPrompt(mediaKind: "photo" | "video"): string {
  const noun = mediaKind === "video" ? "video" : "photo"
  const verb = mediaKind === "video" ? "record" : "upload"
  return `You are an image validator for a professional automotive detailing and installation workshop. Technicians upload ${noun}s to document their work on customer vehicles. Bad ${noun}s hurt the company's reputation with customers. You are being shown a single still frame${mediaKind === "video" ? " extracted from that video" : ""}.
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
  "reason": "One short phrase, max 8-20 words explain what they took a ${noun} of, or why it was rejected  (e.g. 'selfie with no vehicle', 'car wheel being detailed', 'blurry photo of garage floor', 'photo of a cat', 'explicit content')",
  "message": "One or two friendly sentences. If rejected, instruct them to ${verb} a clear ${noun} of the vehicle they are working on."
}`
}

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not set. Image validation will be unavailable.")
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
})

export interface MediaValidationResult {
  approved: boolean
  category: string
  reason: string
  message: string
}

async function generateWithRetry(mimeType: string, base64: string, mediaKind: "photo" | "video", retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [
          {
            parts: [{ inlineData: { mimeType, data: base64 } }],
          },
        ],
        config: {
          systemInstruction: buildPrompt(mediaKind),
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

export function serviceError(): MediaValidationResult {
  return {
    approved: true,
    category: "vehicle",
    reason: "Validation unavailable — approved by default",
    message: "Media uploaded successfully.",
  }
}

/**
 * Validates that an image is relevant automotive content, using Gemini.
 * Buffer-in/JSON-out — no HTTP involved, so both the client-facing
 * `/api/ai/image-handler` route (photos) and server-side callers (a video's
 * extracted frame) can call this directly. Fails OPEN (auto-approves) on any
 * Gemini/parsing failure — a validation-service hiccup should never block a
 * technician's upload.
 *
 * `mediaKind` is always "photo" for an actual photo. Pass "video" when
 * `imageBuffer` is a still frame extracted from a video, so the generated
 * `message` says "video" instead of "photo" — the raw input to Gemini is
 * always a still image either way.
 */
export async function validateAutomotiveImage(imageBuffer: Buffer, mediaKind: "photo" | "video" = "photo"): Promise<MediaValidationResult> {
  try {
    const resized = await sharp(imageBuffer)
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .toFormat("jpeg", { quality: 75 })
      .toBuffer()
    const base64 = resized.toString("base64")

    const response = await generateWithRetry("image/jpeg", base64, mediaKind)
    const text = response.text ?? ""

    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      return JSON.parse(cleaned) as MediaValidationResult
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
export async function isMediaValidationEnabled(): Promise<boolean> {
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
    console.error("[media-validation] media validation flag read failed:", err)
    return true
  }
}

/** Auto-approval shape sent when `GEMINI_API_KEY_TEST` is set. */
export function testModeApproval(): MediaValidationResult {
  return {
    approved: true,
    category: "vehicle",
    reason: "Test mode enabled - validation skipped",
    message: "Media uploaded successfully (Bypassed AI).",
  }
}
