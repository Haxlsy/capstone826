"use client"

import { usePathname } from "next/navigation"
import TopBar from "./SalesDashboard/TopBar"
import OperationsTopBar from "./OperationComponents/OperationsTopBar"
import AdminTopBar from "@/components/AdminSide/AdminTopBar"

const OPERATIONS_PATHS = [
  "/dashboard/operations",
  "/dashboard/job-management",
  "/dashboard/concerns",
  "/dashboard/job-order-records",
]

const ADMIN_PATHS = ["/dashboard/admin"]

export default function DynamicTopBar() {
  const pathname = usePathname()

  const isOperations = OPERATIONS_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
  const isAdmin = ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )

  if (isAdmin) return <AdminTopBar />
  return isOperations ? <OperationsTopBar /> : <TopBar />
}
