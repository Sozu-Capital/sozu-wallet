/**
 * WAITLIST_MODE: every page answers with the waitlist at `/`. APIs, well-known files, and static
 * assets keep working so pay.sozu.capital, the faucet, and SDP can still call this deployment.
 * Edge-safe: no Node-only imports.
 *
 * Visiting `/?access=<WAITLIST_BYPASS_TOKEN>` sets a cookie that skips the gate for the team.
 */

export const WAITLIST_PATH = "/waitlist"
export const WAITLIST_BYPASS_COOKIE = "sozu_waitlist_bypass"
export const WAITLIST_BYPASS_QUERY = "access"

const STATIC_FILE = /\/[^/]+\.[a-z0-9]+$/i

export function isWaitlistMode(): boolean {
  return process.env.WAITLIST_MODE === "1"
}

export function waitlistBypassToken(): string | null {
  const token = process.env.WAITLIST_BYPASS_TOKEN?.trim()
  return token && token.length >= 16 ? token : null
}

export function isValidBypass(value: string | null | undefined): boolean {
  const token = waitlistBypassToken()
  return Boolean(token && value && value === token)
}

export type WaitlistGateDecision = "pass" | "rewrite" | "redirect"

export function waitlistGate(pathname: string, hasBypass: boolean): WaitlistGateDecision {
  if (pathname.startsWith("/api/") || pathname.startsWith("/.well-known/")) return "pass"
  if (STATIC_FILE.test(pathname)) return "pass"
  if (hasBypass) return "pass"
  if (pathname === "/") return "rewrite"
  return "redirect"
}
