/**
 * Liquid Society private beta on app.sozu.capital.
 * New accounts can be created only on Wednesday 18 Nov 2026, America/Argentina (UTC-3).
 * The window ends at 00:00 on Thursday 19 Nov. Existing sessions and passkey sign-in stay open.
 * Edge-safe: no Node-only imports.
 */

import { waitlistGate, type WaitlistGateDecision } from "@/lib/waitlist/waitlist-mode"

export const EVENT_SIGNUP_OPENS_AT_MS = Date.parse("2026-11-18T00:00:00-03:00")
export const EVENT_SIGNUP_CLOSES_AT_MS = Date.parse("2026-11-19T00:00:00-03:00")

const RETURNING_USER_PATHS = new Set(["/auth", "/auth/add-device"])

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
 * `open` means the event window is live and the waitlist stays down.
 * Outside that window, a session or the team bypass uses the app, and `/auth` stays
 * reachable so an existing passkey can sign in. Everyone else gets the waitlist.
 */
export function betaAccessDecision(input: {
  pathname: string
  host?: string | null
  hasBypass: boolean
  hasSession: boolean
  nowMs: number
}): BetaAccessDecision {
  if (input.host != null && !isProductionBetaHost(input.host)) return "open"
  if (isEventSignupOpen(input.nowMs)) return "open"
  if (input.hasSession || input.hasBypass) return "pass"
  if (RETURNING_USER_PATHS.has(input.pathname)) return "pass"
  return waitlistGate(input.pathname, false)
}
