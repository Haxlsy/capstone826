import { Sk, SkRow } from "@/components/ui/skeleton"

export function JobManagementSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <SkRow className="justify-between">
        <Sk className="h-8 w-36" />
        <Sk className="h-10 w-36 rounded-pill" />
      </SkRow>
      <Sk className="h-11 w-full max-w-xl rounded-pill" />
      <SkRow className="gap-2 border-b border-border-subtle pb-0">
        {Array.from({ length: 7 }).map((_, i) => (
          <Sk key={i} className="h-8 w-20 rounded-sm" />
        ))}
      </SkRow>
      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
        <div className="flex items-center gap-4 border-b border-border-subtle bg-surface-subtle px-4 py-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Sk key={i} className="h-3 w-20 rounded" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3.5 last:border-b-0">
            {Array.from({ length: 7 }).map((_, j) => (
              <Sk key={j} className="h-4 w-20 rounded" />
            ))}
            <Sk className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
      <SkRow className="justify-between">
        <Sk className="h-4 w-32" />
        <SkRow className="gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk key={i} className="h-8 w-8 rounded-sm" />
          ))}
        </SkRow>
      </SkRow>
    </div>
  )
}

export default function JobManagementLoading() {
  return (
    <div className="flex-1 p-6">
      <JobManagementSkeleton />
    </div>
  )
}
