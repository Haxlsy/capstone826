"use client"

import { usePathname } from "next/navigation"
import TopBar from "./SalesDashboard/TopBar"
import OperationsTopBar from "./OperationComponents/OperationsTopBar"

const OPERATIONS_PATHS = [
  "/dashboard/operations",
  "/dashboard/job-management",
  "/dashboard/customer-intake-records",
  "/dashboard/concerns",
  "/dashboard/job-order-records",
]

export default function DynamicTopBar() {
  const pathname = usePathname()
  const isOperations = OPERATIONS_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
  return isOperations ? <OperationsTopBar /> : <TopBar />
}
