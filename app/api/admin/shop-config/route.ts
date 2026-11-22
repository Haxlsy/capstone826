import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdminCaller } from "@/lib/auth/guard"
import { auditCallerOf } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { readJsonBody } from "@/lib/http/read-json-body"
import { RETENTION_MONTH_CHOICES } from "@/lib/retention/config"

// GET /api/admin/shop-config
export async function GET() {
  try {
    const auth = await getAdminCaller()
    if ("error" in auth) return auth.error

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("shop_config")
      .select("max_capacity, retention_months, retention_changed_at, updated_at")
      .eq("id", 1)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Either setting, or both. retention_months only takes the fixed choices
// (the database's CHECK constraint enforces the same list).
const PatchSchema = z
  .object({
    max_capacity: z.number().int().min(1).max(1000).optional(),
    retention_months: z
      .number()
      .int()
      .refine((n) => (RETENTION_MONTH_CHOICES as readonly number[]).includes(n), "Choose 3, 6, 12 or 24 months.")
      .optional(),
  })
  .refine((b) => b.max_capacity !== undefined || b.retention_months !== undefined, "Nothing to change.")

const CONFIG_COLUMNS = "max_capacity, retention_months, retention_changed_at, updated_at"

// PATCH /api/admin/shop-config
export async function PATCH(request: Request) {
  try {
    const auth = await getAdminCaller()
    if ("error" in auth) return auth.error
    const { caller } = auth

    const body = await readJsonBody(request)
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const admin = createAdminClient()
    const { max_capacity: nextCapacity, retention_months: nextMonths } = parsed.data

    // Read the current values first so the audit trail shows old -> new.
    const { data: before } = await admin
      .from("shop_config")
      .select(CONFIG_COLUMNS)
      .eq("id", 1)
      .single()

    const capacityChanged = nextCapacity !== undefined && nextCapacity !== before?.max_capacity
    const monthsChanged = nextMonths !== undefined && nextMonths !== before?.retention_months
    if (!capacityChanged && !monthsChanged) return NextResponse.json(before)

    const now = new Date().toISOString()
    const { data, error } = await admin
      .from("shop_config")
      .update({
        ...(capacityChanged ? { max_capacity: nextCapacity } : {}),
        // A new period restarts the 14-day safety period (lib/retention/plan.ts).
        ...(monthsChanged ? { retention_months: nextMonths, retention_changed_at: now } : {}),
        updated_at: now,
        updated_by: caller.user.id,
      })
      .eq("id", 1)
      .select(CONFIG_COLUMNS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (capacityChanged) {
      const previous = before?.max_capacity ?? null
      await logAuditCall(auditCallerOf(caller), {
        category: "update",
        action:   "Changed daily capacity",
        target:   previous === null
          ? `Daily capacity set to ${nextCapacity} cars`
          : `Daily capacity: ${previous} → ${nextCapacity} cars`,
      })
    }
    if (monthsChanged) {
      await logAuditCall(auditCallerOf(caller), {
        category: "update",
        action:   "Changed data retention period",
        target:   `Records kept: ${before?.retention_months ?? "?"} → ${nextMonths} months`,
      })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
