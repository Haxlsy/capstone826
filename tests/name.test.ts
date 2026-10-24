import { describe, it, expect } from "vitest"
import { joinName, splitFullName, validateFullName } from "@/lib/name"

describe("joinName", () => {
  it("joins and normalizes spacing", () => {
    expect(joinName("  Juan ", " Dela  Cruz ")).toBe("Juan Dela Cruz")
    expect(joinName("Juan", "")).toBe("Juan")
  })
})

describe("splitFullName", () => {
  it("splits a simple name at the last word", () => {
    expect(splitFullName("Maria Santos")).toEqual({ first: "Maria", last: "Santos" })
    expect(splitFullName("Ma. Clara Santos")).toEqual({ first: "Ma. Clara", last: "Santos" })
  })

  it("keeps surname particles with the last name", () => {
    expect(splitFullName("Juan Dela Cruz")).toEqual({ first: "Juan", last: "Dela Cruz" })
    expect(splitFullName("Jose de los Reyes")).toEqual({ first: "Jose", last: "de los Reyes" })
    expect(splitFullName("Ana Mae San Jose")).toEqual({ first: "Ana Mae", last: "San Jose" })
  })

  it("never leaves the first name empty", () => {
    expect(splitFullName("Dela Cruz")).toEqual({ first: "Dela", last: "Cruz" })
  })

  it("treats one word as a first name", () => {
    expect(splitFullName("Juan")).toEqual({ first: "Juan", last: "" })
    expect(splitFullName("")).toEqual({ first: "", last: "" })
    expect(splitFullName(null)).toEqual({ first: "", last: "" })
  })
})

describe("validateFullName", () => {
  it("requires both a first and last name", () => {
    expect(validateFullName("Juan", "Customer name")).toBe("Enter both a first and last name.")
    expect(validateFullName("Juan Dela Cruz", "Customer name")).toBeNull()
  })

  it("keeps the base name rules", () => {
    expect(validateFullName("", "Customer name")).toBe("Customer name is required.")
    expect(validateFullName("Juan 2", "Customer name")).toMatch(/may only contain/)
  })
})
