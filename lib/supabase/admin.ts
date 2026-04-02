import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// Add SUPABASE_SERVICE_ROLE_KEY to your .env.local
// Get it from: Supabase Dashboard → Project Settings → API → service_role (secret)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const createAdminClient = () =>
  createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
