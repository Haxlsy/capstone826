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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface p-4">
            <Sk className="h-8 w-8 rounded-sm" />
            <Sk className="h-6 w-10" />
            <Sk className="h-3 w-20" />
          </div>
        ))}
      </div>
      <SkRow className="gap-3">
        <Sk className="h-11 w-64 rounded-pill" />
        <Sk className="h-10 w-24 rounded-pill" />
      </SkRow>
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="overflow-hidden rounded-card border border-border-subtle bg-surface">
          <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-3.5">
            <Sk className="h-5 w-20 rounded-full" />
            <Sk className="h-4 w-32" />
          </div>
          {Array.from({ length: g === 0 ? 3 : 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border-subtle px-5 py-3.5 last:border-b-0">
              <Sk className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Sk className="h-4 w-32" />
                <SkRow className="gap-2">
                  <Sk className="h-3 w-16" />
                  <Sk className="h-3 w-20" />
                </SkRow>
                <SkRow className="mt-1 gap-0.5">
                  {Array.from({ length: 7 }).map((_, d) => (
                    <Sk key={d} className="h-5 w-6 rounded-sm" />
                  ))}
                </SkRow>
              </div>
              <SkRow className="gap-2">
                <Sk className="h-8 w-8 rounded-full" />
                <Sk className="h-8 w-8 rounded-full" />
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
    <div className="p-6">
      <TechnicianAvailabilitySkeleton />
    </div>
  )
}
