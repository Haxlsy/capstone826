import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { getHeadTechnicianJobs } from "@/lib/head-technician/jobs-data"
import HeadTechnicianPage from "@/components/head-technician/HeadTechnicianPage";

export default async function HeadTechnicianRoute() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="pb-16">
        <HeadTechnicianPage initialJobs={[]} displayName="" />
      </div>
    )
  }

  const { jobs, displayName } = await getHeadTechnicianJobs(user.id)

  return (
    <div className="pb-16">
      <HeadTechnicianPage initialJobs={jobs} displayName={displayName} />
    </div>
  );
}
