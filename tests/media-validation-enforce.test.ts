import { describe, it, expect, vi } from "vitest"

// The module builds a Gemini client and imports Supabase/sharp at load time;
// none of that is needed to test the approval gate.
vi.mock("@google/genai", () => ({ GoogleGenAI: class {} }))
vi.mock("sharp", () => ({ default: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

const { enforceApproval } = await import("@/lib/ai/media-validation")

const base = { reason: "test", message: "Looks good." }

describe("enforceApproval", () => {
  it("keeps an approval of a vehicle or vehicle part", () => {
    expect(enforceApproval({ ...base, approved: true, category: "vehicle" }, "photo").approved).toBe(true)
    expect(enforceApproval({ ...base, approved: true, category: "vehicle_part" }, "video").approved).toBe(true)
  })

  it("rejects an approval whose category has no vehicle in it", () => {
    for (const category of ["workspace", "screen_or_document", "unrelated", "inappropriate", "anything"]) {
      const r = enforceApproval({ ...base, approved: true, category }, "photo")
      expect(r.approved).toBe(false)
      expect(r.message).toMatch(/vehicle/)
    }
  })

  it("only treats a strict boolean true as approved", () => {
    const loose = { ...base, approved: "true" as unknown as boolean, category: "vehicle" }
    expect(enforceApproval(loose, "photo").approved).toBe(false)
  })

  it("keeps the model's own message on a rejection", () => {
    const r = enforceApproval({ ...base, approved: false, category: "unrelated", message: "Please retake." }, "photo")
    expect(r).toMatchObject({ approved: false, message: "Please retake." })
  })
})

const { enforceVideoApproval, unreadableVideo } = await import("@/lib/ai/media-validation")
const frame = (category: string) => ({ category, reason: "test" })

describe("enforceVideoApproval", () => {
  it("approves when every frame shows a vehicle or vehicle part", () => {
    const r = enforceVideoApproval(
      { approved: true, category: "", reason: "car", message: "ok", frames: [frame("vehicle"), frame("vehicle_part"), frame("vehicle")] },
      3,
    )
    expect(r.approved).toBe(true)
  })

  it("rejects when any one frame is text or a screen", () => {
    const r = enforceVideoApproval(
      { approved: true, category: "", reason: "mixed", message: "ok", frames: [frame("vehicle"), frame("screen_or_document"), frame("vehicle")] },
      3,
    )
    expect(r.approved).toBe(false)
    expect(r.category).toBe("screen_or_document")
    expect(r.message).toMatch(/vehicle/)
  })

  it("rejects when the model skipped some frames", () => {
    const r = enforceVideoApproval(
      { approved: true, category: "", reason: "car", message: "ok", frames: [frame("vehicle")] },
      4,
    )
    expect(r.approved).toBe(false)
  })

  it("rejects text with a car emoji even if the model said approved", () => {
    const r = enforceVideoApproval(
      { approved: true, category: "", reason: "text with car emoji", message: "ok", frames: [frame("unrelated"), frame("unrelated")] },
      2,
    )
    expect(r.approved).toBe(false)
  })
})

describe("unreadableVideo", () => {
  it("rejects and asks to record again", () => {
    expect(unreadableVideo()).toMatchObject({ approved: false, message: expect.stringMatching(/record it again/) })
  })
})
