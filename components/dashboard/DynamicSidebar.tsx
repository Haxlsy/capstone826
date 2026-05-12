"use client"

import { usePathname } from "next/navigation"
import Sidebar from "./SalesDashboard/Sidebar"
import OperationsSidebar from "./OperationComponents/OperationsSidebar"
import AdminSidebar from "@/components/AdminSide/AdminSidebar"


//Dynamic Sidebar
const OPERATIONS_PATHS = [
  "/dashboard/operations",
  "/dashboard/job-management",
  "/dashboard/concerns",
  "/dashboard/job-order-records",
  "/dashboard/technician-availability",
  "/dashboard/services",
  "/dashboard/operations/settings",
]

const ADMIN_PATHS = ["/dashboard/admin"]

export default function DynamicSidebar() {
  const pathname = usePathname()

  const isOperations = OPERATIONS_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
  const isAdmin = ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )

  if (isAdmin) return <AdminSidebar />
  return isOperations ? <OperationsSidebar /> : <Sidebar />
}
