import { describe, expect, it } from "vitest"
import { normalizeWaitlistEmail, normalizeWaitlistLocale } from "./signup"

describe("waitlist signup input", () => {
  it("trims and lowercases valid emails", () => {
    expect(normalizeWaitlistEmail("  Ana@Sozu.Capital ")).toBe("ana@sozu.capital")
  })

  it("rejects malformed or oversized emails", () => {
    expect(normalizeWaitlistEmail("")).toBeNull()
    expect(normalizeWaitlistEmail("ana@")).toBeNull()
    expect(normalizeWaitlistEmail("ana sozu@x.com")).toBeNull()
    expect(normalizeWaitlistEmail("ana@x.c")).toBeNull()
    expect(normalizeWaitlistEmail(42)).toBeNull()
    expect(normalizeWaitlistEmail(`${"a".repeat(250)}@x.com`)).toBeNull()
  })

  it("accepts only supported locales", () => {
    expect(normalizeWaitlistLocale("es")).toBe("es")
    expect(normalizeWaitlistLocale("en")).toBe("en")
    expect(normalizeWaitlistLocale("fr")).toBeNull()
  })
})
