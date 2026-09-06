import { Sk, SkRow } from "@/components/ui/skeleton"

export function SalesJobListSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <div className="space-y-1.5">
        <Sk className="h-7 w-40" />
        <Sk className="h-4 w-72" />
      </div>
      <SkRow className="gap-2 border-b border-border-subtle pb-0">
        {Array.from({ length: 7 }).map((_, i) => (
          <Sk key={i} className="h-8 w-20 rounded-sm" />
        ))}
      </SkRow>
      <SkRow className="gap-3">
        <Sk className="h-10 w-full max-w-sm rounded-pill" />
        <Sk className="h-10 w-10 shrink-0 rounded-full" />
      </SkRow>
      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
        <div className="flex items-center gap-4 border-b border-border-subtle bg-surface-subtle px-4 py-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Sk key={i} className="h-3 w-16 rounded" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3.5 last:border-b-0">
            {Array.from({ length: 8 }).map((_, j) => (
              <Sk key={j} className="h-4 w-16 rounded" />
            ))}
            <Sk className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
      <SkRow className="justify-between">
        <Sk className="h-4 w-40" />
        <SkRow className="gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk key={i} className="h-8 w-8 rounded-sm" />
          ))}
        </SkRow>
      </SkRow>
    </div>
  )
}

export default function SalesJobOrdersLoading() {
  return (
    <div className="p-6 flex flex-col">
      <SalesJobListSkeleton />
    </div>
  )
}
