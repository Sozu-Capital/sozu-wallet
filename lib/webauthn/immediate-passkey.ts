import { getPasskey, type PasskeyChallenge, type PasskeyCredential } from "@/lib/turnkey/passkeys"

/**
 * A dismissed passkey sheet takes a human moment. A device with no local
 * passkey rejects immediate mode before any UI. The browser uses the same
 * NotAllowedError for both, so the elapsed ceremony is the split.
 */
export const IMMEDIATE_CANCEL_MS = 450

export function classifyImmediateMiss(elapsedMs: number): "none" | "cancelled" {
  return elapsedMs >= IMMEDIATE_CANCEL_MS ? "cancelled" : "none"
}

export type ImmediatePasskeyResult =
  | { status: "credential"; credential: PasskeyCredential }
  | { status: "none" }
  | { status: "cancelled" }
  | { status: "unsupported" }
  | { status: "error"; message: string }

type ClientCapabilities = { immediateGet?: boolean }

export async function supportsImmediatePasskey(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false
  const pk = window.PublicKeyCredential as typeof PublicKeyCredential & {
    getClientCapabilities?: () => Promise<ClientCapabilities>
  }
  if (!pk.getClientCapabilities) return false
  try {
    const caps = await pk.getClientCapabilities()
    return caps.immediateGet === true
  } catch {
    return false
  }
}

/**
 * Open passkeys already saved on this device. Does not show the
 * "scan with another device" sheet.
 */
export async function requestImmediateLocalPasskey(
  challenge: PasskeyChallenge,
): Promise<ImmediatePasskeyResult> {
  if (!(await supportsImmediatePasskey())) return { status: "unsupported" }

  const started = performance.now()
  try {
    const credential = await getPasskey(challenge, { uiMode: "immediate" })
    if (!credential) return { status: "none" }
    return { status: "credential", credential }
  } catch (error) {
    const elapsedMs = performance.now() - started
    if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) {
      return { status: classifyImmediateMiss(elapsedMs) }
    }
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not sign in",
    }
  }
}
