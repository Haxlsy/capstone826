"use client"

import React, { useState, useEffect } from "react"
import NewIntakeModal, { type NewIntakeForm } from "./components/NewIntakeModal"
import IntakeFilters from "./components/IntakeFilters"
import IntakeTable from "./components/IntakeTable"
import IntakePagination from "./components/IntakePagination"
import { type IntakeRecord, type TabFilter } from "./types"
import { mapApiIntake } from "./utils"


const PAGE_SIZE_OPTIONS = [10, 15, 20]

export default React.memo(function CustomerIntake() {
  const [records, setRecords] = useState<IntakeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [tab, setTab] = useState<TabFilter>("All")
  const [search, setSearch] = useState("")
  const [pageSize, setPageSize] = useState(15)
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)

  // Load intakes and services
  useEffect(() => {
    const abortController = new AbortController()
    
    async function load() {
      setLoading(true)
      try {
        const [intakesRes, servicesRes] = await Promise.all([
          fetch("/api/sales/intakes", { signal: abortController.signal }),
          fetch("/api/sales/services", { signal: abortController.signal }),
        ])
        const [intakesJson, servicesJson] = await Promise.all([intakesRes.json(), servicesRes.json()])
        if (intakesRes.ok) setRecords((intakesJson.intakes ?? []).map(mapApiIntake))
        if (servicesRes.ok) setServiceTypes((servicesJson.services ?? []).map((s: any) => s.service_name))
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          // Handle errors silently for now
        }
      } finally {
        setLoading(false)
      }
    }
    load()
    
    return () => abortController.abort()
  }, [])

  // Filter records based on tab and search
  const filtered = records.filter((r) => {
    const matchTab = tab === "All" || r.status === tab
    const q = search.toLowerCase()
    const matchSearch =
      r.customerName.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.plate.toLowerCase().includes(q) ||
      r.vehicle.toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  // Handle cancellation
  async function handleCancel(id: string) {
    const record = records.find((r) => r.id === id)
    if (record?.intakeId) {
      try {
        await fetch(`/api/sales/intakes/${record.intakeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        })
      } catch {
        // Optimistic update regardless
      }
    }
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, status: "Cancelled" } : r))
  }

  // Handle new intake submission — returns error string on failure, null on success
  async function handleNewIntake(form: NewIntakeForm): Promise<string | null> {
    try {
      const res = await fetch("/api/sales/create-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.customerName,
          contact_number: form.contactNumber,
          email: form.email,
          home_address: form.address,
          plate_number: form.plate,
          make: form.make,
          model: form.model,
          color: form.color,
          service_name: form.serviceType,
          vehicle_type_id: form.vehicleTypeId ? Number(form.vehicleTypeId) : null,
          downpayment: form.downpayment ? Number(form.downpayment) : 0,
          balance: form.balance ? Number(form.balance) : 0,
          payment_method: form.paymentMethod,
          scheduled_date: form.scheduledDate || null,
          status: "pending",
        }),
      })
      const json = await res.json()
      if (res.ok && json.intake) {
        setRecords((prev) => [mapApiIntake(json.intake), ...prev])
        setShowModal(false)
        setPage(1)
        return null
      }
      return json.error ?? "Failed to save intake. Please try again."
    } catch {
      return "Network error. Please check your connection and try again."
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-start justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Customer Intake</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors shrink-0"
        >
          + New Intake
        </button>
      </div>

      {/* Search + Filter + Tabs */}
      <IntakeFilters
        search={search}
        tab={tab}
        onSearchChange={(s) => { setSearch(s); setPage(1) }}
        onTabChange={(t) => { setTab(t); setPage(1) }}
      />

      {/* Table */}
      <IntakeTable records={paginated} loading={loading} onCancel={handleCancel} />

      {/* Pagination */}
      <IntakePagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />

      {showModal && (
        <NewIntakeModal
          onClose={() => setShowModal(false)}
          onSave={handleNewIntake}
          serviceTypes={serviceTypes}
        />
      )}
    </div>
  )
})