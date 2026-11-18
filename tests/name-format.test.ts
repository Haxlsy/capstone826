import { describe, it, expect } from "vitest"
import { formatPersonName, formatPersonNameOrNull, formatServiceName, validateFullName } from "@/lib/name"

describe("formatPersonName", () => {
  it.each([
    ["CHRISTOPHER MORLA", "Christopher Morla"],
    ["christopher morla", "Christopher Morla"],
    ["juan dela cruz", "Juan Dela Cruz"],
    ["MA CLARA A SANTOS JR", "Ma. Clara A. Santos Jr."],
    ["ma. clara santos jr.", "Ma. Clara Santos Jr."],
    ["Ma Clara Santos Jr", "Ma. Clara Santos Jr."],
    ["jose rizal iii", "Jose Rizal III"],
    ["PEDRO SANTOS SR", "Pedro Santos Sr."],
    ["MARY-JANE O'BRIEN", "Mary-Jane O'Brien"],
    ["MCDONALD REYES", "McDonald Reyes"],
    ["Douglas McArthur", "Douglas McArthur"],
    ["maria  DE LOS   santos", "Maria De Los Santos"],
    ["José Ñuñez", "José Ñuñez"],
    ["JOSÉ ÑUÑEZ", "José Ñuñez"],
  ])("%s → %s", (input, expected) => {
    expect(formatPersonName(input)).toBe(expected)
  })

  it("keeps the result valid for the name validators", () => {
    for (const name of ["MA CLARA A SANTOS JR", "mary-jane o'brien", "jose rizal iii"]) {
      expect(validateFullName(formatPersonName(name))).toBeNull()
    }
  })

  it("returns null for empty optional names", () => {
    expect(formatPersonNameOrNull("   ")).toBeNull()
    expect(formatPersonNameOrNull(null)).toBeNull()
    expect(formatPersonNameOrNull("ana cruz")).toBe("Ana Cruz")
  })
})

describe("formatServiceName", () => {
  it.each([
    ["CERAMIC COATING", "Ceramic Coating"],
    ["full body ppf", "Full Body PPF"],
    ["F1 Mod - Installer Stage", "F1 Mod - Installer Stage"],
    ["WASH AND WAX", "Wash and Wax"],
    ["and more", "And More"],
    ["9H GRAPHENE COATING", "9H Graphene Coating"],
    ["suv  interior   detailing", "SUV Interior Detailing"],
  ])("%s → %s", (input, expected) => {
    expect(formatServiceName(input)).toBe(expected)
  })
})
