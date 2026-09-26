import type { createAdminClient } from "@/lib/supabase/admin"
import { normalizePhone, isPlausibleMobile } from "@/lib/phone"

/**
 * Who gets a job's Messenger updates (stage photos, "ready for release", ...).
 *
 * `customer_record.psid` is UNIQUE, so a customer's 2nd vehicle is saved with no
 * psid of its own — and a booking under a different name/number recorded from
 * the same Messenger conversation likewise. Reading only the job's own record
 * therefore silently skipped every vehicle after the first. Order:
 *   1. the record's own psid,
 *   2. `notify_psid` — the Messenger account that made the booking, stored when
 *      the psid was already taken by another record,
 *   3. the psid of another record with the SAME phone number — but only when
 *      that phone is a real mobile and exactly one psid holds it. A shared or
 *      placeholder number with several psids must never guess a recipient.
 */
export function pickRecipientPsid(input: {
  own: string | null | undefined
  notify: string | null | undefined
  siblingPsids: (string | null | undefined)[]
}): string | null {
  if (input.own) return input.own
  if (input.notify) return input.notify
  const distinct = [...new Set(input.siblingPsids.filter((p): p is string => Boolean(p)))]
  return distinct.length === 1 ? distinct[0] : null
}

/**
 * Resolves the recipient for a job's customer record. `ownPsid` is the psid the
 * caller already read from the record (saves a query in the common case).
 * Every lookup degrades to "no recipient" rather than throwing — a missing
 * `notify_psid` column (migration not run yet) must not break sending for
 * customers who do have their own psid.
 */
export async function resolveRecipientPsid(
  admin: ReturnType<typeof createAdminClient>,
  input: { customerRecordId: string | null | undefined; ownPsid?: string | null },
): Promise<string | null> {
  if (input.ownPsid) return input.ownPsid
  if (!input.customerRecordId) return null

  const { data: rec } = await admin
    .from("customer_record")
    .select("psid, contact_number")
    .eq("id", input.customerRecordId)
    .maybeSingle()
  if (!rec) return null
  if (rec.psid) return rec.psid as string

  const { data: notifyRow } = await admin
    .from("customer_record")
    .select("notify_psid")
    .eq("id", input.customerRecordId)
    .maybeSingle()
  const notify = ((notifyRow as { notify_psid?: string | null } | null)?.notify_psid) ?? null

  let siblingPsids: string[] = []
  const phone = normalizePhone(rec.contact_number as string | null)
  if (!notify && isPlausibleMobile(phone)) {
    const { data: siblings } = await admin
      .from("customer_record")
      .select("psid, contact_number")
      .in("contact_number", [...new Set([rec.contact_number as string, phone])])
      .neq("id", input.customerRecordId)
      .not("psid", "is", null)
    siblingPsids = (siblings ?? [])
      .filter((s) => normalizePhone(s.contact_number as string | null) === phone)
      .map((s) => s.psid as string)
  }

  return pickRecipientPsid({ own: null, notify, siblingPsids })
}
