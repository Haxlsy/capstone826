"use client";

export type Status =
  | "Pending"
  | "Ongoing"
  | "Quality Check"
  | "Completed"
  | "Delayed"
  | "Cancelled"
  | "Released";

export type JobCardProps = {
  job_id: string;
  name: string;
  car_make: string;
  car_model: string;
  service: string;
  scheduled_start: string;
  status: Status;
  progress: number; // 0–100
  stages: string; // e.g. "might be dynamic based on the type of vehicle"
};

export const JobCardView = ({
  job_id,
  name,
  car_make,
  car_model,
  service,
  scheduled_start,
  status,
  progress,
  stages,
}: JobCardProps) => {
  const statusStyles: Record<Status, string> = {
    Pending: "bg-yellow-100 text-yellow-700",
    Ongoing: "bg-blue-100 text-blue-600",
    "Quality Check": "bg-orange-100 text-orange-600",
    Completed: "bg-green-100 text-green-600",
    Delayed: "bg-red-100 text-red-600",
    Cancelled: "bg-gray-200 text-gray-600",
    Released: "bg-purple-100 text-purple-600",
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm transition-all duration-300 hover:shadow-xl space-y-3">
      {/* Top Row */}
      <div className="flex items-center justify-between">
        <p className="font-medium text-sm text-gray-800">{job_id}</p>
        <span
          className={`text-xs px-3 py-1 rounded-full font-medium ${statusStyles[status]}`}
        >
          {status}
        </span>
      </div>

      {/* Name */}
      <p className="font-semibold text-gray-900">{name}</p>

      {/* Car */}
      <p className="text-sm text-gray-500">
        {car_make} — {car_model}
      </p>

      {/* Service */}
      <p className="text-sm text-gray-700">{service}</p>

      {/* Date */}
      <p className="text-xs text-gray-400">{scheduled_start}</p>

      {/* Progress Bar */}
      <div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{stages}</p>
      </div>
    </div>
  );
};