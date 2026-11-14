import { isContractStellarAddress } from "@/lib/payment/stellar-address"

/** Query on the existing auth page: `/auth?connect=1`. */
export const SOZU_CONNECT_QUERY = "connect"

export const SOZU_CONNECT_MESSAGE_TYPE = "sozu-connect"

export type SozuConnectSuccess = {
  type: typeof SOZU_CONNECT_MESSAGE_TYPE
  username: string
  accountId: string
}

export type SozuConnectFailure = {
  type: typeof SOZU_CONNECT_MESSAGE_TYPE
  error: "signup_failed"
}

export type SozuConnectMessage = SozuConnectSuccess | SozuConnectFailure

export function isSozuConnectSearch(params: { get(name: string): string | null }): boolean {
  return params.get(SOZU_CONNECT_QUERY) === "1"
}

/**
 * Public result for the window that opened the popup.
 * Only a display username and a `C…` smart account. No key, cookie, or token.
 */
export function sozuConnectSuccess(
  username: string | null | undefined,
  accountId: string | null | undefined,
): SozuConnectSuccess | null {
  const name = username?.trim() ?? ""
  if (!name || name === "user") return null
  const id = accountId?.trim().toUpperCase() ?? ""
  if (!isContractStellarAddress(id)) return null
  return { type: SOZU_CONNECT_MESSAGE_TYPE, username: name, accountId: id }
}

export function sozuConnectSignupFailed(): SozuConnectFailure {
  return { type: SOZU_CONNECT_MESSAGE_TYPE, error: "signup_failed" }
}

/**
 * Any site may open the popup, so the target origin is `*`.
 * The payload is only the public fields from `sozuConnectSuccess` or a signup failure.
 */
export function deliverSozuConnectResult(message: SozuConnectMessage): void {
  if (typeof window === "undefined") return
  const opener = window.opener as Window | null
  if (opener && !opener.closed) {
    opener.postMessage(message, "*")
  }
  window.close()
}
