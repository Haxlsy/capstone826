import { Sk, SkRow } from "@/components/ui/skeleton"

// The card-list rows only — reused by CustomerRecords.tsx for its own
// loading state (every search re-fetch, not just the first load), where the
// page header + search bar stay live and only this part skeletons.
export function CustomerRecordsListSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Sk className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Sk className="h-4 w-36" />
              <Sk className="h-3 w-24" />
            </div>
            <Sk className="h-3 w-16 shrink-0" />
          </div>
          <div className="border-t border-border-subtle px-5 py-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <SkRow className="min-w-[160px]">
                <Sk className="h-3.5 w-3.5 rounded-full" />
                <Sk className="h-4 w-28" />
              </SkRow>
              <SkRow className="min-w-[160px]">
                <Sk className="h-3.5 w-3.5 rounded-full" />
                <Sk className="h-4 w-28" />
              </SkRow>
              <SkRow className="min-w-[180px]">
                <Sk className="h-3.5 w-3.5 rounded-full" />
                <Sk className="h-4 w-32" />
              </SkRow>
              <Sk className="h-3 w-16" />
              <Sk className="ml-auto h-7 w-16 rounded-sm" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Full-page skeleton — the route's loading.tsx fallback for the very first
// navigation in, before the client bundle mounts.
export function CustomerRecordsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <div className="space-y-1.5">
        <Sk className="h-7 w-48" />
        <Sk className="h-4 w-72" />
      </div>
      <Sk className="h-10 w-full max-w-sm rounded-pill" />
      <CustomerRecordsListSkeleton />
    </div>
  )
}

export default function CustomerRecordsLoading() {
  return (
    <div className="p-6">
      <CustomerRecordsSkeleton />
    </div>
  )
}
