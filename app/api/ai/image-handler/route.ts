import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const PROMPT = `You are a vehicle image validator for an automotive detailing application. Your job is to determine whether an uploaded image is acceptable for a job stage documentation.

APPROVED images — approve if the image reasonably contains ANY of the following:
- A vehicle (car, truck, van, SUV, motorcycle, bus, jeep, etc.) — even partially visible, at any angle, indoors or outdoors
- A specific vehicle part or area (engine, tire, wheel, bumper, hood, dashboard, exhaust, headlight, mirror, brake, door panel, seat, paint, etc.)
- A vehicle being worked on, in a garage, or on a lift
- A toy vehicle, die-cast model, scale model, or miniature car — these count as vehicles
- A screenshot or photo taken from the internet, magazine, or screen showing a vehicle
- Real-world phone camera photos are often dark, slightly blurry, or taken at odd angles — this is NORMAL and should still be approved as long as the subject is identifiable

REJECTED images — only reject if the image clearly is:
- Completely unrelated to vehicles (e.g. food, portraits with no vehicle, pure landscapes, random objects with zero vehicle content)
- A selfie or portrait where a human face is the ONLY subject and no vehicle is visible
- Inappropriate, explicit, or offensive content

For Demo / borderline cases:
- Screenshots, logos, or illustrations of vehicles → APPROVE, categorize as "vehicle"
- Toy vehicles, die-cast models, scale models → APPROVE, categorize as "vehicle"
- Vehicle images that include people → APPROVE as long as a vehicle is visible anywhere
- Internet, magazine, or screen photos of vehicles → APPROVE, categorize as "vehicle"
- Slightly blurry or dark real-world photos where a vehicle is still identifiable → APPROVE
- When in doubt, APPROVE

Respond ONLY with a valid JSON object. No markdown, no explanation, no extra text. Use this exact structure:

{
  "approved": true or false,
  "category": one of ["vehicle", "vehicle_part", "blurry", "face_or_selfie", "inappropriate", "unrelated"],
  "reason": "One short phrase, max 8 words",
  "message": "One or two friendly sentences explaining the result to the user. If rejected, tell them what to do instead."
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
