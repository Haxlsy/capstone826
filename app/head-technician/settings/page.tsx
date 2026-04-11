"use client"

import ChangePasswordSettings from "@/components/shared/ChangePasswordSettings"
import { BottomNav } from "@/components/head-technician/components/BottomNav"

export default function HeadTechSettingsPage() {
  return (
    <>
      <div className="pb-24">
        <ChangePasswordSettings />
      </div>
      <BottomNav active="settings" />
    </>
  )
}
