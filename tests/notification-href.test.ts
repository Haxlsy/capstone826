import { describe, it, expect } from "vitest"
import { getNotificationHref } from "@/lib/notification-href"

const base = { type: "job_status", job_order_id: null, inquiry_id: null, concern_id: null }

describe("getNotificationHref", () => {
  it("a concern opens the concern, never the job it belongs to", () => {
    const n = { ...base, type: "concern", job_order_id: "j1", concern_id: "c1" }
    expect(getNotificationHref(n, "operations")).toBe("/dashboard/concerns?concern=c1")
  })
  it("an older concern without an id opens the Concerns list", () => {
    expect(getNotificationHref({ ...base, type: "concern", job_order_id: "j1" }, "operations")).toBe("/dashboard/concerns")
  })
  it("job notifications route by role", () => {
    const n = { ...base, job_order_id: "j1" }
    expect(getNotificationHref(n, "operations")).toBe("/dashboard/job-management/j1")
    expect(getNotificationHref(n, "sales")).toBe("/dashboard/sales/jobs/j1")
    expect(getNotificationHref(n, "head_detailer")).toBe("/head-technician/j1")
  })
  it("a resolved concern (sent to the head tech) opens the concern, not the job", () => {
    const n = { ...base, type: "concern_resolved", job_order_id: "j1", concern_id: "c1" }
    expect(getNotificationHref(n, "head_installer")).toBe("/head-technician/concerns?concernId=c1")
  })
  it("an older resolved-concern notification without an id opens the Concerns list", () => {
    expect(getNotificationHref({ ...base, type: "concern_resolved", job_order_id: "j1" }, "head_installer")).toBe("/head-technician/concerns")
  })
  it("inquiries deep-link, with a fallback", () => {
    expect(getNotificationHref({ ...base, type: "inquiry", inquiry_id: "i1" }, "sales")).toBe("/dashboard/sales?inquiry=i1")
    expect(getNotificationHref({ ...base, type: "inquiry" }, "sales")).toBe("/dashboard/sales")
  })
  it("returns null when there is nowhere to go", () => {
    expect(getNotificationHref(base, "operations")).toBeNull()
  })
})
