import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdminCaller } from "@/lib/auth/guard"
import { auditCallerOf } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { kbUpdateSchema } from "@/types/chatbot"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAdminCaller()
  if ("error" in auth) return auth.error
  const { caller } = auth

  const { id } = await params

  const body = await request.json()
  const parsed = kbUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from("chatbot_knowledge")
    .update(parsed.data)
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAuditCall(auditCallerOf(caller), {
    category: "update",
    action:   "Updated knowledge entry",
    target:   parsed.data.topic ?? id,
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAdminCaller()
  if ("error" in auth) return auth.error
  const { caller } = auth

  const { id } = await params

  const supabase = createAdminClient()

  const { data: entry } = await supabase
    .from("chatbot_knowledge")
    .select("topic")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("chatbot_knowledge").delete().eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAuditCall(auditCallerOf(caller), {
    category: "delete",
    action:   "Deleted knowledge entry",
    target:   entry?.topic ?? id,
  })

  return NextResponse.json({ success: true })
}