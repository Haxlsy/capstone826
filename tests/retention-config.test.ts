import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import {
  RETENTION_MONTH_CHOICES,
  DEFAULT_RETENTION_MONTHS,
  RETENTION_RECORD_TYPES,
  isRetentionMonths,
} from "@/lib/retention/config"

// The app's choices must match the database's CHECK constraints, or a save
// the app allows would be refused by Postgres (or the other way round).
const migration = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/20261122000001_data_retention.sql"),
  "utf8",
)

describe("retention config matches the migration", () => {
  it("has the same month choices and default", () => {
    const check = migration.match(/CHECK \(retention_months IN \(([^)]+)\)\)/)
    expect(check).not.toBeNull()
    expect(check![1].split(",").map((n) => Number(n.trim()))).toEqual([...RETENTION_MONTH_CHOICES])
    expect(migration).toContain(`retention_months int NOT NULL DEFAULT ${DEFAULT_RETENTION_MONTHS}`)
  })

  it("has the same record types", () => {
    const check = migration.match(/record_type IN \(([\s\S]*?)\)\)/)
    expect(check).not.toBeNull()
    const types = [...check![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect(types).toEqual([...RETENTION_RECORD_TYPES])
  })
})

describe("isRetentionMonths", () => {
  it("accepts only the fixed choices", () => {
    for (const n of RETENTION_MONTH_CHOICES) expect(isRetentionMonths(n)).toBe(true)
    for (const n of [0, 1, 2, 5, 7, 36, -6, 6.5, "6", null]) expect(isRetentionMonths(n)).toBe(false)
  })
})
