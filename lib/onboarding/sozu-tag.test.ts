import { describe, expect, it } from "vitest"
import { sozuTagSuggestions, tagFieldStatus } from "./sozu-tag"

describe("sozuTagSuggestions", () => {
  it("builds the three alternatives from the screenshot", () => {
    expect(sozuTagSuggestions("sol", 2026)).toEqual(["sol_sozu", "sol26", "solwallet"])
  })

  it("keeps the typed casing and stays inside 30 characters", () => {
    const long = "L".repeat(28)
    const suggestions = sozuTagSuggestions(long, 2026)
    expect(suggestions.every((tag) => tag.length <= 30 && tag.length >= 3)).toBe(true)
    expect(suggestions.some((tag) => tag.startsWith("L"))).toBe(true)
  })

  it("drops a candidate that collapses to the original tag", () => {
    expect(sozuTagSuggestions("ab", 2026)).not.toContain("ab")
  })
})

describe("tagFieldStatus", () => {
  it("stays quiet until three characters, then waits for the check", () => {
    expect(tagFieldStatus({ value: "", focused: false, phase: null, showInvalid: false })).toBe("idle")
    expect(tagFieldStatus({ value: "lu", focused: true, phase: null, showInvalid: false })).toBe("typing")
    expect(tagFieldStatus({ value: "lu", focused: false, phase: null, showInvalid: false })).toBe("invalid")
    expect(tagFieldStatus({ value: "luna", focused: true, phase: null, showInvalid: false })).toBe("typing")
    expect(tagFieldStatus({ value: "luna", focused: true, phase: "available", showInvalid: false })).toBe(
      "available",
    )
  })
})
