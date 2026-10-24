import { GoogleGenAI } from "@google/genai"
import sharp from "sharp"
import { createAdminClient } from "@/lib/supabase/admin"

/** Categories the model may return; only these two count as approvable. */
export const APPROVED_CATEGORIES = ["vehicle", "vehicle_part"] as const

/**
 * What counts as approvable, shared by the photo prompt and the video prompt
 * so the two can never drift apart. `noun` is "image" or "frame".
 */
function criteria(noun: string): string {
  return `THE ONE QUESTION: Is a real vehicle, or a real part of a vehicle, clearly visible as a main subject of this ${noun}?
If yes → APPROVE. If no → REJECT. Nothing else qualifies, no matter how "automotive" the setting or objects are.

IGNORE ALL TEXT. Text never counts toward approval, in any form: words, numbers, car model or brand names, plate numbers written anywhere, service names, logos, labels, signs, captions, handwriting, whiteboards, documents, chat messages, or text on a screen. Decide only from what is visually pictured. Mentally remove every piece of text from the ${noun}, then ask THE ONE QUESTION. A ${noun} that is mostly text (a chat, list, document, board, or screenshot) → REJECT.

REAL VEHICLES ONLY. The vehicle must be a real, physical vehicle that was photographed or filmed. These are NOT vehicles and never count: emoji (e.g. 🚗 🚙 🏎️), icons, stickers, cartoons, drawings, illustrations, clip art, logos, symbols, toy or model cars, or a car shown only inside such graphics. A ${noun} of text with a car emoji or car icon → REJECT.

APPROVE only when you can actually SEE:
- A vehicle (car, truck, van, SUV, jeep, motorcycle, bus), exterior or interior, in any setting, including inside a workshop, garage, or on a lift
- A close-up of a vehicle part that is on, or clearly removed from, a vehicle: paint or body panel, bumper, hood, door, roof, glass, headlight, taillight, mirror, wheel, tire, rim, brake, engine bay, dashboard, steering wheel, seat, console, carpet, trim
- Work being done on a vehicle (detailing, polishing, coating, PPF or wrap, window tint, installation, inspection) where the vehicle or part is visible
- A screen, monitor, phone, or printed photo whose MAIN content is a real PHOTO of a vehicle or vehicle part (it fills most of the screen or print)

REJECT, even inside an automotive shop, when no real vehicle or vehicle part is visible:
- Workshop, garage, bay, office, ceiling, roof, floor, walls, shelves, doors, or windows with no vehicle in view
- Any text at all: whiteboards, job order boards, documents, receipts, signs, labels, or writing, even when it names a vehicle or service (e.g. "Pajero", "Tesla", "Full Body PPF")
- Emoji, icons, stickers, cartoons, drawings, illustrations, logos, or toy/model cars, on a screen, on paper, or anywhere else
- Computer monitors, laptops, or phones showing chats, messages, websites, social media, spreadsheets, apps, ads, or banners, even if they mention cars or contain small car images, thumbnails, or emoji
- Desks, keyboards, chairs, computer hardware, electronics
- Tools, equipment, chemicals, spray bottles, towels, tripods, helmets, or supplies with no vehicle in view
- Selfies, faces, people, hands, or body parts with no vehicle in view
- Food, household items, pets, animals, outdoor scenery with no vehicle
- ${noun === "frame" ? "Frames" : "Images"} too dark, blurry, or blank to identify a vehicle
- Sexually explicit or offensive content

KEY RULES:
- Text is never a vehicle. A car model, plate number, brand, or service name written anywhere does not count, and must not make you more likely to approve.
- A picture of a car that is not a real photo (emoji, icon, cartoon, drawing, logo, toy) does not count.
- A small, distant, or background car (in an ad, thumbnail, poster, or far corner of the ${noun}) does not count. The vehicle must be a main subject.
- An automotive setting or automotive objects do not count without a visible vehicle or vehicle part.
- A person together with a clearly visible vehicle → APPROVE.
- Slightly dark or slightly blurry, but the vehicle or part is still clearly identifiable → APPROVE.
- When uncertain → REJECT.`
}

const CATEGORY_LIST = `["vehicle", "vehicle_part", "workspace", "screen_or_document", "unrelated", "inappropriate"]`

function buildPrompt(mediaKind: "photo" | "video"): string {
  const noun = mediaKind === "video" ? "video" : "photo"
  const verb = mediaKind === "video" ? "record" : "upload"
  return `You are a strict image validator for a professional automotive detailing and installation workshop. Technicians upload ${noun}s as proof of their work on customer vehicles, and these are sent to customers. You are being shown a single still frame${mediaKind === "video" ? " extracted from that video" : ""}.

${criteria("image")}

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "approved": true or false,
  "category": one of ${CATEGORY_LIST},
  "reason": "One short phrase of at most 15 words saying what the ${noun} shows (e.g. 'front bumper being wrapped', 'office with job order board, no vehicle', 'monitor showing a chat, no vehicle', 'selfie with no vehicle')",
  "message": "One or two friendly sentences. If rejected, ask them to ${verb} a clear ${noun} of the vehicle or vehicle part they are working on."
}
Use "vehicle" or "vehicle_part" ONLY when approved is true.`
}

