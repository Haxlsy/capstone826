import { Sk, SkRow } from "@/components/ui/skeleton"

export default function SalesJobDetailLoading() {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl flex flex-col gap-6 animate-pulse">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <SkRow className="gap-1.5 mb-2">
              <Sk className="h-4 w-4" />
              <Sk className="h-3 w-32" />
            </SkRow>
            <Sk className="h-6 w-40" />
          </div>
          <Sk className="h-7 w-24 rounded-full mt-6" />
        </div>

        {/* Read-only notice */}
        <Sk className="h-9 w-full rounded-card" />

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border-subtle rounded-card p-4 flex flex-col gap-3">
              <Sk className="h-3 w-20" />
              {Array.from({ length: 4 }).map((_, j) => (
                <SkRow key={j} className="justify-between">
                  <Sk className="h-3 w-14" />
                  <Sk className="h-3 w-24" />
                </SkRow>
              ))}
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className="bg-surface border border-border-subtle rounded-card p-4 flex flex-col gap-2">
          <SkRow className="justify-between">
            <Sk className="h-3 w-28" />
            <Sk className="h-3 w-24" />
          </SkRow>
          <Sk className="h-2 w-full rounded-full" />
        </div>

        {/* Stages */}
        <div className="flex flex-col gap-3">
          <Sk className="h-3 w-32" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border border-border-subtle rounded-card overflow-hidden">
              <Sk className="h-11 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
