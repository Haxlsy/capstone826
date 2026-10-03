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

  describe("holidays", () => {
    // Fixed "now" so these don't depend on the day the suite happens to run.
    const now = new Date(Date.UTC(2026, 5, 1, 4, 0)) // Jun 1 2026, noon Manila

    it("appends an upcoming holiday", () => {
      const m = formatOperatingHours({ ...base, holidays: [{ date: "2026-12-25", label: "Christmas Day" }] }, now)
      expect(m).toBe("Tuesday to Sunday, 8:00 AM to 8:00 PM. Closed on Mondays. Also closed Dec 25, 2026 for Christmas Day.")
    })

    it("excludes a holiday that has already passed", () => {
      const m = formatOperatingHours({ ...base, holidays: [{ date: "2026-01-01", label: "New Year's Day" }] }, now)
      expect(m).not.toContain("New Year's Day")
    })

    it("sorts upcoming holidays chronologically and caps at 3", () => {
      const holidays = [
        { date: "2027-06-12", label: "Independence Day" },
        { date: "2026-08-21", label: "Ninoy Aquino Day" },
        { date: "2026-12-25", label: "Christmas Day" },
        { date: "2026-12-30", label: "Rizal Day" },
        { date: "2027-01-01", label: "New Year's Day" },
      ]
      const m = formatOperatingHours({ ...base, holidays }, now)
      const clause = m.split("Also closed ")[1]
      expect(clause).toBe("Aug 21, 2026 for Ninoy Aquino Day; Dec 25, 2026 for Christmas Day; Dec 30, 2026 for Rizal Day.")
    })

    it("has no holiday clause when the list is empty", () => {
      expect(formatOperatingHours({ ...base, holidays: [] }, now)).not.toContain("Also closed")
    })
  })
})
