import { afterEach, describe, expect, it, vi } from "vitest"
import { isValidBypass, isWaitlistMode, waitlistGate } from "./waitlist-mode"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("waitlist mode", () => {
  it("is on only when WAITLIST_MODE is 1", () => {
    vi.stubEnv("WAITLIST_MODE", "")
    expect(isWaitlistMode()).toBe(false)
    vi.stubEnv("WAITLIST_MODE", "1")
    expect(isWaitlistMode()).toBe(true)
  })

  it("serves the waitlist at the root and sends every other page there", () => {
    expect(waitlistGate("/", false)).toBe("rewrite")
    expect(waitlistGate("/auth", false)).toBe("redirect")
    expect(waitlistGate("/home", false)).toBe("redirect")
    expect(waitlistGate("/faucet/test-orb-001", false)).toBe("redirect")
    expect(waitlistGate("/waitlist", false)).toBe("redirect")
  })

  it("keeps APIs, well-known files, and static assets reachable", () => {
    expect(waitlistGate("/api/waitlist", false)).toBe("pass")
    expect(waitlistGate("/api/wallet/stellar/balance", false)).toBe("pass")
    expect(waitlistGate("/.well-known/stellar.toml", false)).toBe("pass")
    expect(waitlistGate("/brand/november-2026/mark.png", false)).toBe("pass")
    expect(waitlistGate("/fonts/SCHABO-XCondensed.woff2", false)).toBe("pass")
    expect(waitlistGate("/robots.txt", false)).toBe("pass")
    expect(waitlistGate("/item/liquid-society", false)).toBe("pass")
  })

  it("does not let dotted page URLs skip the gate", () => {
    expect(waitlistGate("/city/spot/1.png", false)).toBe("redirect")
    expect(waitlistGate("/faucet/orb.v2", false)).toBe("redirect")
    expect(waitlistGate("/checkout/pizza/x.json", false)).toBe("redirect")
  })

  it("lets bypassed visitors use the app", () => {
    expect(waitlistGate("/", true)).toBe("pass")
    expect(waitlistGate("/home", true)).toBe("pass")
  })

  it("accepts only the configured bypass token, and only when it is long enough", () => {
    vi.stubEnv("WAITLIST_BYPASS_TOKEN", "")
    expect(isValidBypass("")).toBe(false)
    vi.stubEnv("WAITLIST_BYPASS_TOKEN", "short")
    expect(isValidBypass("short")).toBe(false)
    vi.stubEnv("WAITLIST_BYPASS_TOKEN", "a-long-enough-team-token")
    expect(isValidBypass("a-long-enough-team-token")).toBe(true)
    expect(isValidBypass("wrong")).toBe(false)
    expect(isValidBypass(undefined)).toBe(false)
  })
})
