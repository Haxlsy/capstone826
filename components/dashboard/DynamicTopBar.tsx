"use client"

import { usePathname } from "next/navigation"
import TopBar from "./SalesDashboard/TopBar"
import OperationsTopBar from "./OperationComponents/OperationsTopBar"
import AdminTopBar from "@/components/AdminSide/AdminTopBar"

const OPERATIONS_PATHS = [
  "/dashboard/operations",
  "/dashboard/job-management",
  "/dashboard/customer-intake-records",
  "/dashboard/concerns",
  "/dashboard/job-order-records",
]

const ADMIN_PATHS = ["/dashboard/admin"]

// Technician/head-technician render their own header inside the page component
const TECHNICIAN_PATHS = ["/dashboard/technician"]

export default function DynamicTopBar() {
  const pathname = usePathname()

  const isTechnician = TECHNICIAN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
  if (isTechnician) return null

  const isOperations = OPERATIONS_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
  const isAdmin = ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )

  if (isAdmin) return <AdminTopBar />
  return isOperations ? <OperationsTopBar /> : <TopBar />
}
