import { normalizePhone, isPlausibleMobile } from "@/lib/phone"

/**
 * The rules supabase/migrations/20260926000002_customer_table.sql uses to group
 * the old one-row-per-vehicle `customer_record` rows into customers. The SQL
 * is the source of truth; this mirror exists so the rules are unit tested
 * (tests/customer-backfill.test.ts) and reviewable in TypeScript. Keep the two
 * in step.
 */
export interface OldRecord {
  id: string
  full_name: string
  email: string | null
  contact_number: string | null
  psid: string | null
  notify_psid: string | null
  created_at: string
}

export interface PlannedCustomer {
  key: string
  full_name: string
  contact_number: string | null
  email: string | null
  psid: string | null
  recordIds: string[]
}

export interface BackfillPlan {
  customers: PlannedCustomer[]
  /** record id → the customer key it joins */
  customerOf: Map<string, string>
  /** record id → key of the customer who booked it for someone else */
  bookedBy: Map<string, string>
}

export function planCustomers(records: OldRecord[]): BackfillPlan {
  const phone = (r: OldRecord) => normalizePhone(r.contact_number)
  const plausible = (r: OldRecord) => isPlausibleMobile(phone(r))

  const anchors = records.filter((r) => r.psid)
  const anchorByPsid = new Map(anchors.map((a) => [a.psid as string, a]))

  // phone → psid, only when exactly one psid holder has that plausible phone
  const holdersByPhone = new Map<string, string[]>()
  for (const a of anchors) {
    if (!plausible(a)) continue
    holdersByPhone.set(phone(a), [...(holdersByPhone.get(phone(a)) ?? []), a.psid as string])
  }
  const uniquePhoneAnchor = new Map<string, string>()
  for (const [p, psids] of holdersByPhone) if (psids.length === 1) uniquePhoneAnchor.set(p, psids[0])

  const samePersonAsHolder = (r: OldRecord) => {
    const holder = r.notify_psid ? anchorByPsid.get(r.notify_psid) : undefined
    return Boolean(holder && plausible(holder) && phone(holder) === phone(r))
  }

  const customerOf = new Map<string, string>()
  const bookedBy = new Map<string, string>()
  for (const r of records) {
    let key: string
    if (r.psid) key = `psid:${r.psid}`
    else if (r.notify_psid && samePersonAsHolder(r)) key = `psid:${r.notify_psid}`
    else if (!r.notify_psid && plausible(r) && uniquePhoneAnchor.has(phone(r))) key = `psid:${uniquePhoneAnchor.get(phone(r))}`
    else if (plausible(r)) key = `phone:${phone(r)}`
    else key = `rec:${r.id}`
    customerOf.set(r.id, key)
    if (!r.psid && r.notify_psid && !samePersonAsHolder(r)) bookedBy.set(r.id, `psid:${r.notify_psid}`)
  }

  const byKey = new Map<string, OldRecord[]>()
  for (const r of records) {
    const k = customerOf.get(r.id) as string
    byKey.set(k, [...(byKey.get(k) ?? []), r])
  }

  const customers: PlannedCustomer[] = []
  for (const [key, rows] of byKey) {
    // psid holder first, then oldest
    const sorted = [...rows].sort(
      (a, b) =>
        Number(!a.psid) - Number(!b.psid) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    )
    const lead = sorted[0]
    customers.push({
      key,
      full_name: lead.full_name,
      contact_number: plausible(lead) ? phone(lead) : lead.contact_number,
      email: lead.email ?? sorted.find((r) => r.email)?.email ?? null,
      psid: key.startsWith("psid:") ? key.slice(5) : null,
      recordIds: rows.map((r) => r.id),
    })
  }
  return { customers, customerOf, bookedBy }
}
