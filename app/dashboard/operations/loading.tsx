import { Sk, SkRow } from "@/components/ui/skeleton"

export function OperationsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="space-y-2">
        <Sk className="h-7 w-52" />
        <Sk className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-2 border-l-4 border-l-gray-200">
            <Sk className="h-8 w-8 rounded-lg" />
            <Sk className="h-6 w-10" />
            <Sk className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_300px] gap-5">
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <SkRow>
            <Sk className="h-5 w-32" />
            <Sk className="h-5 w-20 ml-auto" />
          </SkRow>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <Sk key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
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
    <div className="flex-1 overflow-y-auto p-6">
      <OperationsSkeleton />
    </div>
  )
}
