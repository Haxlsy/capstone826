import { useEffect, useRef, useState } from "react"
import { MoreHorizontal } from "lucide-react"
import type { IntakeRecord } from "../types"

interface Props {
  record: IntakeRecord
  onCancel: (id: string) => void
}

export default function ActionsMenu({ record, onCancel }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-xl shadow-lg w-40 py-1 text-sm">
          <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors">
            View Details
          </button>
          {record.status !== "Cancelled" && (
            <>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors">
                Edit
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors">
                Reschedule
              </button>
              <button
                onClick={() => { onCancel(record.id); setOpen(false) }}
                className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-500 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
