/**
 * The customer details a job order displays. `job.customer` is the job's
 * VEHICLE record (`customer_record`: plate, vehicle unit) and its `owner` is
 * the person (`customer`: name, phone, email, psid). Live values win; the job's
 * own snapshot columns (`customer_name`, `contact_number`, `plate_number`,
 * `vehicle_unit`) cover a job whose vehicle/customer was deleted or that was
 * created before it had one.
 *
 * The embeds that feed this must be written with the explicit FK hint, because
 * customer_record has two FKs to customer:
 *   customer:customer_record_id(plate_number, vehicle_unit,
 *     owner:customer!customer_id(full_name, contact_number, email))
 */
type One<T> = T | T[] | null | undefined

const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

interface OwnerRow {
  full_name?: string | null
  contact_number?: string | null
  email?: string | null
}

interface VehicleRow {
  plate_number?: string | null
  vehicle_unit?: string | null
  owner?: One<OwnerRow>
}

export interface JobWithCustomer {
  customer_name?: string | null
  contact_number?: string | null
  plate_number?: string | null
  vehicle_unit?: string | null
  customer?: One<VehicleRow>
}

export interface JobCustomer {
  name: string | null
  phone: string | null
  email: string | null
  plate: string | null
  vehicle: string | null
}

export function jobCustomer(job: JobWithCustomer | null | undefined): JobCustomer {
  const vehicle = one(job?.customer)
  const owner = one(vehicle?.owner)
  return {
    name: owner?.full_name ?? job?.customer_name ?? null,
    phone: owner?.contact_number ?? job?.contact_number ?? null,
    email: owner?.email ?? null,
    plate: vehicle?.plate_number ?? job?.plate_number ?? null,
    vehicle: vehicle?.vehicle_unit ?? job?.vehicle_unit ?? null,
  }
}
