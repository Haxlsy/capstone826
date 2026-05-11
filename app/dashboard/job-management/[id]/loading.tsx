import { Sk, SkRow } from "@/components/ui/skeleton"

export function JobOrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto animate-pulse">
      <SkRow className="justify-between">
        <Sk className="h-4 w-40" />
        <SkRow className="gap-3">
          <Sk className="h-9 w-24 rounded-lg" />
          <Sk className="h-9 w-28 rounded-lg" />
        </SkRow>
      </SkRow>
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
        <SkRow className="justify-between items-start">
          <div className="space-y-2">
            <Sk className="h-3 w-24" />
            <Sk className="h-6 w-48" />
            <Sk className="h-4 w-32" />
          </div>
          <Sk className="h-6 w-20 rounded-full" />
        </SkRow>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Sk className="h-3 w-20" />
              <Sk className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <Sk className="h-5 w-28" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-3">
              <Sk className="h-4 w-24" />
              <SkRow>
                <Sk className="h-8 w-8 rounded-full shrink-0" />
                <Sk className="h-4 w-32" />
              </SkRow>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <Sk className="h-5 w-32" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border border-gray-100 rounded-xl p-4">
            <Sk className="h-8 w-8 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Sk className="h-4" style={{ width: `${120 + (i % 3) * 20}px` }} />
              <Sk className="h-3 w-24" />
            </div>
            <Sk className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function JobOrderDetailLoading() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <JobOrderDetailSkeleton />
    </div>
  )
}