/** Prompt for several frames sampled from one video, judged frame by frame. */
function buildVideoPrompt(frameCount: number): string {
  return `You are a strict video validator for a professional automotive detailing and installation workshop. Technicians record videos as proof of their work on customer vehicles, and these are sent to customers. You are being shown ${frameCount} still frame${frameCount === 1 ? "" : "s"} sampled evenly from ONE video, in playback order. Judge EVERY frame on its own with the rules below.

${criteria("frame")}

THE VIDEO IS APPROVED ONLY IF EVERY FRAME IS APPROVED. If even one frame shows text, a screen, a desk, an emoji, or anything without a real vehicle or vehicle part as a main subject, the whole video is REJECTED.

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "approved": true or false,
  "frames": [ one entry per frame, in order: { "category": one of ${CATEGORY_LIST}, "reason": "at most 12 words on what this frame shows" } ],
  "reason": "One short phrase of at most 15 words summarizing the video (e.g. 'car hood being polished throughout', 'text with a car emoji, no real vehicle')",
  "message": "One or two friendly sentences. If rejected, ask them to record a clear video of the vehicle or vehicle part they are working on, keeping it in view the whole time."
}
Use "vehicle" or "vehicle_part" for a frame ONLY when that frame shows a real vehicle or vehicle part as a main subject.`
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

/** One or more JPEG images (base64) sent in order in a single request. */
async function generateWithRetry(images: string[], systemInstruction: string, maxOutputTokens = 256, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [
          {
            parts: images.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } })),
          },
        ],
        config: {
          systemInstruction,
          temperature: 0,
          maxOutputTokens,
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

export interface VideoValidationResult extends MediaValidationResult {
  frames?: { category: string; reason: string }[]
}

/**
 * Gate for a multi-frame video answer: approved only when the model says so
 * AND it returned a verdict for every frame AND every one of those frames is a
 * vehicle or vehicle part. One text/screen/emoji frame rejects the video.
 */
export function enforceVideoApproval(result: VideoValidationResult, frameCount: number): MediaValidationResult {
  const frames = Array.isArray(result.frames) ? result.frames : []
  const allFramesVehicle =
    frames.length >= frameCount &&
    frames.every((f) => (APPROVED_CATEGORIES as readonly string[]).includes(f?.category))
  const approved = result.approved === true && allFramesVehicle
  console.info(
    `[media-validation] video ${approved ? "APPROVED" : "REJECTED"} (model: ${result.approved}, ${frames.length}/${frameCount} frames): ` +
      frames.map((f, i) => `#${i + 1} ${f?.category}: ${f?.reason}`).join(" | "),
  )
  const firstBad = frames.find((f) => !(APPROVED_CATEGORIES as readonly string[]).includes(f?.category))
  return {
    approved,
    category: approved ? "vehicle" : (firstBad?.category ?? "unrelated"),
    reason: result.reason ?? "",
    message: approved
      ? (result.message || "Media uploaded successfully.")
      : result.approved === true || !result.message
        ? "This video doesn't show a vehicle or vehicle part the whole time. Please record a clear video of the vehicle you are working on, keeping it in view."
        : result.message,
  }
}

/** Shape returned when a video can't be read at all — it is rejected, not approved. */
export function unreadableVideo(): MediaValidationResult {
  return {
    approved: false,
    category: "unreadable",
    reason: "Video could not be read",
    message: "We couldn't check this video. Please record it again.",
  }
}

/**
 * Validates frames sampled across a whole video (see extractVideoFrames) in a
 * single Gemini request; every frame must show a real vehicle or vehicle part.
 * Like the photo check, a Gemini/parsing failure fails OPEN (approves) so a
 * service hiccup never blocks an upload — but an empty frame list (nothing
 * could be read from the video) is rejected.
 */
export async function validateAutomotiveVideo(frames: Buffer[]): Promise<MediaValidationResult> {
  if (frames.length === 0) return unreadableVideo()
  try {
    const images = await Promise.all(
      frames.map(async (f) =>
        (await sharp(f)
          .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
          .toFormat("jpeg", { quality: 70 })
          .toBuffer()).toString("base64"),
      ),
    )
    const response = await generateWithRetry(images, buildVideoPrompt(images.length), 512)
    const text = response.text ?? ""

    let parsed: VideoValidationResult
    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      parsed = JSON.parse(cleaned) as VideoValidationResult
    } catch {
      console.error("Could not parse Gemini video response:", text)
      return serviceError()
    }
    return enforceVideoApproval(parsed, images.length)
  } catch (err: unknown) {
    console.error("Video validation error:", err)
    return serviceError()
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

    const response = await generateWithRetry([base64], buildPrompt(mediaKind))
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
