import AdminSidebar from "@/components/AdminSide/AdminSidebar"
import AdminTopBar from "@/components/AdminSide/AdminTopBar"
import Link from "next/link"

export default function TestAdminPage() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminTopBar />
        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-colors w-fit"
          >
            Admin Button
          </Link>
          <Link
            href="/dashboard/admin/accounts"
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors w-fit"
          >
            Account Management
          </Link>
          <Link
            href="/dashboard/admin/services"
            className="inline-flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors w-fit"
          >
            Service Management
          </Link>
        </main>
      </div>
    </div>
  )
}
