import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("chatbot_config")
    .select("id, system_prompt, updated_at")
    .limit(1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}

export async function POST(request: Request) {
  const { system_prompt } = await request.json()

  if (typeof system_prompt !== "string") {
    return NextResponse.json({ error: "system_prompt is required." }, { status: 400 })
  }

  const cookieStore = await cookies()
  const userClient = createClient(cookieStore)
  const { data: { user } } = await userClient.auth.getUser()

  const supabase = createAdminClient()

  // Get the config row id first
  const { data: config } = await supabase
    .from("chatbot_config")
    .select("id")
    .limit(1)
    .single()

  if (!config) return NextResponse.json({ error: "Config not found." }, { status: 404 })

  const { error } = await supabase
    .from("chatbot_config")
    .update({
      system_prompt,
      updated_by_id: user?.id ?? null,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", config.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
