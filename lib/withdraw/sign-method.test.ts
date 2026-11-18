import { describe, expect, it } from "vitest"
import { withdrawSignMethod } from "./sign-method"

describe("withdrawSignMethod", () => {
  it("uses the G signer for a factory account that is not an OZ passkey contract", () => {
    expect(withdrawSignMethod(false, true)).toBe("smart_g_signer")
  })

  it("keeps passkey signing when the contract supports the OZ kit, even if a factory check is true", () => {
    expect(withdrawSignMethod(true, true)).toBe("oz_passkey")
    expect(withdrawSignMethod(true, false)).toBe("oz_passkey")
  })

  it("falls back to the local passkey path for other smart accounts", () => {
    expect(withdrawSignMethod(false, false)).toBe("oz_passkey_local")
  })
})
