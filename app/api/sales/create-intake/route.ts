import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getAuditCaller, getRoleCaller } from "@/lib/auth/caller";
import { logAuditCall } from "@/hooks/audit-helpers";



function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Zod validation for intake schema submission
 * 
 * This schema will validate the incoming data from the sales intake before it can be process or stored in the database. 
 * This include the validation for personal information of the customer
 * 
 * @example
 * // Valid data
 * const validData = {
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   email: 'john@example.com',
 *   phone: '+1234567890',
 *   dateOfBirth: '1990-01-15',
 *   services: ['consulting', 'support'],
 *   agreeToTerms: true
 * };
 * 
 * const result = CreateIntakeSchema.safeParse(validData);
 * console.log(result.success); // true
 * 
 * @returns 
 */
/*TODO: I will double check this with my team and decide if i should record the downpayment, balance, and payment method. */
const CreateIntakeSchema = z.object({
  customer_id:    z.string().uuid().optional().nullable(),
  full_name:      z.string().trim().min(1, "Customer full name required.").max(255),
  contact_number: z.string().trim().min(1, "Contact number required.").max(20),
  email:          z.email({ message: "Valid email required." }).optional().nullable(),
  home_address:   z.string().trim().max(500).optional().nullable(),
  plate_number:   z.string().trim().min(1, "Plate number required.").max(20),
  make:           z.string().optional().nullable(),
  model:          z.string().optional().nullable(),
  color:          z.string().optional().nullable(),
  service_id:     z.string().uuid().optional().nullable(),
  service_name:   z.string().optional().nullable(),
  vehicle_type_id: z.string().uuid().optional().nullable(),
  downpayment:    z.number().nonnegative().optional(),
  balance:        z.number().nonnegative().optional(),
  payment_method: z.string().optional().nullable(),
  scheduled_date: z.string().optional().nullable(),
  status:         z.string().optional(),
})

const INTAKE_SELECT = `
  intake_id, plate_number, make, model, color,
  downpayment, balance, payment_method, scheduled_date, status, created_at,
  vehicle_type_id,
  customer:customer_id(full_name, customer_id, contact_number, email, home_address),
  service:service_id(service_name, service_id, estimated_duration_days),
  vehicle_type:vehicle_type_id(vehicle_type_id, type_name)
`;

export async function POST(request: Request) {
  try {
    const auth = await getRoleCaller(["sales"]);
    if ("error" in auth) return auth.error;

    const body = await request.json();

    const parsed = CreateIntakeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const {
      customer_id,
      full_name,
      contact_number,
      email,
      home_address,
      plate_number,
      make,
      model,
      color,
      service_id,
      service_name,
      vehicle_type_id,
      downpayment,
      balance,
      payment_method,
      scheduled_date,
      status,
    } = parsed.data;

    // Cross-field check: a service type (id or name) is required
    if (!service_id && !service_name?.trim()) return NextResponse.json({ error: "Service type is required." }, { status: 400 });

    const admin = getAdmin()

    let custId = customer_id ?? null;
    let customerRow: any = null;

    // Resolve or create customer — deduplicate by contact_number
    if (!custId) {
      const { data: existing } = await admin
        .from("customer")
        .select("customer_id, full_name, contact_number, email, home_address")
        .eq("contact_number", contact_number.trim())
        .maybeSingle();

      if (existing) {
        custId = existing.customer_id;
        customerRow = existing;
      } else {
        const insertRes = await admin
          .from("customer")
          .insert({
            full_name: full_name.trim(),
            contact_number: contact_number.trim(),
            email: email?.trim() || null,
            home_address: home_address?.trim() || null,
          })
          .select()
          .single();

        if (insertRes.error) {
          return NextResponse.json({ error: insertRes.error.message ?? String(insertRes.error) }, { status: 500 });
        }

        customerRow = insertRes.data;
        custId = customerRow.customer_id ?? customerRow.id;
      }
    }

    if (!custId) return NextResponse.json({ error: "Unable to determine customer id." }, { status: 400 });

    // Resolve service id by name if provided
    let resolvedServiceId = service_id ?? null;
    if (!resolvedServiceId && service_name) {
      const svc = await admin.from("service").select("service_id").eq("service_name", service_name).maybeSingle();
      if (svc.error) return NextResponse.json({ error: svc.error.message }, { status: 500 });
      if (svc.data) resolvedServiceId = svc.data.service_id;
    }

    const intakePayload = {
      customer_id: custId,
      plate_number,
      make,
      model,
      color,
      service_id: resolvedServiceId,
      vehicle_type_id: vehicle_type_id ?? null,
      downpayment: downpayment ?? 0,
      balance: balance ?? 0,
      payment_method,
      scheduled_date: scheduled_date ?? null,
      status: status ?? "pending",
    };

    const intakeRes = await admin
      .from("customer_intake")
      .insert(intakePayload)
      .select(INTAKE_SELECT)
      .single();

    if (intakeRes.error) return NextResponse.json({ error: intakeRes.error.message ?? String(intakeRes.error) }, { status: 500 });

    const caller = await getAuditCaller();
    if (caller) {
      logAuditCall(caller, {
        category: "create",
        action:   "Created customer intake",
        target:   `${full_name} — ${plate_number}`,
      });
    }

    return NextResponse.json({ customer: customerRow, intake: intakeRes.data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
