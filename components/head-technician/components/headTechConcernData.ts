export type HeadTechConcernStatus = "Unresolved" | "Resolved";

export type HeadTechConcern = {
  id: string;
  job_id: string;
  technician_name: string;
  concern_type: string;
  description: string;
  attachments: number;
  timestamp: string;
  status: HeadTechConcernStatus;
};

export const HEAD_TECH_CONCERN_STATUS_STYLES: Record<HeadTechConcernStatus, string> = {
  Unresolved: "bg-red-100 text-red-500",
  Resolved: "bg-green-100 text-green-600",
};

export const HEAD_TECH_CONCERN_TYPE_STYLES: Record<string, string> = {
  "Material Issue": "bg-red-100 text-red-500",
  "Equipment Problem": "bg-orange-100 text-orange-500",
  "Rework Needed": "bg-purple-100 text-purple-600",
  "Safety Issue": "bg-yellow-100 text-yellow-700",
  "Customer Request": "bg-blue-100 text-blue-600",
  Other: "bg-gray-100 text-gray-600",
};

export const HEAD_TECH_CONCERNS: HeadTechConcern[] = [
  {
    id: "HTC-001",
    job_id: "JO-2026-008",
    technician_name: "Mark Santos",
    concern_type: "Material Issue",
    description:
      "The PPF material has visible defects on the surface that appeared after application.",
    attachments: 2,
    timestamp: "Apr 1, 9:15 AM",
    status: "Unresolved",
  },
  {
    id: "HTC-002",
    job_id: "JO-2026-005",
    technician_name: "Pedro Lim",
    concern_type: "Equipment Problem",
    description:
      "Heat gun stopped working during film application. Need replacement.",
    attachments: 1,
    timestamp: "Apr 1, 8:30 AM",
    status: "Unresolved",
  },
  {
    id: "HTC-003",
    job_id: "JO-2026-003",
    technician_name: "Rosa Aquino",
    concern_type: "Rework Needed",
    description:
      "Customer reported bubbling on the rear window tint after inspection.",
    attachments: 3,
    timestamp: "Mar 31, 3:45 PM",
    status: "Resolved",
  },
  {
    id: "HTC-004",
    job_id: "JO-2026-010",
    technician_name: "David Cruz",
    concern_type: "Material Issue",
    description:
      "Received incorrect ceramic coating grade for the scheduled service.",
    attachments: 1,
    timestamp: "Mar 31, 10:00 AM",
    status: "Resolved",
  },
];
