export type ConcernStatus = "Unresolved" | "Resolved";

export type Concern = {
  id: string;
  job_id: string;
  concern_type: string;
  description: string;
  response?: string;
  timestamp: string;
  status: ConcernStatus;
};

export const CONCERN_STATUS_STYLES: Record<ConcernStatus, string> = {
  Unresolved: "bg-red-100 text-red-500",
  Resolved: "bg-green-100 text-green-600",
};

export const CONCERN_TYPE_STYLES: Record<string, string> = {
  "Material Issue": "bg-red-100 text-red-500",
  "Equipment Problem": "bg-orange-100 text-orange-500",
  "Rework Needed": "bg-purple-100 text-purple-600",
  "Safety Issue": "bg-yellow-100 text-yellow-700",
  "Customer Request": "bg-blue-100 text-blue-600",
  Other: "bg-gray-100 text-gray-600",
};

export const CONCERNS: Concern[] = [
  {
    id: "C-001",
    job_id: "JO-2026-011",
    concern_type: "Material Issue",
    description:
      "The ceramic coating solution seems to have an inconsistent texture...",
    timestamp: "Apr 1, 9:30 AM",
    status: "Unresolved",
  },
  {
    id: "C-002",
    job_id: "JO-2026-009",
    concern_type: "Equipment Problem",
    description:
      "Polishing machine overheating after 15 minutes of continuous use.",
    response:
      "New polishing machine has been ordered. Use the backup unit in bay 3.",
    timestamp: "Mar 31, 2:00 PM",
    status: "Resolved",
  },
  {
    id: "C-003",
    job_id: "JO-2026-006",
    concern_type: "Rework Needed",
    description:
      "Minor scratches found on driver side panel during ceramic application.",
    response: "Rework approved. Please redo the driver side panel coating.",
    timestamp: "Mar 30, 11:00 AM",
    status: "Resolved",
  },
  {
    id: "C-004",
    job_id: "JO-2026-003",
    concern_type: "Material Issue",
    description:
      "Received wrong shade of tinting film for the rear windows.",
    response: "Correct shade has been restocked. Please check cabinet B-3.",
    timestamp: "Mar 29, 3:45 PM",
    status: "Resolved",
  },
];
