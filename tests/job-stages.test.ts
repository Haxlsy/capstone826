import { describe, it, expect } from "vitest"
import { buildStageCatalog, resolveJobStage } from "@/lib/job-stages"

// The catalogue behind job JO-BE4FV7: one template stage in the "Detailer"
// category, plus two categories that differ only by letter case.
const catalog = buildStageCatalog(
  [{ id: "tpl-detailer", name: "Detailer Stage", sequence_order: 1, stage_duration_mins: 1, category_id: "cat-detailer" }],
  [
    { id: "cat-prep-lower", name: "preparation", technician_role: "detailer", display_color: "blue" },
    { id: "cat-prep", name: "Preparation", technician_role: "detailer", display_color: "blue" },
    { id: "cat-detailer", name: "Detailer", technician_role: "detailer", display_color: "rose" },
    { id: "cat-installer", name: "Installer", technician_role: "installer", display_color: "teal" },
  ],
)

describe("resolveJobStage", () => {
  it("uses the template when the job has no overrides", () => {
    const r = resolveJobStage({ service_stage_id: "tpl-detailer" }, catalog)
    expect(r.name).toBe("Detailer Stage")
    expect(r.sequence_order).toBe(1)
    expect(r.category?.name).toBe("Detailer")
    expect(r.template_duration_mins).toBe(1)
  })

  it("JO-BE4FV7: a renamed template stage keeps its category and takes the job's name", () => {
    const r = resolveJobStage(
      { service_stage_id: "tpl-detailer", custom_name: "Car Wash", custom_sequence_order: 1, custom_stage_category: null },
      catalog,
    )
    expect(r.name).toBe("Car Wash")
    expect(r.sequence_order).toBe(1)
    expect(r.category?.id).toBe("cat-detailer")
  })

  it("JO-BE4FV7: a stage added for the job resolves its name, order and named category", () => {
    const r = resolveJobStage(
      { service_stage_id: null, custom_name: "Car Dry", custom_sequence_order: 2, custom_stage_category: "Detailer" },
      catalog,
    )
    // Never the old fallbacks: "Stage", order 0, category "preparation".
    expect(r.name).toBe("Car Dry")
    expect(r.sequence_order).toBe(2)
    expect(r.category?.id).toBe("cat-detailer")
    expect(r.category?.technician_role).toBe("detailer")
  })

  it("lets the job's order override the template's", () => {
    const r = resolveJobStage({ service_stage_id: "tpl-detailer", custom_sequence_order: 3 }, catalog)
    expect(r.sequence_order).toBe(3)
  })

  it("matches a named category exactly first, then ignoring case", () => {
    expect(resolveJobStage({ service_stage_id: null, custom_stage_category: "Preparation" }, catalog).category?.id).toBe("cat-prep")
    expect(resolveJobStage({ service_stage_id: null, custom_stage_category: "preparation" }, catalog).category?.id).toBe("cat-prep-lower")
    expect(resolveJobStage({ service_stage_id: null, custom_stage_category: " INSTALLER " }, catalog).category?.id).toBe("cat-installer")
  })

  it("does not invent a category, name or order that is not there", () => {
    const unknown = resolveJobStage({ service_stage_id: null, custom_name: "Extra", custom_stage_category: "Nope" }, catalog)
    expect(unknown.category).toBeNull()
    const bare = resolveJobStage({ service_stage_id: null }, catalog)
    expect(bare).toEqual({ name: null, sequence_order: null, category: null, template_duration_mins: null })
    const missingTemplate = resolveJobStage({ service_stage_id: "gone" }, catalog)
    expect(missingTemplate.name).toBeNull()
  })
})
