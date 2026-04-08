export type Status =
  | "Pending"
  | "Ongoing"
  | "Quality Check"
  | "Completed"
  | "Delayed"
  | "Cancelled"
  | "Released";

export type HeadTechJob = {
  job_id: string;
  raw_id?: number;
  customer_name: string;
  plate_number: string;
  car_make: string;
  car_color: string;
  service: string;
  technician_name: string;
  scheduled_start: string;
  status: Status;
  progress: number;
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
