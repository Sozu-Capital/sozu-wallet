import { describe, expect, it } from "vitest"
import { normalizeRecoveryEmail } from "./recovery-email"
import { createRecoveryToken, hashRecoveryToken } from "./recovery-token"

describe("recovery email", () => {
  it("accepts a normal address and rejects anything else", () => {
    expect(normalizeRecoveryEmail("  Ana@Sozu.Capital ")).toBe("ana@sozu.capital")
    expect(normalizeRecoveryEmail("not-an-email")).toBeNull()
    expect(normalizeRecoveryEmail("")).toBeNull()
  })

  it("stores a hash that matches the token and not the token itself", () => {
    const { token, tokenHash } = createRecoveryToken()
    expect(tokenHash).toBe(hashRecoveryToken(token))
    expect(tokenHash).not.toBe(token)
    expect(tokenHash).toHaveLength(64)
  })
})
