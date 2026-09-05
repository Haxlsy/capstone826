import { z } from "zod"

// =================================================================
// Chatbot settings
// =================================================================

export const botPersonalitySchema = z.enum(["friendly", "formal", "casual"])
export const botLanguageSchema = z.enum(["english", "filipino", "both"])

/**
 * Built-in wording for the "your account isn't linked" vehicle-status reply, used
 * whenever `account_not_linked_message` is blank. Lives here — not in
 * lib/messenger/vehicle.ts — because the admin UI is a client component and
 * vehicle.ts pulls in the service-role Supabase client, which must never reach
 * the browser bundle. vehicle.ts re-exports it for server-side callers.
 */
export const DEFAULT_NOT_LINKED_MESSAGE =
  "Your Messenger account isn't linked to a customer record with us yet, so I can't pull up " +
  "any active job for you.\n\n" +
  "If you'd like to link it, please send your Job Order Code — you'll find it on your receipt " +
  "or booking confirmation (it looks like JO-8X2K9F). Once I recognize it, I can give you your " +
  "vehicle status here anytime."

/**
 * Sent verbatim (no AI) when `enable_ai_chatbot` is off, right before the
 * conversation is handed to staff. Lives here so the admin client component can
 * use it without importing server-only Messenger code.
 */
export const DEFAULT_AI_DISABLED_MESSAGE =
  "Thanks for reaching out to 826 Auto Aesthetic and Protection! Our team will get back to " +
  "you shortly."

/**
 * Persisted chatbot settings. `.passthrough()` is kept so any legacy keys
 * already stored in `chatbot_config.settings` survive a save/load round trip
 * — every zod schema strips unknown keys by default.
 *
 * `enable_ai_chatbot` / `enable_media_validation` are the platform-level master
 * switches; they are typed here (rather than riding along on passthrough) so
 * the runtime can actually read them. Both default to true so an existing row
 * saved before they were typed keeps working.
 */
export const chatbotSettingsSchema = z.object({
  personality:             botPersonalitySchema,
  enable_ai_chatbot:       z.boolean().default(true),
  enable_media_validation: z.boolean().default(true),
  ai_disabled_message:     z.string().max(2000).default(DEFAULT_AI_DISABLED_MESSAGE),
  enable_services:         z.boolean(),
  enable_booking:          z.boolean(),
  enable_status:           z.boolean(),
  enable_faq:              z.boolean(),
  booking_message:         z.string().max(2000),
  notify_sales:            z.boolean(),
  language:                botLanguageSchema,
  escalation_rules:        z.array(z.string()).default([]),
  // Sent verbatim (no AI) when an unlinked Messenger account asks for vehicle
  // status. Blank falls back to DEFAULT_NOT_LINKED_MESSAGE in lib/messenger/vehicle.ts.
  // Replaces the old `vehicle_status_template`, which was injected into the system
  // prompt for the model to "send" — it reworded it and invented lookup results.
  // Any stored value for the old key is retained harmlessly by .passthrough().
  account_not_linked_message: z.string().max(2000),
}).passthrough()

export type ChatbotSettings = z.infer<typeof chatbotSettingsSchema>

// =================================================================
// Knowledge base
// =================================================================

export const kbCategorySchema = z.enum(["Service", "Pricing", "Hours", "FAQ", "Other"])
export type KBCategory = z.infer<typeof kbCategorySchema>

export const KB_CATEGORIES = kbCategorySchema.options as KBCategory[]

export const KB_CATEGORY_COLORS: Record<KBCategory, string> = {
  Service: "bg-blue-50 text-blue-600 border-blue-200",
  Pricing: "bg-green-50 text-green-600 border-green-200",
  Hours:   "bg-orange-50 text-orange-600 border-orange-200",
  FAQ:     "bg-purple-50 text-purple-600 border-purple-200",
  Other:   "bg-gray-100 text-gray-500 border-gray-200",
}

export const kbEntrySchema = z.object({
  id:         z.string(),
  category:   kbCategorySchema,
  topic:      z.string(),
  content:    z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type KBEntry = z.infer<typeof kbEntrySchema>

export const kbCreateSchema = z.object({
  topic:    z.string().trim().min(1, "Topic is required.").max(255),
  content:  z.string().min(1, "Content is required.").max(10000),
  category: kbCategorySchema.default("FAQ"),
})
export type KBEntryCreate = z.infer<typeof kbCreateSchema>

export const kbUpdateSchema = z
  .object({
    topic:    z.string().trim().min(1, "Topic is required.").max(255).optional(),
    content:  z.string().min(1, "Content is required.").max(10000).optional(),
    category: kbCategorySchema.optional(),
  })
  .refine((v) => v.topic !== undefined || v.content !== undefined || v.category !== undefined, {
    message: "Nothing to update.",
  })
export type KBEntryUpdate = z.infer<typeof kbUpdateSchema>

// =================================================================
// Messenger conversation / reply
// =================================================================

export const chatMessageSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string(),
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

export const customerDetailsSchema = z.object({
  full_name:      z.string().nullable(),
  contact_number: z.string().nullable(),
  plate_number:   z.string().nullable(),
  vehicle_unit:   z.string().nullable(),
  email:          z.string().nullable(),
})
export type CustomerDetails = z.infer<typeof customerDetailsSchema>

export const chatbotReplySchema = z.object({
  reply:     z.string(),
  escalate:  z.boolean(),
  reason:    z.string().nullable().optional(),
  violation: z.enum(["none", "off_topic", "policy"]).optional(),
  customer:  customerDetailsSchema.nullable().optional(),
})
export type ChatbotReply = z.infer<typeof chatbotReplySchema>