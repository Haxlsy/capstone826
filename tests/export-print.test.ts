import { describe, it, expect } from "vitest"
import { escapeHtml, csvCell, buildCsv } from "@/lib/export/print"

describe("escapeHtml", () => {
  it("escapes markup and quotes", () => {
    expect(escapeHtml(`<b onclick="x">'&`)).toBe("&lt;b onclick=&quot;x&quot;&gt;&#39;&amp;")
  })
  it("renders null/undefined as empty", () => {
    expect(escapeHtml(null)).toBe("")
    expect(escapeHtml(undefined)).toBe("")
  })
})

describe("csvCell", () => {
  it("quotes and doubles embedded quotes", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })
  it("keeps commas and newlines inside the quoted cell", () => {
    expect(csvCell("a,b\nc")).toBe('"a,b\nc"')
  })
  it("neutralises a leading formula character", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"')
    expect(csvCell("+1")).toBe(`"'+1"`)
    expect(csvCell("-1")).toBe(`"'-1"`)
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`)
  })
  it("writes a phone number as text so Excel keeps the leading zero", () => {
    expect(csvCell({ text: "09171234567" })).toBe('"=""09171234567"""')
    expect(csvCell({ text: "+63 917 123 4567" })).toBe('"=""+63 917 123 4567"""')
  })
  it("does not treat a non-phone text cell as a phone", () => {
    expect(csvCell({ text: '=1+1' })).toBe(`"'=1+1"`)
  })
  it("renders empty cells as empty quotes", () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell({ text: null })).toBe('""')
  })
})

describe("buildCsv", () => {
  it("joins header and rows with CRLF", () => {
    expect(buildCsv(["A", "B"], [["1", "2"]])).toBe('"A","B"\r\n"1","2"')
  })
})
