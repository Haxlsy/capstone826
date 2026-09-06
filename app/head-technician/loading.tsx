import { Sk, SkRow } from "@/components/ui/skeleton"

export default function HeadTechnicianLoading() {
  return (
    <main className="px-4 pt-6 pb-28 max-w-md mx-auto space-y-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div>
          <SkRow className="gap-2 mb-2">
            <Sk className="w-6 h-6 rounded-md" />
            <Sk className="h-3 w-24" />
          </SkRow>
          <Sk className="h-6 w-40" />
        </div>
        <Sk className="h-11 w-11 rounded-card" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk key={i} className="h-16 rounded-card" />
        ))}
      </div>

      <Sk className="h-10 w-full rounded-card" />

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-card border border-border-subtle p-4 space-y-3">
            <SkRow className="justify-between">
              <Sk className="h-4 w-32" />
              <Sk className="h-5 w-16 rounded-full" />
            </SkRow>
            <Sk className="h-3 w-24" />
            <Sk className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </main>
  )
}
