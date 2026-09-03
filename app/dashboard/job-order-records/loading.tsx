import { Sk, SkRow } from "@/components/ui/skeleton"

export function JobOrderRecordsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <div className="space-y-1.5">
        <SkRow>
          <Sk className="h-8 w-36" />
          <Sk className="h-6 w-28 rounded-pill" />
        </SkRow>
        <Sk className="h-4 w-52" />
      </div>
      <div className="rounded-card border border-border-subtle bg-surface p-5">
        <SkRow className="flex-wrap gap-4">
          <Sk className="h-10 w-36 rounded-sm" />
          <Sk className="h-10 w-36 rounded-sm" />
          <Sk className="h-10 w-44 rounded-sm" />
          <Sk className="h-10 w-28 rounded-pill" />
        </SkRow>
      </div>
      <SkRow className="justify-between">
        <Sk className="h-11 w-64 rounded-pill" />
        <SkRow className="gap-2">
          <Sk className="h-10 w-28 rounded-pill" />
          <Sk className="h-10 w-32 rounded-pill" />
        </SkRow>
      </SkRow>
      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
        <div className="flex items-center gap-4 border-b border-border-subtle bg-surface-subtle px-4 py-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Sk key={i} className="h-3 w-20 rounded" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3.5 last:border-b-0">
            {Array.from({ length: 8 }).map((_, j) => (
              <Sk key={j} className="h-4 w-20 rounded" />
            ))}
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

export default function JobOrderRecordsLoading() {
  return (
    <div className="p-6">
      <JobOrderRecordsSkeleton />
    </div>
  )
}
