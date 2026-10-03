import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdminCaller } from "@/lib/auth/guard"
import { auditCallerOf } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"

// GET /api/admin/shop-config
export async function GET() {
  try {
    const auth = await getAdminCaller()
    if ("error" in auth) return auth.error

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("shop_config")
      .select("max_capacity, updated_at")
      .eq("id", 1)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const PatchSchema = z.object({
  max_capacity: z.number().int().min(1).max(1000),
})

// PATCH /api/admin/shop-config
export async function PATCH(request: Request) {
  try {
    const auth = await getAdminCaller()
    if ("error" in auth) return auth.error
    const { caller } = auth

    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("shop_config")
      .update({ max_capacity: parsed.data.max_capacity, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("max_capacity, updated_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAuditCall(auditCallerOf(caller), {
      category: "update",
      action:   "Updated shop capacity",
      target:   `max_capacity = ${parsed.data.max_capacity}`,
    })

    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
