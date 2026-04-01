"use client"
import { JobCardView } from "./technician_component/JobCardView"
import { JobCardProps } from "./technician_component/JobCardView";
export default function Technician(){
    const jobs:JobCardProps[] = [
  {
    job_id: "JO-2026-012",
    name: "Juan Dela Cruz",
    car_make: "Toyota Fortuner",
    car_model: "White",
    service: "PPF",
    scheduled_start: "Apr 5, 2026, 9:00 AM",
    status: "Pending",
    progress: 0,
    stages: "0 of 5 stages",
  },
  {
    job_id: "JO-2026-011",
    name: "Maria Garcia",
    car_make: "Honda Civic",
    car_model: "Black",
    service: "Ceramic Coating",
    scheduled_start: "Apr 3, 2026, 9:00 AM",
    status: "Ongoing",
    progress: 75,
    stages: "3 of 4 stages",
  },
  {
    job_id: "JO-2026-010",
    name: "Ana Reyes",
    car_make: "Mitsubishi Montero",
    car_model: "White",
    service: "Dash Cam Installation",
    scheduled_start: "Apr 1, 2026, 8:30 AM",
    status: "Ongoing",
    progress: 33,
    stages: "1 of 3 stages",
  },
  {
    job_id: "JO-2026-009",
    name: "Elena Flores",
    car_make: "Nissan Navara",
    car_model: "Gray",
    service: "Ceramic Coating",
    scheduled_start: "Mar 31, 2026, 1:00 PM",
    status: "Quality Check",
    progress: 100,
    stages: "4 of 4 stages",
  },
  {
    job_id: "JO-2026-008",
    name: "Carlos Santos",
    car_make: "Ford Ranger",
    car_model: "Blue",
    service: "Interior Detailing",
    scheduled_start: "Mar 30, 2026, 10:00 AM",
    status: "Completed",
    progress: 100,
    stages: "3 of 3 stages",
  },
  {
    job_id: "JO-2026-007",
    name: "Liza Mendoza",
    car_make: "Hyundai Tucson",
    car_model: "Silver",
    service: "Paint Correction",
    scheduled_start: "Mar 29, 2026, 11:30 AM",
    status: "Delayed",
    progress: 60,
    stages: "2 of 4 stages",
  },
  {
    job_id: "JO-2026-006",
    name: "Mark Bautista",
    car_make: "Kia Sportage",
    car_model: "Black",
    service: "Ceramic Coating",
    scheduled_start: "Mar 28, 2026, 2:00 PM",
    status: "Cancelled",
    progress: 40,
    stages: "1 of 4 stages",
  },
  {
    job_id: "JO-2026-005",
    name: "Angela Cruz",
    car_make: "Mazda CX-5",
    car_model: "Red",
    service: "PPF",
    scheduled_start: "Mar 27, 2026, 9:00 AM",
    status: "Released",
    progress: 100,
    stages: "5 of 5 stages",
  },
];
    return(
        <>
            <main className="px-4 py-4 max-w-md mx-auto">
                <h1 className="text-lg font-semibold">Dashboard</h1>
                <div className="p-3 flex flex-col gap-4">
                {
                    jobs.map((jobs)=>(
                            <JobCardView
                            key={jobs.job_id}
                            job_id={jobs.job_id}
                            name={jobs.name}
                            car_make={jobs.car_make}
                            car_model={jobs.car_model}
                            service={jobs.service}
                            scheduled_start={jobs.scheduled_start}
                            status={jobs.status}
                            progress={jobs.progress}
                            stages={jobs.stages}
                            />
                    ))
                }
                </div>
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3">
                <button>My Jobs</button>
                <button>Concerns</button>
                <button>Profile</button>
            </nav>
        </>
    )
}