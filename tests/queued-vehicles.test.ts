import { describe, it, expect } from "vitest"
import { queuedVehicles, isVehicleQueued } from "@/lib/offline/queued-vehicles"
import type { OutboxItem } from "@/lib/offline/db"

function item(overrides: Partial<OutboxItem> & { payload: Record<string, unknown> }): OutboxItem {
  return {
    id: crypto.randomUUID(),
    type: "add_job_order",
    createdAt: 0,
    status: "pending",
    attempts: 0,
    ...overrides,
  }
}

describe("queuedVehicles", () => {
  it("is empty for an empty queue", () => {
    const q = queuedVehicles([])
    expect(q.recordIds.size).toBe(0)
    expect(q.plates.size).toBe(0)
    expect(isVehicleQueued(q, { id: "rec-1", plate: "ABC 123" })).toBe(false)
  })

  it("tracks a picked customer's vehicle by record id and by its display plate", () => {
    const q = queuedVehicles([
      item({ payload: { customer_record_id: "rec-1", _display: { plate_number: "ABC 123" } } }),
    ])
    expect(isVehicleQueued(q, { id: "rec-1" })).toBe(true)
    expect(isVehicleQueued(q, { plate: "ABC 123" })).toBe(true)
    expect(isVehicleQueued(q, { id: "rec-2", plate: "XYZ 999" })).toBe(false)
  })

  it("tracks a manually entered vehicle by plate, ignoring case and outer spaces", () => {
    const q = queuedVehicles([item({ payload: { plate_number: "  dev-168 " } })])
    expect(isVehicleQueued(q, { plate: "DEV-168" })).toBe(true)
    expect(isVehicleQueued(q, { id: "rec-9", plate: "Dev-168" })).toBe(true)
  })

  it("still counts an item whose sync failed", () => {
    const q = queuedVehicles([
      item({ status: "failed", payload: { customer_record_id: "rec-1" } }),
    ])
    expect(isVehicleQueued(q, { id: "rec-1" })).toBe(true)
  })

  it("ignores queued actions that aren't job orders", () => {
    const q = queuedVehicles([
      item({ type: "resolve_concern", payload: { concernId: "c-1", customer_record_id: "rec-1", plate_number: "ABC 123" } }),
    ])
    expect(isVehicleQueued(q, { id: "rec-1", plate: "ABC 123" })).toBe(false)
  })

  it("never matches a blank plate", () => {
    const q = queuedVehicles([item({ payload: { plate_number: "", _display: { plate_number: "" } } })])
    expect(isVehicleQueued(q, { plate: "" })).toBe(false)
    expect(isVehicleQueued(q, { plate: null })).toBe(false)
  })
})
