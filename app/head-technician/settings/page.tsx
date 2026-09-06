"use client"

import ChangePasswordSettings from "@/components/shared/ChangePasswordSettings"
import PushNotificationSettings from "@/components/head-technician/PushNotificationSettings"
import { BottomNav } from "@/components/head-technician/components/BottomNav"

export default function HeadTechSettingsPage() {
  return (
    <>
      <div className="pb-24">
        <ChangePasswordSettings extraSection={<PushNotificationSettings />} />
      </div>
      <BottomNav active="settings" />
    </>
  )
}
