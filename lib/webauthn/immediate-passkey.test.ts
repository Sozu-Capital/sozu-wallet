import { describe, expect, it } from "vitest"
import { classifyImmediateMiss } from "./immediate-passkey"

describe("classifyImmediateMiss", () => {
  it("treats a fast rejection as no saved passkey", () => {
    expect(classifyImmediateMiss(40)).toBe("none")
    expect(classifyImmediateMiss(449)).toBe("none")
  })

  it("treats a rejection after the sheet was visible as a cancel", () => {
    expect(classifyImmediateMiss(450)).toBe("cancelled")
    expect(classifyImmediateMiss(1800)).toBe("cancelled")
  })
})