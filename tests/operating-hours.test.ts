import { describe, it, expect } from "vitest"
import { formatOperatingHours, DEFAULT_OPERATING_DAYS, DEFAULT_OPERATING_OPEN_TIME, DEFAULT_OPERATING_CLOSE_TIME } from "@/types/chatbot"

const base = {
  operating_days: DEFAULT_OPERATING_DAYS,
  operating_open_time: DEFAULT_OPERATING_OPEN_TIME,
  operating_close_time: DEFAULT_OPERATING_CLOSE_TIME,
}

describe("formatOperatingHours", () => {
  it("reproduces the shop's actual hours sentence exactly, for the seeded defaults", () => {
    expect(formatOperatingHours(base)).toBe(
      "Tuesday to Sunday, 8:00 AM to 8:00 PM. Closed on Mondays."
    )
  })

  it("omits the closed-days clause entirely when every day is open", () => {
    const m = formatOperatingHours({
      ...base,
      operating_days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    })
    expect(m).toBe("Monday to Sunday, 8:00 AM to 8:00 PM.")
  })

  it("lists each non-contiguous open day separately, and every closed day", () => {
    const m = formatOperatingHours({ ...base, operating_days: ["mon", "wed", "fri"] })
    expect(m).toBe("Monday, Wednesday, Friday, 8:00 AM to 8:00 PM. Closed on Tuesdays and Thursdays and Saturdays and Sundays.")
  })

  it("formats a single open day without a range", () => {
    const m = formatOperatingHours({ ...base, operating_days: ["sat"] })
    expect(m).toContain("Saturday, 8:00 AM to 8:00 PM.")
  })

  it("formats midday/midnight times without a redundant :00 look-alike bug", () => {
    const m = formatOperatingHours({ ...base, operating_open_time: "00:00", operating_close_time: "12:30" })
    expect(m).toContain("12:00 AM to 12:30 PM")
  })

  it("says hours aren't set yet when no days are open", () => {
    expect(formatOperatingHours({ ...base, operating_days: [] })).toBe("Operating hours have not been set yet.")
  })
})
