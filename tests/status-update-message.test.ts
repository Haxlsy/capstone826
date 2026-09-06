import { describe, it, expect } from "vitest"
import { buildReleaseMessage, buildCompletionMessage } from "@/lib/messenger/status-update"

const base = {
  customerName: "John Ashley Dulay",
  vehicleUnit: "SUV",
  plate: "ABC-826",
}

describe("buildReleaseMessage", () => {
  it("includes vehicle unit, plate, customer name and the operating hours", () => {
    const m = buildReleaseMessage({ ...base, operatingHours: "Tuesday to Sunday, 8:00 AM to 8:00 PM." })
    expect(m).toContain("your SUV (plate ABC-826)")
    expect(m).toContain("John Ashley Dulay")
    expect(m).toContain("ready for release")
    expect(m).toContain("Tuesday to Sunday, 8:00 AM to 8:00 PM.")
  })

  it("falls back to a generic hours line when the knowledge base entry is missing", () => {
    const m = buildReleaseMessage({ ...base, operatingHours: null })
    expect(m).toContain("during our regular operating hours")
    expect(m).not.toContain("undefined")
    expect(m).not.toContain("null")
  })

  it("falls back gracefully when the vehicle unit is missing", () => {
    const m = buildReleaseMessage({ ...base, vehicleUnit: null, operatingHours: null })
    expect(m).toContain("your vehicle (plate ABC-826)")
    expect(m).not.toContain("your  (plate")
  })

  it("uses a generic vehicle clause when neither vehicle unit nor plate is known", () => {
    const m = buildReleaseMessage({ ...base, vehicleUnit: null, plate: null, operatingHours: null })
    expect(m).toContain("your vehicle is now ready for release")
  })

  it("uses a generic greeting when the customer name is missing", () => {
    const m = buildReleaseMessage({ ...base, customerName: null, operatingHours: null })
    expect(m).toContain("Good news, there!")
  })

  it("treats an em-dash placeholder as missing", () => {
    const m = buildReleaseMessage({ ...base, vehicleUnit: "—", operatingHours: "—" })
    expect(m).toContain("your vehicle (plate ABC-826)")
    expect(m).toContain("during our regular operating hours")
  })
})

describe("buildCompletionMessage", () => {
  it("includes vehicle unit, plate and customer name", () => {
    const m = buildCompletionMessage(base)
    expect(m).toContain("Thank you, John Ashley Dulay!")
    expect(m).toContain("your SUV (plate ABC-826)")
  })

  it("falls back gracefully when vehicle info is missing", () => {
    const m = buildCompletionMessage({ customerName: "Jane", vehicleUnit: null, plate: null })
    expect(m).toContain("your vehicle")
    expect(m).not.toContain("undefined")
    expect(m).not.toContain("null")
  })

  it("uses a generic greeting when the customer name is missing", () => {
    const m = buildCompletionMessage({ customerName: null, vehicleUnit: null, plate: null })
    expect(m).toContain("Thank you, there!")
  })
})
