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

  // Only relevant when the edit touches topic and/or category — a content-only
  // edit can't collide with anything. Partial updates mean either field may be
  // omitted, so resolve the *effective* topic/category against the current row
  // first, and exclude this entry's own id from the duplicate search.
  if (parsed.data.topic !== undefined || parsed.data.category !== undefined) {
    const { data: current, error: currentErr } = await supabase
      .from("chatbot_knowledge")
      .select("topic, category")
      .eq("id", id)
      .single()
    if (currentErr || !current) {
      return NextResponse.json({ error: currentErr?.message ?? "Entry not found." }, { status: 404 })
    }

    const effectiveTopic    = parsed.data.topic    ?? current.topic
    const effectiveCategory = parsed.data.category ?? current.category

    const { data: candidates, error: candErr } = await supabase
      .from("chatbot_knowledge")
      .select("topic")
      .eq("category", effectiveCategory)
      .neq("id", id)
    if (candErr) return NextResponse.json({ error: candErr.message }, { status: 500 })

    const normalized = effectiveTopic.toLowerCase()
    if ((candidates ?? []).some((e) => e.topic.toLowerCase() === normalized)) {
      return NextResponse.json(
        { error: `"${effectiveTopic}" already exists in the ${effectiveCategory} category. Use a different name, or edit the existing entry.` },
        { status: 409 },
      )
    }
  }

  const { error } = await supabase
    .from("chatbot_knowledge")
    .update(parsed.data)
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditCall(auditCallerOf(caller), {
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

  await logAuditCall(auditCallerOf(caller), {
    category: "delete",
    action:   "Deleted knowledge entry",
    target:   entry?.topic ?? id,
  })

  return NextResponse.json({ success: true })
}