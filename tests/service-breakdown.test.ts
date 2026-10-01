import { describe, it, expect, vi } from "vitest"
import {
  computeServiceBreakdown,
  serviceBreakdownLabel,
  fetchServiceBreakdown,
  SERVICE_BREAKDOWN_STATUSES,
} from "@/lib/admin/service-breakdown"

describe("SERVICE_BREAKDOWN_STATUSES", () => {
  it("includes every active status plus Released — the bug was 'For Inspection' silently missing", () => {
    expect(SERVICE_BREAKDOWN_STATUSES).toContain("For Inspection")
    expect(SERVICE_BREAKDOWN_STATUSES).toContain("Pending")
    expect(SERVICE_BREAKDOWN_STATUSES).toContain("Ongoing")
    expect(SERVICE_BREAKDOWN_STATUSES).toContain("For Rework")
    expect(SERVICE_BREAKDOWN_STATUSES).toContain("For Release")
    expect(SERVICE_BREAKDOWN_STATUSES).toContain("Released")
  })

  it("never counts a Cancelled job as popular", () => {
    expect(SERVICE_BREAKDOWN_STATUSES).not.toContain("Cancelled")
  })
})

describe("serviceBreakdownLabel", () => {
  it("groups by service_type — the chart's own stated purpose", () => {
    expect(serviceBreakdownLabel({ name: "F1 Mod - Triplet", service_type: "PPF" })).toBe("PPF")
  })

  it("falls back to the exact service name only when service_type is unset", () => {
    expect(serviceBreakdownLabel({ name: "Custom Detail", service_type: null })).toBe("Custom Detail")
    expect(serviceBreakdownLabel({ name: "Custom Detail", service_type: "" })).toBe("Custom Detail")
    expect(serviceBreakdownLabel({ name: "Custom Detail", service_type: "   " })).toBe("Custom Detail")
  })

  it("is 'Unknown' for a job with no service at all", () => {
    expect(serviceBreakdownLabel(null)).toBe("Unknown")
    expect(serviceBreakdownLabel(undefined)).toBe("Unknown")
  })
})

describe("computeServiceBreakdown", () => {
  it("merges two different service names sharing one service_type into ONE bar", () => {
    const rows = [
      { service: { name: "F1 Mod - Triplet", service_type: "PPF" } },
      { service: { name: "F1 Mod - Stage Detailer", service_type: "PPF" } },
      { service: { name: "F1 Mod - Installer Stage", service_type: "PPF" } },
    ]
    expect(computeServiceBreakdown(rows)).toEqual([{ service_name: "PPF", count: 3 }])
  })

  it("sorts by count descending — the SSR path used to not sort at all", () => {
    const rows = [
      { service: { name: "A", service_type: "Ceramic Coating" } },
      { service: { name: "B", service_type: "Window Tint" } },
      { service: { name: "C", service_type: "Window Tint" } },
    ]
    expect(computeServiceBreakdown(rows)).toEqual([
      { service_name: "Window Tint", count: 2 },
      { service_name: "Ceramic Coating", count: 1 },
    ])
  })

  it("handles PostgREST's array-or-object embed shape for `service`", () => {
    const rows = [
      { service: [{ name: "A", service_type: "PPF" }] },
      { service: { name: "B", service_type: "PPF" } },
    ]
    expect(computeServiceBreakdown(rows)).toEqual([{ service_name: "PPF", count: 2 }])
  })

  it("is empty for no rows", () => {
    expect(computeServiceBreakdown([])).toEqual([])
  })
})

describe("fetchServiceBreakdown", () => {
  // The actual runtime path — counts in Postgres instead of fetching every
  // matching job_order row into JS (see the migration's comment for why).
  it("forwards statuses/since to the RPC and returns its rows, coercing bigint-as-string counts to numbers", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { service_name: "Window Tint", count: "2" },
        { service_name: "PPF", count: 1 },
      ],
      error: null,
    })
    const admin = { rpc } as unknown as Parameters<typeof fetchServiceBreakdown>[0]

    const result = await fetchServiceBreakdown(admin, { statuses: SERVICE_BREAKDOWN_STATUSES, since: "2026-09-01T00:00:00.000Z" })

    expect(rpc).toHaveBeenCalledWith("service_breakdown_counts", {
      p_statuses: [...SERVICE_BREAKDOWN_STATUSES],
      p_since: "2026-09-01T00:00:00.000Z",
    })
    expect(result).toEqual([
      { service_name: "Window Tint", count: 2 },
      { service_name: "PPF", count: 1 },
    ])
  })

  it("passes null for 'Overall' (no since bound)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    const admin = { rpc } as unknown as Parameters<typeof fetchServiceBreakdown>[0]

    await fetchServiceBreakdown(admin, { statuses: SERVICE_BREAKDOWN_STATUSES })

    expect(rpc).toHaveBeenCalledWith("service_breakdown_counts", {
      p_statuses: [...SERVICE_BREAKDOWN_STATUSES],
      p_since: null,
    })
  })

  it("throws on an RPC error rather than silently returning nothing", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "function does not exist" } })
    const admin = { rpc } as unknown as Parameters<typeof fetchServiceBreakdown>[0]

    await expect(fetchServiceBreakdown(admin, { statuses: SERVICE_BREAKDOWN_STATUSES })).rejects.toThrow(
      "function does not exist",
    )
  })
})
