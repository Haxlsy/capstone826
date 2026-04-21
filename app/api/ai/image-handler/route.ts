import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const PROMPT = `You are a strict vehicle image validator for an automotive application. Your only job is to determine whether an uploaded image is acceptable for processing.

APPROVED images must meet ALL of the following:
- The main subject is clearly a vehicle (car, truck, van, motorcycle, bus, jeep, SUV, boat, airplane, etc.) OR a specific vehicle part (engine, tire, wheel, bumper, hood, dashboard, exhaust, headlight, side mirror, brake, suspension, etc.)
- The image is sharp, well-lit, and clearly visible
- No human face is the main or prominent subject
- No selfie or person taking a photo of themselves
- No inappropriate, offensive, or explicit content

REJECTED images include any of the following:
- Blurry, out-of-focus, dark, or too low resolution to identify the subject
- A face, portrait, or selfie — even if a vehicle is in the background
- Inappropriate, explicit, or offensive content
- Any image where the main subject is NOT a vehicle or vehicle part (food, animals, scenery, documents, random objects, etc.)


For Demo purposes:
- Screenshots, logos, or illustrations of vehicles are borderline — Allow them but categorize as "unrelated" with a note in the reason field.
- Allow vehicle images that include people as long as the vehicle is the main subject and the image is clear. But if a face is prominent, reject it.
- Allow vehicle images that is taken in the internet or from a magazine, as long as the vehicle is the main subject and the image is clear. But categorize them as "unrelated" with a note in the reason field.

Respond ONLY with a valid JSON object. No markdown, no explanation, no extra text. Use this exact structure:

{
  "approved": true or false,
  "category": one of ["vehicle", "vehicle_part", "blurry", "face_or_selfie", "inappropriate", "unrelated"],
  "reason": "One short phrase, max 8 words",
  "message": "One or two friendly sentences explaining the result to the user. If rejected, tell them what to do instead."
}

Be strict and consistent. When in doubt, reject.`

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
    approved: false,
    category: "unrelated",
    reason: "Validation service error",
    message: "We couldn't validate your image right now. Please try uploading the photo again.",
  })
}
