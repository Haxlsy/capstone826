import { Sk, SkRow } from "@/components/ui/skeleton"

export function OperationsSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="space-y-2">
        <Sk className="h-7 w-52" />
        <Sk className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-card border border-border-subtle border-l-4 border-l-border bg-surface p-4"
          >
            <Sk className="h-8 w-8 rounded-sm" />
            <Sk className="h-6 w-10" />
            <Sk className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4 rounded-card border border-border-subtle bg-surface p-5">
          <SkRow>
            <Sk className="h-5 w-32" />
            <Sk className="ml-auto h-5 w-20" />
          </SkRow>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <Sk key={i} className="h-10 rounded-sm" />
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-card border border-border-subtle bg-surface p-5">
          <Sk className="h-5 w-36" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <Sk className="h-3 w-24" />
                  <Sk className="h-3 w-32" />
                </div>
                <Sk className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OperationsLoading() {
  return (
    <div className="flex-1 p-6">
      <OperationsSkeleton />
    </div>
  )
}
