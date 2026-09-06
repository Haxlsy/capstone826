import { normalizePhone } from "@/lib/phone"

export interface CustomerGroup<T> {
  key: string
  vehicles: T[]
  /** The record to show in the group header — whichever holds the psid, else the first. */
  primary: T
}

/**
 * Groups vehicle records into one entry per customer, by normalized phone
 * number — the same correlation the Messenger status flow already uses to
 * find a customer's other vehicles, since only one row can ever hold a given
 * psid. Shared by Customer Records (the original) and the Link Messenger
 * Account combobox, so a customer with multiple vehicles is presented the
 * same way — one header, one row per vehicle — in both places.
 */
export function groupByCustomer<T>(
  records: T[],
  getId: (r: T) => string,
  getContact: (r: T) => string,
  getPsid: (r: T) => string | null,
): CustomerGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const r of records) {
    const key = normalizePhone(getContact(r)) || `unknown:${getId(r)}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  return [...map.entries()].map(([key, vehicles]) => ({
    key,
    vehicles,
    primary: vehicles.find((v) => getPsid(v)) ?? vehicles[0],
  }))
}
