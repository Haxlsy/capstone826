/**
 * How full the shop is today, for the Admin dashboard's "Active Jobs Today"
 * card: the bar percentage (capped at 100), its colour band (same 70% / 90%
 * thresholds the card always used), and how many jobs over capacity it is.
 */
export function capacityStatus(count: number, capacity: number): {
  pct: number
  tone: "ok" | "busy" | "full"
  over: number
} {
  const safeCapacity = Math.max(1, Math.floor(capacity) || 1)
  const raw = (Math.max(0, count) / safeCapacity) * 100
  const pct = Math.min(raw, 100)
  const tone = pct >= 90 ? "full" : pct >= 70 ? "busy" : "ok"
  return { pct, tone, over: Math.max(0, count - safeCapacity) }
}
