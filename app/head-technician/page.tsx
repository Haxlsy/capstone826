import { getCurrentUser } from "@/lib/auth/guard"
import { getHeadTechnicianJobs } from "@/lib/head-technician/jobs-data"
import HeadTechnicianPage from "@/components/head-technician/HeadTechnicianPage";

export default async function HeadTechnicianRoute() {
  // Reuses the same cache()-wrapped lookup requireRole() already makes in
  // the layout for this request — one fewer auth round-trip per navigation.
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="pb-16">
        <HeadTechnicianPage initialJobs={[]} initialUserRole="" displayName="" />
      </div>
    )
  }

  const { jobs, userRole, displayName } = await getHeadTechnicianJobs(user.id)

  return (
    <div className="pb-16">
      <HeadTechnicianPage initialJobs={jobs} initialUserRole={userRole} displayName={displayName} />
    </div>
  );
}
