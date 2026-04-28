import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit"

async function getCallerProfile(supabase: ReturnType<typeof createAdminClient>) {
  const cookieStore = await cookies()
  const userClient  = createClient(cookieStore)
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null
  const { data: prof } = await supabase.from("user_account").select("full_name, role").eq("id", user.id).single()
  return prof ? { id: user.id, ...prof } : null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const body = await request.json()
  const updates: Record<string, string> = {}
  if (body.topic)   updates.topic   = body.topic
  if (body.content) updates.content = body.content

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  }

  const supabase = createAdminClient()

  const [{ error }, caller] = await Promise.all([
    supabase.from("chatbot_knowledge").update(updates).eq("id", id),
    getCallerProfile(supabase),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (caller) {
    logAudit({
      user_id:   caller.id,
      user_name: caller.full_name,
      role:      caller.role,
      category:  "update",
      action:    "Updated knowledge entry",
      target:    body.topic ?? id,
    })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createAdminClient()

  const [{ data: entry }, caller] = await Promise.all([
    supabase.from("chatbot_knowledge").select("topic").eq("id", id).single(),
    getCallerProfile(supabase),
  ])

  const { error } = await supabase.from("chatbot_knowledge").delete().eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (caller) {
    logAudit({
      user_id:   caller.id,
      user_name: caller.full_name,
      role:      caller.role,
      category:  "delete",
      action:    "Deleted knowledge entry",
      target:    entry?.topic ?? id,
    })
  }

  return NextResponse.json({ success: true })
}
