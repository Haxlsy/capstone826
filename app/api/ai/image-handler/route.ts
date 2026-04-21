import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const PROMPT = `You are a content safety filter for an automotive workshop application used by professional technicians to document their work.

Your ONLY job is to block clearly inappropriate content. Approve everything else — including dark photos, blurry photos, garage interiors, tools, car parts, vehicles, people near vehicles, or anything that could plausibly be work documentation.

REJECT ONLY if the image is:
- Sexually explicit or pornographic
- Extremely graphic violence or gore with no automotive context

APPROVE everything else without hesitation, including:
- Any vehicle (car, truck, van, SUV, motorcycle, bus, jeep, etc.) at any angle, lighting, or distance
- Any vehicle part (engine bay, tires, wheels, bumpers, hoods, dashboards, exhausts, headlights, mirrors, brakes, door panels, seats, paint, etc.)
- Garages, workshops, lifts, tools, equipment, workbenches
- Dark, blurry, or low-quality photos — these are normal in automotive work
- People working on vehicles or standing near vehicles
- Toy vehicles, die-cast models, or illustrations of vehicles
- Screenshots or photos of vehicles from any source
- Anything that is ambiguous or unclear — APPROVE

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "approved": true or false,
  "category": one of ["vehicle", "vehicle_part", "workspace", "inappropriate", "unrelated"],
  "reason": "One short phrase, max 8 words",
  "message": "One or two friendly sentences. If rejected, say what to upload instead."
}`

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 })
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType: file.type, data: base64 } },
          ],
        },
      ],
      config: {
        temperature: 0,
        maxOutputTokens: 512,
        // disable thinking — we only need a short JSON classification
        thinkingConfig: { thinkingBudget: 0 },
      },
    })

    // Extract only non-thought parts (Gemini 2.5 returns thought parts separately)
    const parts = response.candidates?.[0]?.content?.parts ?? []
    const text = parts
      .filter((p: { thought?: boolean; text?: string }) => !p.thought && typeof p.text === "string")
      .map((p: { text?: string }) => p.text)
      .join("") || (response.text ?? "")

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
