import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { getAuditCaller, getRoleCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"

const CreateCustomerSchema = z.object({
  full_name: z.string().min(1, "Name required").max(255),
  contact_number: z.string().min(1, "Phone required").max(20),
  email: z.email({ message: "Valid email required" }),
})

export async function POST(request: Request) {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const body = await request.json()

    // Validate input
    const validated = CreateCustomerSchema.parse(body)

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Check if customer with same email already exists
    const { data: existing } = await supabase
      .from("customer")
      .select("customer_id")
      .eq("email", validated.email)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Customer with this email already exists" },
        { status: 400 }
      )
    }

    // Create new customer
    const { data, error } = await supabase
      .from("customer")
      .insert([
        {
          full_name: validated.full_name,
          contact_number: validated.contact_number,
          email: validated.email,
        },
      ])
      .select("customer_id")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const caller = await getAuditCaller()
    if (caller) {
      logAuditCall(caller, {
        category: "create",
        action:   "Created customer",
        target:   validated.full_name,
      })
    }

    return NextResponse.json(
      { customer_id: data.customer_id },
      { status: 201 }
    )
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    )
  }
}
