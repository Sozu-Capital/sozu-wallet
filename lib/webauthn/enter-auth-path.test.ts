import { describe, expect, it } from "vitest"
import { resolveEnterAuthPath } from "./enter-auth-path"

describe("resolveEnterAuthPath", () => {
  it("prefers stored username login over capability checks", () => {
    expect(
      resolveEnterAuthPath({
        storedUsername: "alice",
        capabilities: { hasWebAuthn: true, canUsePasskeys: false },
      }),
    ).toEqual({ action: "login-stored", username: "alice" })
  })

  it("ignores placeholder stored username and opens the passkey sheet", () => {
    expect(
      resolveEnterAuthPath({
        storedUsername: "user",
        capabilities: { hasWebAuthn: true, canUsePasskeys: true },
      }),
    ).toEqual({ action: "passkey-prompt" })
  })

  it("opens the passkey sheet before any new-account form", () => {
    expect(
      resolveEnterAuthPath({
        storedUsername: null,
        capabilities: { hasWebAuthn: true, canUsePasskeys: true },
      }),
    ).toEqual({ action: "passkey-prompt" })
  })

  it("still opens the passkey sheet when this device has no platform authenticator", () => {
    expect(
      resolveEnterAuthPath({
        storedUsername: null,
        capabilities: { hasWebAuthn: true, canUsePasskeys: false },
      }),
    ).toEqual({ action: "passkey-prompt" })
  })

  it("marks missing WebAuthn as unsupported", () => {
    expect(
      resolveEnterAuthPath({
        storedUsername: null,
        capabilities: { hasWebAuthn: false, canUsePasskeys: false },
      }),
    ).toEqual({ action: "unsupported" })

    expect(
      resolveEnterAuthPath({
        storedUsername: null,
        capabilities: null,
      }),
    ).toEqual({ action: "unsupported" })
  })
})
