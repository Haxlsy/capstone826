export type Status =
  | "Pending"
  | "Ongoing"
  | "For Rework"
  | "For Release"
  | "Released"
  | "Delayed"
  | "Cancelled";

export type HeadTechJob = {
  job_id: string;
  raw_id?: string;   // UUID for real DB rows, "1"/"2" for mock
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
  Pending:       "bg-yellow-100 text-yellow-700",
  Ongoing:       "bg-blue-100 text-blue-600",
  "For Rework":  "bg-orange-100 text-orange-600",
  "For Release": "bg-green-100 text-green-600",
  Released:      "bg-teal-100 text-teal-600",
  Delayed:       "bg-red-100 text-red-600",
  Cancelled:     "bg-gray-200 text-gray-600",
};
