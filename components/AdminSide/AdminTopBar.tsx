"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

export default function AdminTopBar() {
  const [fullName, setFullName] = useState("Admin")
  const [initials, setInitials] = useState("AD")

  useEffect(() => {
    const supabase = createClient()

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profile")
        .select("full_name")
        .eq("user_id", user.id)
        .single()

      if (profile?.full_name) {
        setFullName(profile.full_name)
        const parts = profile.full_name.trim().split(" ")
        const ini = parts.length >= 2
          ? parts[0][0] + parts[parts.length - 1][0]
          : parts[0].slice(0, 2)
        setInitials(ini.toUpperCase())
      }
    }

    loadUser()
  }, [])

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-end px-6 gap-5 shrink-0">
      <div className="relative">
        <Bell className="w-5 h-5 text-gray-500" />
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          3
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gray-700 text-white text-xs font-semibold flex items-center justify-center">
          {initials}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-gray-800">{fullName}</span>
          <span className="text-xs text-gray-400">Admin</span>
        </div>
      </div>
    </header>
  )
}
