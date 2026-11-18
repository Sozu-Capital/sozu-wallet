"use client"

import { clearClientSession } from "@/lib/storage/clear-session"

/**
 * `true` when the httpOnly session cookie is valid.
 * `false` when the server rejects it.
 * `null` when the check itself failed (offline, timeout) — do not log the user out.
 */
export async function hasServerWalletSession(): Promise<boolean | null> {
  try {
    const res = await fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 401) return false
    return res.ok ? true : null
  } catch {
    return null
  }
}

/** Drop the stale local session and return to passkey sign-in so a new cookie can be issued. */
export function recoverStaleWalletSession(): void {
  if (typeof window === "undefined") return
  clearClientSession()
  window.location.replace(`/auth${window.location.search}${window.location.hash}`)
}
