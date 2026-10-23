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
