import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdminCaller } from "@/lib/auth/guard"
import { auditCallerOf } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"

// GET /api/admin/service-types
// Returns all service types sorted alphabetically.
export async function GET() {
  try {
    const auth = await getAdminCaller()
    if ("error" in auth) return auth.error

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("service_type")
      .select("name")
      .order("name")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const types = (data ?? []).map((r) => r.name as string)
    return NextResponse.json({ types })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const CreateSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
})

// POST /api/admin/service-types
// Creates a new service type. Rejects normalized duplicates.
export async function POST(request: Request) {
  try {
    const auth = await getAdminCaller()
    if ("error" in auth) return auth.error
    const { caller } = auth

    const body   = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const name  = parsed.data.name.trim()
    const admin = createAdminClient()

    const { error } = await admin.from("service_type").insert({ name, display_color: "teal" })

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `A service type similar to "${name}" already exists.` },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logAuditCall(auditCallerOf(caller), {
      category: "create",
      action:   "Created service type",
      target:   name,
    })

    return NextResponse.json({ success: true, name })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
