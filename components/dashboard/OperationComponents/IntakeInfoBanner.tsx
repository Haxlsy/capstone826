import { Info } from "lucide-react"

export default function IntakeInfoBanner() {
  return (
    <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
      <Info className="w-4 h-4 text-blue-500 shrink-0" />
      <p className="text-xs text-blue-600">
        Customer and payment details are managed by Sales. For corrections, coordinate with the Sales team.
      </p>
    </div>
  )
}
