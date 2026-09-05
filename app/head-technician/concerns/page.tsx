import { Suspense } from "react";
import HeadTechConcernsPage from "@/components/head-technician/HeadTechConcernsPage";

export default function HeadTechConcernsRoute() {
  return (
    <div className="pb-16">
      <Suspense fallback={null}>
        <HeadTechConcernsPage />
      </Suspense>
    </div>
  );
}
