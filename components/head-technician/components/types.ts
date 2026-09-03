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
};

export const STATUS_STYLES: Record<Status, string> = {
  Pending:       "bg-status-warning/12 text-status-warning",
  Ongoing:       "bg-primary/12 text-primary",
  "For Rework":  "bg-status-rework/12 text-status-rework",
  "For Release": "bg-status-inspection/12 text-status-inspection",
  Released:      "bg-status-release/12 text-status-release",
  Delayed:       "bg-status-delayed/12 text-status-delayed",
  Cancelled:     "bg-surface-muted text-body",
};
