import { describe, it, expect } from "vitest"
import {
  EXPORT_HEADERS,
  toExportRow,
  toCsvCells,
  exportFilename,
  buildPrintHtml,
  type ExportableCustomerRecord,
} from "@/lib/sales/customer-records-export"

const rec: ExportableCustomerRecord = {
  fullName: "Harley Soldao",
  contactNumber: "09171234567",
  email: "h@example.com",
  plateNumber: "ABC 1234",
  vehicleUnit: "Toyota Vios",
  messengerLinked: true,
  createdAt: "Jan 5, 2026",
  activeJobOrderCode: "JO-1",
}

describe("toExportRow", () => {
  it("has one value per header", () => {
    expect(toExportRow(rec)).toHaveLength(EXPORT_HEADERS.length)
  })
  it("shows Messenger linkage as Yes/No", () => {
    expect(toExportRow(rec)).toContain("Yes")
    expect(toExportRow({ ...rec, messengerLinked: false })).toContain("No")
  })
  it("uses a dash for a missing email or no active job", () => {
    const row = toExportRow({ ...rec, email: null, activeJobOrderCode: null })
    expect(row[2]).toBe("—")
    expect(row[6]).toBe("—")
  })
})

describe("toCsvCells", () => {
  it("marks only the contact number as text", () => {
    const cells = toCsvCells(rec)
    expect(cells[1]).toEqual({ text: "09171234567" })
    expect(cells[0]).toBe("Harley Soldao")
  })
})

describe("exportFilename", () => {
  it("is dated in Asia/Manila, not UTC", () => {
    // 2026-01-05 20:00 UTC is already Jan 6 in Manila (UTC+8)
    expect(exportFilename(new Date("2026-01-05T20:00:00Z"))).toBe("customer-records-2026-01-06.csv")
  })
})

describe("buildPrintHtml", () => {
  it("escapes customer-controlled text", () => {
    const html = buildPrintHtml([{ ...rec, fullName: "<script>alert(1)</script>" }], "Jan 5, 2026")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })
  it("pluralises the record count", () => {
    expect(buildPrintHtml([rec], "x")).toContain("1 record<")
    expect(buildPrintHtml([rec, rec], "x")).toContain("2 records<")
  })
})
