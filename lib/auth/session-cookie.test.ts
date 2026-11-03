import { describe, expect, it } from "vitest"
import {
  WALLET_SESSION_COOKIE,
  WALLET_SESSION_MAX_AGE_SECONDS,
  buildSessionCookieValue,
  parseSessionCookieValue,
  readCookie,
} from "@/lib/auth/session-cookie"

const SECRET = "test-secret"
const NOW = Date.UTC(2026, 10, 3)

describe("wallet session cookie", () => {
  it("round-trips the user id", () => {
    const raw = buildSessionCookieValue("user-a", NOW, SECRET)
    expect(parseSessionCookieValue(raw, NOW, SECRET)?.uid).toBe("user-a")
  })

  it("rejects a tampered payload", () => {
    const raw = buildSessionCookieValue("user-a", NOW, SECRET)
    const [, sig] = raw.split(".")
    const forged = Buffer.from(JSON.stringify({ uid: "user-b", iat: 0, exp: 9e9 })).toString("base64url")
    expect(parseSessionCookieValue(`${forged}.${sig}`, NOW, SECRET)).toBeNull()
  })

  it("rejects a cookie signed with another secret", () => {
    const raw = buildSessionCookieValue("user-a", NOW, "other-secret")
    expect(parseSessionCookieValue(raw, NOW, SECRET)).toBeNull()
  })

  it("rejects an expired cookie", () => {
    const raw = buildSessionCookieValue("user-a", NOW, SECRET)
    const later = NOW + (WALLET_SESSION_MAX_AGE_SECONDS + 1) * 1000
    expect(parseSessionCookieValue(raw, later, SECRET)).toBeNull()
  })

  it("rejects junk", () => {
    expect(parseSessionCookieValue(undefined, NOW, SECRET)).toBeNull()
    expect(parseSessionCookieValue("user-a", NOW, SECRET)).toBeNull()
    expect(parseSessionCookieValue(".abc", NOW, SECRET)).toBeNull()
  })

  it("reads the cookie from a raw Cookie header", () => {
    const header = `a=1; ${WALLET_SESSION_COOKIE}=abc.def; b=2`
    expect(readCookie(header, WALLET_SESSION_COOKIE)).toBe("abc.def")
    expect(readCookie(header, "missing")).toBeNull()
    expect(readCookie(null, WALLET_SESSION_COOKIE)).toBeNull()
  })
})
