import { describe, it, expect, vi } from "vitest"
import { emitAppEvent, onAppEvent } from "@/lib/app-events"

describe("app events", () => {
  it("delivers to subscribers and stops after unsubscribe", () => {
    const cb = vi.fn()
    const off = onAppEvent("notification-arrived", cb)
    emitAppEvent("notification-arrived")
    expect(cb).toHaveBeenCalledTimes(1)
    off()
    emitAppEvent("notification-arrived")
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
