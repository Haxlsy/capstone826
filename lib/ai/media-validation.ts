import { GoogleGenAI } from "@google/genai"
import sharp from "sharp"
import { createAdminClient } from "@/lib/supabase/admin"

/** Categories the model may return; only these two count as approvable. */
export const APPROVED_CATEGORIES = ["vehicle", "vehicle_part"] as const

function buildPrompt(mediaKind: "photo" | "video"): string {
  const noun = mediaKind === "video" ? "video" : "photo"
  const verb = mediaKind === "video" ? "record" : "upload"
  return `You are a strict image validator for a professional automotive detailing and installation workshop. Technicians upload ${noun}s as proof of their work on customer vehicles, and these are sent to customers. You are being shown a single still frame${mediaKind === "video" ? " extracted from that video" : ""}.

THE ONE QUESTION: Is a real vehicle, or a real part of a vehicle, clearly visible as a main subject of this image?
If yes → APPROVE. If no → REJECT. Nothing else qualifies, no matter how "automotive" the setting or objects are.

IGNORE ALL TEXT. Text never counts toward approval, in any form: words, numbers, car model or brand names, plate numbers written anywhere, service names, logos, labels, signs, captions, handwriting, whiteboards, documents, chat messages, or text on a screen. Decide only from what is visually pictured. Mentally remove every piece of text from the image, then ask THE ONE QUESTION. An image that is mostly text (a chat, list, document, board, or screenshot) → REJECT.

APPROVE only when you can actually SEE:
- A vehicle (car, truck, van, SUV, jeep, motorcycle, bus), exterior or interior, in any setting, including inside a workshop, garage, or on a lift
- A close-up of a vehicle part that is on, or clearly removed from, a vehicle: paint or body panel, bumper, hood, door, roof, glass, headlight, taillight, mirror, wheel, tire, rim, brake, engine bay, dashboard, steering wheel, seat, console, carpet, trim
- Work being done on a vehicle (detailing, polishing, coating, PPF or wrap, window tint, installation, inspection) where the vehicle or part is visible
- A screen, monitor, phone, or printed photo whose MAIN content is a photo of a vehicle or vehicle part (it fills most of the screen or print)

REJECT, even inside an automotive shop, when no vehicle or vehicle part is visible:
- Workshop, garage, bay, office, ceiling, roof, floor, walls, shelves, doors, or windows with no vehicle in view
- Any text at all: whiteboards, job order boards, documents, receipts, signs, labels, or writing, even when it names a vehicle or service (e.g. "Pajero", "Tesla", "Full Body PPF")
- Computer monitors, laptops, or phones showing chats, messages, websites, social media, spreadsheets, apps, ads, or banners, even if they mention cars or contain small car images or thumbnails
- Desks, keyboards, chairs, computer hardware, electronics
- Tools, equipment, chemicals, spray bottles, towels, tripods, helmets, or supplies with no vehicle in view
- Selfies, faces, people, hands, or body parts with no vehicle in view
- Food, household items, pets, animals, outdoor scenery with no vehicle
- Images too dark, blurry, or blank to identify a vehicle
- Sexually explicit or offensive content

KEY RULES:
- Text is never a vehicle. A car model, plate number, brand, or service name written anywhere does not count, and must not make you more likely to approve.
- A small, distant, or background car (in an ad, thumbnail, poster, or far corner of the frame) does not count. The vehicle must be a main subject.
- An automotive setting or automotive objects do not count without a visible vehicle or vehicle part.
- A person together with a clearly visible vehicle → APPROVE.
- Slightly dark or slightly blurry, but the vehicle or part is still clearly identifiable → APPROVE.
- When uncertain → REJECT.

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "approved": true or false,
  "category": one of ["vehicle", "vehicle_part", "workspace", "screen_or_document", "unrelated", "inappropriate"],
  "reason": "One short phrase of at most 15 words saying what the ${noun} shows (e.g. 'front bumper being wrapped', 'office with job order board, no vehicle', 'monitor showing a chat, no vehicle', 'selfie with no vehicle')",
  "message": "One or two friendly sentences. If rejected, ask them to ${verb} a clear ${noun} of the vehicle or vehicle part they are working on."
}
Use "vehicle" or "vehicle_part" ONLY when approved is true.`
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

/**
 * Second gate on the model's answer: it only counts as approved when it is a
 * strict `true` AND the category says a vehicle or vehicle part is actually in
 * the frame. Catches answers like `approved: true, category: "workspace"`.
 * Every decision is logged so a wrong approval can be traced in server logs.
 */
export function enforceApproval(result: MediaValidationResult, mediaKind: "photo" | "video"): MediaValidationResult {
  const approved =
    result.approved === true &&
    (APPROVED_CATEGORIES as readonly string[]).includes(result.category)
  console.info(
    `[media-validation] ${mediaKind} ${approved ? "APPROVED" : "REJECTED"} (model: ${result.approved}, ${result.category}): ${result.reason}`,
  )
  if (approved) return result
  const noun = mediaKind === "video" ? "video" : "photo"
  const verb = mediaKind === "video" ? "record" : "take"
  return {
    ...result,
    approved: false,
    message: result.approved === true
      ? `This ${noun} doesn't clearly show a vehicle or vehicle part. Please ${verb} a clear ${noun} of the vehicle you are working on.`
      : result.message,
  }
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

    let parsed: MediaValidationResult
    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      parsed = JSON.parse(cleaned) as MediaValidationResult
    } catch {
      console.error("Could not parse Gemini response:", text)
      return serviceError()
    }
    return enforceApproval(parsed, mediaKind)
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
