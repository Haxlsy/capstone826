export type Status =
  | "Pending"
  | "Ongoing"
  | "Quality Check"
  | "Completed"
  | "Delayed"
  | "Cancelled"
  | "Released";

export type StageStatus = "completed" | "active" | "pending";

export type Stage = {
  name: string;
  status: StageStatus;
  timestamp?: string;
};

export type Job = {
  job_id: string;
  name: string;
  plate_number: string;
  car_make: string;
  car_color: string;
  service: string;
  scheduled_start: string;
  status: Status;
  progress: number;
  stages_label: string;
  stages: Stage[];
};

export const STATUS_STYLES: Record<Status, string> = {
  Pending: "bg-yellow-100 text-yellow-700",
  Ongoing: "bg-blue-100 text-blue-600",
  "Quality Check": "bg-orange-100 text-orange-600",
  Completed: "bg-green-100 text-green-600",
  Delayed: "bg-red-100 text-red-600",
  Cancelled: "bg-gray-200 text-gray-600",
  Released: "bg-purple-100 text-purple-600",
};
