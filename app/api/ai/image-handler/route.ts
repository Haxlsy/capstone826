import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const PROMPT = `You are an image validator for an automotive detailing application. Technicians use this to document their work on vehicles.

APPROVE if the image contains ANY of:
- A vehicle (car, truck, van, SUV, motorcycle, bus, jeep, etc.) at any angle, distance, or lighting
- A vehicle part or area (engine, tires, wheels, bumpers, hood, dashboard, exhaust, headlights, mirrors, brakes, seats, paint, body panels, etc.)
- A garage, workshop, car lift, or automotive workspace — even without a car visible
- Tools or equipment typically used in automotive work
- A vehicle being washed, wrapped, detailed, or repaired
- A dark, blurry, or low-quality photo where a vehicle or part is still the subject
- People working on or standing beside a vehicle

REJECT if the image clearly shows NONE of the above, for example:
- A selfie or close-up portrait with no vehicle or automotive context visible anywhere
- Food, household items, nature scenes, or random everyday objects with no vehicle
- Sexually explicit or offensive content

IMPORTANT rules:
- If a vehicle OR vehicle-related content is visible anywhere in the frame, APPROVE
- Dark or blurry photos of vehicles — APPROVE
- When genuinely uncertain, APPROVE
- Do NOT reject based on photo quality alone

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "approved": true or false,
  "category": one of ["vehicle", "vehicle_part", "workspace", "unrelated", "inappropriate"],
  "reason": "One short phrase, max 8 words",
  "message": "One or two friendly sentences. If rejected, tell them to upload a vehicle photo instead."
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
