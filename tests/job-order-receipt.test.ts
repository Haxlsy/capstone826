import { describe, it, expect } from "vitest"
import { buildReceiptHtml, buildReceiptWorkbook, receiptFilename } from "@/lib/operations/job-order-receipt"
import type { ExportJobDetail } from "@/lib/operations/job-order-export"

const baseJob: ExportJobDetail = {
  job_order_code: "JO-8X2K9F",
  status: "Pending",
  customer_name: "Juan Dela Cruz",
  contact_number: "09171234567",
  email: "juan@example.com",
  vehicle_unit: "Toyota Vios",
  plate_number: "ABC-1234",
  service: "Full Detailing",
  scheduled_at: "2026-01-05T08:00:00.000Z",
  actual_start_at: null,
  expected_completion_at: "2026-01-05T16:00:00.000Z",
  head_detailer: { full_name: "Maria Santos" },
  head_installer: null,
  history: [
    { status: "Pending", created_at: "2026-01-05T08:00:00.000Z", changed_by: "Ops Person", reason: "Created at front desk" },
  ],
  stages: [
    {
      name: "Clay Bar Treatment",
      category_name: "Preparation",
      status: "done",
      completed_at: "2026-01-05T09:00:00.000Z",
      completion_notes: "Internal note only.",
      rework_instructions: null,
      rework_notes: [],
      media: [{ id: "m1", file_url: "https://storage.example/photo1.jpg", media_type: "photo" }],
      rework_media: [],
    },
  ],
}

const ISSUED = "1/5/2026, 4:00:00 PM"

describe("buildReceiptHtml", () => {
  const html = buildReceiptHtml(baseJob, ISSUED)

  it("shows the reference as Job Order ID, with its value", () => {
    expect(html).toContain("Job Order ID")
    expect(html).toContain("JO-8X2K9F")
    expect(html).not.toContain("Job Order Code")
  })

  it("carries the customer, vehicle, plate, service and issue date", () => {
    for (const text of ["Juan Dela Cruz", "09171234567", "juan@example.com", "Toyota Vios", "ABC-1234", "Full Detailing", ISSUED]) {
      expect(html).toContain(text)
    }
  })

  it("tells the customer how to check status on Messenger", () => {
    expect(html).toContain("How to check your vehicle status")
    expect(html).toContain("Vehicle Status")
  })

  it("leaves out the internal record: stages, notes, photos and history", () => {
    for (const text of ["Clay Bar Treatment", "Internal note only.", "photo1.jpg", "Ops Person", "Created at front desk", "Status History"]) {
      expect(html).not.toContain(text)
    }
  })

  it("lists only the technicians who are assigned", () => {
    expect(html).toContain("Head Detailer")
    expect(html).toContain("Maria Santos")
    expect(html).not.toContain("Head Installer")
  })

  it("handles a job with no email, schedule or technicians", () => {
    const bare = buildReceiptHtml(
      { ...baseJob, email: null, scheduled_at: null, expected_completion_at: null, head_detailer: null },
      ISSUED,
    )
    expect(bare).not.toContain("Email")
    expect(bare).not.toContain("Head Detailer")
    expect(bare.match(/To be confirmed/g)).toHaveLength(2)
  })

  it("escapes HTML in customer-supplied text", () => {
    const hostile = buildReceiptHtml({ ...baseJob, customer_name: `<script>alert("x")</script>` }, ISSUED)
    expect(hostile).not.toContain("<script>")
    expect(hostile).toContain("&lt;script&gt;")
  })

  it("contains no em dashes", () => {
    expect(html).not.toContain("—")
  })
})

describe("buildReceiptWorkbook", () => {
  const wb = buildReceiptWorkbook(baseJob, ISSUED)

  it("is a single Receipt sheet", () => {
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Receipt"])
  })

  it("has the same fields as the printed receipt, led by the Job Order ID", () => {
    const sheet = wb.getWorksheet("Receipt")!
    const rows: Record<string, string> = {}
    sheet.eachRow((row, n) => {
      if (n > 1) rows[String(row.getCell(1).value)] = String(row.getCell(2).value)
    })
    expect(sheet.getRow(2).getCell(1).value).toBe("Job Order ID")
    expect(rows["Job Order ID"]).toBe("JO-8X2K9F")
    expect(rows["Customer"]).toBe("Juan Dela Cruz")
    expect(rows["Plate Number"]).toBe("ABC-1234")
    expect(rows["Service"]).toBe("Full Detailing")
    expect(rows["Issued On"]).toBe(ISSUED)
    expect(rows["Head Detailer"]).toBe("Maria Santos")
    expect(rows["Head Installer"]).toBeUndefined()
    expect(rows["How to check your vehicle status"]).toContain("Vehicle Status")
  })
})

describe("receiptFilename", () => {
  it("is dated in the shop's timezone and marked as a receipt", () => {
    // 2026-01-05 18:00 UTC is already 2026-01-06 in Manila (UTC+8).
    const date = new Date("2026-01-05T18:00:00.000Z")
    expect(receiptFilename("JO-8X2K9F", "xlsx", date)).toBe("JO-8X2K9F-receipt-2026-01-06.xlsx")
    expect(receiptFilename("JO-8X2K9F", "pdf", date)).toBe("JO-8X2K9F-receipt-2026-01-06.pdf")
  })
})
