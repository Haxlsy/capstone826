"use client"

import { usePathname } from "next/navigation"
import Sidebar from "./SalesDashboard/Sidebar"
import OperationsSidebar from "./OperationComponents/OperationsSidebar"

const OPERATIONS_PATHS = [
  "/dashboard/operations",
  "/dashboard/job-management",
  "/dashboard/customer-intake-records",
  "/dashboard/concerns",
  "/dashboard/job-order-records",
]

export default function DynamicSidebar() {
  const pathname = usePathname()
  const isOperations = OPERATIONS_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
  return isOperations ? <OperationsSidebar /> : <Sidebar />
}
