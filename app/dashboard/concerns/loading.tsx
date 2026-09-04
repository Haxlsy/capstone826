import { Sk, SkRow } from "@/components/ui/skeleton"

export function ConcernsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <Sk className="h-8 w-36" />
      <SkRow className="justify-between">
        <Sk className="h-11 w-72 rounded-pill" />
        <SkRow className="gap-2">
          <Sk className="h-8 w-12 rounded-pill" />
          <Sk className="h-8 w-20 rounded-pill" />
          <Sk className="h-8 w-20 rounded-pill" />
        </SkRow>
      </SkRow>
      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
        <div className="flex items-center gap-4 border-b border-border-subtle bg-surface-subtle px-4 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Sk key={i} className="h-3 w-20 rounded" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3.5 last:border-b-0">
            <SkRow className="w-32">
              <Sk className="h-7 w-7 shrink-0 rounded-full" />
              <div className="space-y-1">
                <Sk className="h-3 w-20" />
                <Sk className="h-2.5 w-12" />
              </div>
            </SkRow>
            <Sk className="h-4 w-24 rounded" />
            <Sk className="h-4 flex-1 rounded" />
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
            <Sk key={i} className="h-8 w-8 rounded-sm" />
          ))}
        </SkRow>
      </SkRow>
    </div>
  )
}

export default function ConcernsLoading() {
  return (
    <div className="p-6">
      <ConcernsSkeleton />
    </div>
  )
}
