import { Sk, SkRow } from "@/components/ui/skeleton"

export function ConcernsSkeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="space-y-1.5">
        <Sk className="h-7 w-36" />
        <Sk className="h-4 w-56" />
      </div>
      <SkRow className="justify-between">
        <Sk className="h-9 w-64 rounded-lg" />
        <SkRow className="gap-2">
          <Sk className="h-8 w-12 rounded-full" />
          <Sk className="h-8 w-20 rounded-full" />
          <Sk className="h-8 w-20 rounded-full" />
        </SkRow>
      </SkRow>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50">
          {[120, 100, 160, 60, 80, 64].map((w, i) => (
            <Sk key={i} className="h-3 rounded" style={{ width: `${w}px` }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-50 last:border-b-0">
            <SkRow style={{ width: "120px" }}>
              <Sk className="h-7 w-7 rounded-full shrink-0" />
              <div className="space-y-1">
                <Sk className="h-3 w-20" />
                <Sk className="h-2.5 w-12" />
              </div>
            </SkRow>
            <Sk className="h-4 rounded" style={{ width: `${80 + (i % 3) * 10}px` }} />
            <Sk className="h-4 rounded flex-1" style={{ width: `${140 + (i % 4) * 10}px` }} />
            <Sk className="h-4 w-8 rounded" />
            <Sk className="h-4 w-20 rounded" />
            <Sk className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
      <SkRow className="justify-between">
        <Sk className="h-4 w-32" />
        <SkRow className="gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk key={i} className="h-8 w-8 rounded-md" />
          ))}
        </SkRow>
      </SkRow>
    </div>
  )
}

export default function ConcernsLoading() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <ConcernsSkeleton />
    </div>
  )
}
