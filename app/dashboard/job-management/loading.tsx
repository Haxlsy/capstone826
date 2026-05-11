import { Sk, SkRow } from "@/components/ui/skeleton"

export function JobManagementSkeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <SkRow className="justify-between">
        <Sk className="h-7 w-36" />
        <Sk className="h-9 w-36 rounded-lg" />
      </SkRow>
      <SkRow>
        <Sk className="h-9 w-72 rounded-lg" />
        <Sk className="h-9 w-24 rounded-lg" />
      </SkRow>
      <SkRow className="gap-2 border-b border-gray-100 pb-0">
        {Array.from({ length: 7 }).map((_, i) => (
          <Sk key={i} className="h-8 rounded-lg" style={{ width: `${56 + i * 4}px` }} />
        ))}
      </SkRow>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50">
          {[80, 100, 90, 110, 90, 90, 72, 64].map((w, i) => (
            <Sk key={i} className="h-3 rounded" style={{ width: `${w}px` }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-50 last:border-b-0">
            <Sk className="h-4 rounded" style={{ width: `${68 + (i % 3) * 8}px` }} />
            <Sk className="h-4 rounded" style={{ width: `${88 + (i % 4) * 6}px` }} />
            <Sk className="h-4 rounded" style={{ width: `${72 + (i % 2) * 12}px` }} />
            <Sk className="h-4 rounded" style={{ width: `${96 + (i % 3) * 8}px` }} />
            <Sk className="h-4 rounded" style={{ width: `${80 + (i % 2) * 8}px` }} />
            <Sk className="h-4 rounded" style={{ width: `${76 + (i % 3) * 6}px` }} />
            <Sk className="h-4 rounded w-20" />
            <Sk className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
      <SkRow className="justify-between">
        <Sk className="h-4 w-32" />
        <SkRow className="gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk key={i} className="h-8 w-8 rounded-md" />
          ))}
        </SkRow>
      </SkRow>
    </div>
  )
}

export default function JobManagementLoading() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <JobManagementSkeleton />
    </div>
  )
}
