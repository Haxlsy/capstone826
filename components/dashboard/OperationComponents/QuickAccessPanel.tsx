"use client"

const pendingIntakes = [
  {
    name: "Maria Garcia",
    date: "Mar 30, 2026",
    plate: "XYZ 5678",
    service: "Engine Tune-Up",
    bookDate: "Apr 3, 2026",
  },
  {
    name: "Patricia Lim",
    date: "Mar 29, 2026",
    plate: "MNO 1234",
    service: "AC Repair",
    bookDate: "Apr 2, 2026",
  },
  {
    name: "Isabelle Navarro",
    date: "Mar 31, 2026",
    plate: "YZA 7890",
    service: "Brake Replacement",
    bookDate: "Apr 3, 2026",
  },
]

type StatusKey = "Ongoing" | "Quality Check" | "Pending"

const recentJobOrders: { id: string; customer: string; status: StatusKey }[] = [
  { id: "JO-2026-0412", customer: "Ricardo Santos", status: "Ongoing" },
  { id: "JO-2026-0411", customer: "Maria Cruz", status: "Quality Check" },
  { id: "JO-2026-0410", customer: "Carlos Dela Cruz", status: "Pending" },
]

const statusBadgeMap: Record<StatusKey, string> = {
  Ongoing: "bg-blue-100 text-blue-700",
  "Quality Check": "bg-orange-100 text-orange-700",
  Pending: "bg-amber-100 text-amber-700",
}

export default function QuickAccessPanel() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-4">
      {/* Section 1: Pending Intakes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm text-gray-800">Pending Intakes</span>
          <button className="text-xs text-blue-500 hover:text-blue-600 transition-colors">View All →</button>
        </div>
        <div className="flex flex-col">
          {pendingIntakes.map((item, idx) => (
            <div
              key={idx}
              className={`py-2.5 ${idx < pendingIntakes.length - 1 ? "border-b border-gray-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                <span className="text-xs text-gray-400">{item.date}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.plate} · {item.service}
              </p>
              <p className="text-xs text-amber-500 mt-0.5">Book: {item.bookDate}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Section 2: Recent Job Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm text-gray-800">Recent Job Orders</span>
          <button className="text-xs text-blue-500 hover:text-blue-600 transition-colors">View All →</button>
        </div>
        <div className="flex flex-col">
          {recentJobOrders.map((item, idx) => (
            <div
              key={idx}
              className={`py-2.5 flex items-center justify-between ${
                idx < recentJobOrders.length - 1 ? "border-b border-gray-50" : ""
              }`}
            >
              <div>
                <p className="text-xs text-gray-500 font-mono">{item.id}</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{item.customer}</p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeMap[item.status]}`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
