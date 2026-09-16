export type Status =
  | "Pending"
  | "Ongoing"
  | "For Rework"
  | "For Release"
  | "Released"
  | "Delayed"
  | "Cancelled";

export type StageGroup = {
  label: string;
  color: string;
  done: number;
  total: number;
};

export type HeadTechJob = {
  job_id: string;
  raw_id?: string;
  customer_name: string;
  plate_number: string;
  car_make: string;
  car_color: string;
  service: string;
  technician_name: string;
  scheduled_start: string;
  status: Status;
  progress: number;
  stage_groups: StageGroup[];
  has_delayed_stage: boolean;
  is_overdue: boolean;
};

// Status colour is now centralised in `lib/ui/status.ts` — use `<StatusBadge>`.
