import { describe, it, expect } from "vitest"
import { buildPrintHtml, buildWorkbook, exportFilename, type ExportJobDetail } from "@/lib/operations/job-order-export"

const baseJob: ExportJobDetail = {
  job_order_code: "JO-0001",
  status: "Released",
  customer_name: "Juan Dela Cruz",
  contact_number: "09171234567",
  email: "juan@example.com",
  vehicle_unit: "Toyota Vios",
  plate_number: "ABC-1234",
  service: "Full Detailing",
  scheduled_at: "2026-01-05T08:00:00.000Z",
  actual_start_at: "2026-01-05T08:10:00.000Z",
  expected_completion_at: "2026-01-05T16:00:00.000Z",
  head_detailer: { full_name: "Maria Santos" },
  head_installer: null,
  history: [
    { status: "Pending", created_at: "2026-01-05T08:00:00.000Z", changed_by: "System", reason: null },
    { status: "Released", created_at: "2026-01-05T16:00:00.000Z", changed_by: "Maria Santos", reason: "Completed early" },
  ],
  stages: [
    {
      name: "Wash",
      category_name: "Preparation",
      status: "done",
      completed_at: "2026-01-05T09:00:00.000Z",
      completion_notes: "No issues.",
      rework_instructions: null,
      rework_notes: [],
      media: [
        { id: "m1", file_url: "https://storage.example/photo1.jpg", media_type: "photo", rework_round: 0, uploaded_at: "2026-01-05T09:00:00.000Z" },
        { id: "m2", file_url: "https://storage.example/video1.mp4", media_type: "video", rework_round: 0, uploaded_at: "2026-01-05T09:01:00.000Z" },
      ],
      rework_media: [],
    },
  ],
}

describe("buildPrintHtml", () => {
  it("includes a photo as an embedded image", () => {
    const html = buildPrintHtml(baseJob, "Jan 5, 2026")
    expect(html).toContain("https://storage.example/photo1.jpg")
  })

  it("never includes a video, even though it's attached to the same stage", () => {
    const html = buildPrintHtml(baseJob, "Jan 5, 2026")
    expect(html).not.toContain("video1.mp4")
  })

  it("includes the status history with the reason column", () => {
    const html = buildPrintHtml(baseJob, "Jan 5, 2026")
    expect(html).toContain("Completed early")
  })

  it("doesn't render a photo-grid element when a stage has no photos", () => {
    const noPhotos: ExportJobDetail = { ...baseJob, stages: [{ ...baseJob.stages[0], media: [], rework_media: [] }] }
    expect(() => buildPrintHtml(noPhotos, "Jan 5, 2026")).not.toThrow()
    expect(buildPrintHtml(noPhotos, "Jan 5, 2026")).not.toContain('<div class="photo-grid">')
  })
})

describe("buildWorkbook", () => {
  it("builds exactly the 4 expected sheets", () => {
    const wb = buildWorkbook(baseJob)
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Summary", "Status History", "Stages", "Photos"])
  })

  it("lists a photo in the Photos sheet but never a video", () => {
    const wb = buildWorkbook(baseJob)
    const photos = wb.getWorksheet("Photos")!
    const links = photos.getColumn("link").values.filter((v): v is { text: string; hyperlink: string } =>
      !!v && typeof v === "object" && "hyperlink" in v,
    )
    expect(links.some((v) => v.hyperlink === "https://storage.example/photo1.jpg")).toBe(true)
    expect(links.some((v) => v.hyperlink.includes("video1.mp4"))).toBe(false)
  })

  it("leaves the Photos sheet header-only (not broken) when a job has no photos at all", () => {
    const noPhotos: ExportJobDetail = { ...baseJob, stages: [{ ...baseJob.stages[0], media: [], rework_media: [] }] }
    const wb = buildWorkbook(noPhotos)
    const photos = wb.getWorksheet("Photos")!
    expect(photos.rowCount).toBe(1) // header row only
  })

  it("puts the status history reason in its own sheet", () => {
    const wb = buildWorkbook(baseJob)
    const history = wb.getWorksheet("Status History")!
    const reasons = history.getColumn("reason").values.filter((v) => typeof v === "string")
    expect(reasons).toContain("Completed early")
  })
})

describe("exportFilename", () => {
  it("builds a dated filename with the right extension", () => {
    const date = new Date(Date.UTC(2026, 0, 5, 4, 0)) // Jan 5 2026, noon Manila
    expect(exportFilename("JO-0001", "pdf", date)).toBe("JO-0001-2026-01-05.pdf")
    expect(exportFilename("JO-0001", "xlsx", date)).toBe("JO-0001-2026-01-05.xlsx")
  })
})
