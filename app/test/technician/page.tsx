import TechnicianOverviewPage from "@/app/dashboard/technician/page"
export default function TestTechnicianPage(){
    return(
        <div>
            <div className="flex h-screen bg-gray-50 overflow-hidden">
                <main className="flex-1 overflow-y-auto">
                    <TechnicianOverviewPage/>
                </main>
            </div>
        </div>
    )
}