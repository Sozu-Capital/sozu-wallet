/**
 * Liquid Society private beta on app.sozu.capital.
 * The app stays on the waitlist unless the browser has the event cookie from the QR or NFC link.
 * That cookie lasts 30 days. Losing it, or waiting it out, sends the browser back to the waitlist.
 * A passkey session does not replace the cookie. New accounts can be created only on Wednesday
 * 18 Nov 2026, America/Argentina (UTC-3), and only with the cookie. The window ends at 00:00
 * on Thursday 19 Nov.
 * Edge-safe: no Node-only imports.
 */

import { waitlistGate, type WaitlistGateDecision } from "@/lib/waitlist/waitlist-mode"

export const EVENT_SIGNUP_OPENS_AT_MS = Date.parse("2026-11-18T00:00:00-03:00")
export const EVENT_SIGNUP_CLOSES_AT_MS = Date.parse("2026-11-19T00:00:00-03:00")

export function isEventSignupOpen(nowMs: number = Date.now()): boolean {
  return nowMs >= EVENT_SIGNUP_OPENS_AT_MS && nowMs < EVENT_SIGNUP_CLOSES_AT_MS
}

export function isNewAccountAllowed(host: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!isProductionBetaHost(host)) return true
  return isEventSignupOpen(nowMs)
}

/** The calendar applies to the production private-beta host. Staging and local stay open. */
export function isProductionBetaHost(host: string | null | undefined): boolean {
  const hostname = host?.split(":")[0]?.trim().toLowerCase() ?? ""
  return hostname === "app.sozu.capital"
}

export type BetaAccessDecision = "open" | WaitlistGateDecision

/**
 * Staging and local stay open. On production, the event cookie is the only way in.
 * A wallet session without that cookie still sees the waitlist.
 */
export function betaAccessDecision(input: {
  pathname: string
  host?: string | null
  hasBypass: boolean
  hasSession: boolean
  nowMs: number
}): BetaAccessDecision {
  if (input.host != null && !isProductionBetaHost(input.host)) return "open"
  if (input.hasBypass) return "pass"
  return waitlistGate(input.pathname, false)
}
