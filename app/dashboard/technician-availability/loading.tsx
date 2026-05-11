import { Sk, SkRow } from "@/components/ui/skeleton"

export function TechnicianAvailabilitySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <SkRow className="justify-between">
        <div className="space-y-1.5">
          <Sk className="h-7 w-52" />
          <Sk className="h-4 w-80" />
        </div>
        <Sk className="h-9 w-36 rounded-lg" />
      </SkRow>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <Sk className="h-10 w-10 rounded-xl shrink-0" />
            <div className="space-y-1.5">
              <Sk className="h-6 w-10" />
              <Sk className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
      <SkRow className="gap-3">
        <Sk className="h-9 w-64 rounded-lg" />
        <Sk className="h-9 w-36 rounded-lg" />
      </SkRow>
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
            <Sk className="h-5 w-20 rounded-full" />
            <Sk className="h-4 w-32" />
          </div>
          {Array.from({ length: g === 0 ? 3 : 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-b-0">
              <Sk className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Sk className="h-4" style={{ width: `${100 + (i % 3) * 20}px` }} />
                <SkRow className="gap-2">
                  <Sk className="h-3 w-16" />
                  <Sk className="h-3 w-20" />
                </SkRow>
                <SkRow className="gap-0.5 mt-1">
                  {Array.from({ length: 7 }).map((_, d) => (
                    <Sk key={d} className="h-5 w-7 rounded" />
                  ))}
                </SkRow>
              </div>
              <SkRow className="gap-2">
                <Sk className="h-8 w-8 rounded-lg" />
                <Sk className="h-8 w-8 rounded-lg" />
              </SkRow>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function TechnicianAvailabilityLoading() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <TechnicianAvailabilitySkeleton />
    </div>
  )
}
