import { Sk, SkRow } from "@/components/ui/skeleton"

export function HeadTechJobDetailSkeleton() {
  return (
    <main className="max-w-md mx-auto px-4 pb-32 pt-5 space-y-4 animate-pulse">
      <SkRow className="justify-between">
        <Sk className="h-4 w-16" />
        <Sk className="h-3 w-20" />
      </SkRow>

      <Sk className="h-6 w-28 rounded-full" />

      <div className="bg-surface rounded-card border border-border-subtle p-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkRow key={i} className="justify-between">
            <Sk className="h-3 w-20" />
            <Sk className="h-3 w-28" />
          </SkRow>
        ))}
      </div>

      <div className="bg-surface rounded-card border border-border-subtle p-4 space-y-3">
        <Sk className="h-4 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <SkRow key={i} className="gap-3">
            <Sk className="h-6 w-6 rounded-full shrink-0" />
            <Sk className="h-4 flex-1" />
          </SkRow>
        ))}
      </div>
    </main>
  )
}

export default function HeadTechJobDetailLoading() {
  return <HeadTechJobDetailSkeleton />
}
