import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const PROMPT = `You are an image validator for a professional automotive detailing and installation workshop. Technicians upload photos to document their work on customer vehicles. Bad photos hurt the company's reputation with customers.
Be strict about rejecting selfies. A face photo with no vehicle is always REJECTED.

APPROVE if the image shows ANY of the following:
- A vehicle (car, truck, van, SUV, motorcycle, jeep, bus, etc.) at any angle or distance
- A vehicle part or area: engine bay, tires, wheels, bumpers, hood, dashboard, exhaust, headlights, mirrors, brakes, door panels, seats, paint, body panels, etc.
- A vehicle interior or exterior being detailed, wrapped, installed, or inspected
- A garage, workshop bay, car lift, or automotive work area (vehicle does not need to be visible)
- Automotive tools or equipment used in detailing or installation work
- A screen, monitor, or printed photo/magazine page clearly showing a vehicle
- A slightly dark or slightly blurry photo where the subject is identifiably vehicle-related

REJECT if:
- It is a selfie or portrait — A human face is prominently visible and NO vehicle or automotive content 
  exists anywhere in the frame — reject immediately, do not give benefit of doubt
- It shows food, household objects, pets, random scenery, or everyday items with zero automotive context
- The photo is completely pitch-black, pure white, or totally unrecognizable (zero visible content)
- It is sexually explicit or offensive

KEY RULES:
- Slightly dark, slightly blurry, or oddly angled automotive photos → APPROVE
- A workspace or garage floor with no vehicle visible → APPROVE
- A screen/monitor/photo of a vehicle → APPROVE
- A person visible but a vehicle is also in the frame → APPROVE
- Only reject selfies if no automotive content exists anywhere in the image
- When uncertain → APPROVE

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "approved": true or false,
  "category": one of ["vehicle", "vehicle_part", "workspace", "unrelated", "inappropriate"],
  "reason": "One short phrase, max 8-20 words explain what they took a photo of, or why it was rejected  (e.g. 'selfie with no vehicle', 'car wheel being detailed', 'blurry photo of garage floor', 'photo of a cat', 'explicit content')",
  "message": "One or two friendly sentences. If rejected, instruct them to upload a clear photo of the vehicle they are working on."
}`

async function generateWithRetry(
  ai: GoogleGenAI,
  contents: Parameters<typeof ai.models.generateContent>[0]["contents"],
  retries = 3
) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          temperature: 0,
          maxOutputTokens: 1024,
        },
      })
      return response
    } catch (err: unknown) {
      const isRetryable =
        err instanceof Error &&
        (err.message.includes("503") || err.message.includes("429"))

      const isLastAttempt = attempt === retries - 1

      if (!isRetryable || isLastAttempt) throw err

      // Exponential backoff: 1s, 2s, 4s
      const delay = 1000 * Math.pow(2, attempt)
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
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 })
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
    const base64 = Buffer.from(arrayBuffer).toString("base64")

    const ai = new GoogleGenAI({ apiKey })

    const response = await generateWithRetry(ai, [
  {
    parts: [
      { text: PROMPT },
      { inlineData: { mimeType: file.type, data: base64 } },
    ],
  },
])

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

function serviceError() {
  return NextResponse.json({
    approved: true,
    category: "vehicle",
    reason: "Validation unavailable — approved by default",
    message: "Image uploaded successfully.",
  })
}
