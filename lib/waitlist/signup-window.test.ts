import { afterEach, describe, expect, it, vi } from "vitest"
import { buildSessionCookieValue } from "@/lib/auth/session-cookie"
import { hasValidWalletSessionCookie } from "@/lib/auth/wallet-session-edge"
import {
  EVENT_SIGNUP_CLOSES_AT_MS,
  EVENT_SIGNUP_OPENS_AT_MS,
  betaAccessDecision,
  isEventSignupOpen,
  isNewAccountAllowed,
} from "@/lib/waitlist/signup-window"

const BEFORE = EVENT_SIGNUP_OPENS_AT_MS - 1
const DURING = Date.parse("2026-11-18T15:00:00-03:00")
const AT_CLOSE = EVENT_SIGNUP_CLOSES_AT_MS

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("event signup window", () => {
  it("opens at Wednesday 00:00 ART and closes at Thursday 00:00 ART", () => {
    expect(isEventSignupOpen(BEFORE)).toBe(false)
    expect(isEventSignupOpen(EVENT_SIGNUP_OPENS_AT_MS)).toBe(true)
    expect(isEventSignupOpen(DURING)).toBe(true)
    expect(isEventSignupOpen(AT_CLOSE - 1)).toBe(true)
    expect(isEventSignupOpen(AT_CLOSE)).toBe(false)
  })

  it("keeps production on the waitlist during Wednesday unless the event cookie is present", () => {
    const closed = { pathname: "/", host: "app.sozu.capital", hasBypass: false, hasSession: false, nowMs: DURING }
    const admitted = { ...closed, hasBypass: true, hasSession: true }
    expect(betaAccessDecision(closed)).toBe("rewrite")
    expect(betaAccessDecision(admitted)).toBe("pass")
  })

  it("refuses a new production account after Thursday 00:00 ART", () => {
    expect(isNewAccountAllowed("app.sozu.capital", DURING)).toBe(true)
    expect(isNewAccountAllowed("app.sozu.capital", AT_CLOSE)).toBe(false)
    expect(isNewAccountAllowed("dev.sozu.capital", AT_CLOSE)).toBe(true)
  })

  it("leaves staging and local open outside the window", () => {
    expect(
      betaAccessDecision({ pathname: "/", host: "dev.sozu.capital", hasBypass: false, hasSession: false, nowMs: AT_CLOSE }),
    ).toBe("open")
    expect(
      betaAccessDecision({ pathname: "/", host: "localhost:3000", hasBypass: false, hasSession: false, nowMs: BEFORE }),
    ).toBe("open")
  })

  it("keeps the waitlist up after midnight even for a passkey session", () => {
    expect(betaAccessDecision({ pathname: "/", host: "app.sozu.capital", hasBypass: false, hasSession: false, nowMs: AT_CLOSE })).toBe("rewrite")
    expect(betaAccessDecision({ pathname: "/home", host: "app.sozu.capital", hasBypass: false, hasSession: false, nowMs: AT_CLOSE })).toBe("redirect")
    expect(betaAccessDecision({ pathname: "/home", host: "app.sozu.capital", hasBypass: false, hasSession: true, nowMs: AT_CLOSE })).toBe("redirect")
    expect(betaAccessDecision({ pathname: "/auth", host: "app.sozu.capital", hasBypass: false, hasSession: false, nowMs: AT_CLOSE })).toBe("redirect")
    expect(betaAccessDecision({ pathname: "/auth", host: "app.sozu.capital", hasBypass: true, hasSession: false, nowMs: AT_CLOSE })).toBe("pass")
    expect(betaAccessDecision({ pathname: "/auth/add-device", host: "app.sozu.capital", hasBypass: false, hasSession: false, nowMs: AT_CLOSE })).toBe("redirect")
    expect(betaAccessDecision({ pathname: "/auth/cross-device", host: "app.sozu.capital", hasBypass: false, hasSession: false, nowMs: AT_CLOSE })).toBe("redirect")
    expect(betaAccessDecision({ pathname: "/api/auth/login/verify", host: "app.sozu.capital", hasBypass: false, hasSession: false, nowMs: AT_CLOSE })).toBe("pass")
  })

  it("accepts the same session cookie the server issues", async () => {
    vi.stubEnv("WALLET_SESSION_SECRET", "test-secret")
    const nowMs = AT_CLOSE
    const cookie = buildSessionCookieValue("user-1", nowMs, "test-secret")
    await expect(hasValidWalletSessionCookie(cookie, nowMs + 1000)).resolves.toBe(true)
    await expect(hasValidWalletSessionCookie(cookie, nowMs + 8 * 24 * 60 * 60 * 1000)).resolves.toBe(false)
    await expect(hasValidWalletSessionCookie(`${cookie}x`, nowMs + 1000)).resolves.toBe(false)
  })
})
