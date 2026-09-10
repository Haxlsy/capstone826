import ChangePasswordSettings from "@/components/shared/ChangePasswordSettings"
import OfflineSyncSettings from "@/components/dashboard/OperationComponents/OfflineSyncSettings"

export default function OperationsSettingsPage() {
  return <ChangePasswordSettings extraSection={<OfflineSyncSettings />} />
}
