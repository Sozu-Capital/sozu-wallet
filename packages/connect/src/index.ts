export const SOZU_CONNECT_ORIGIN = "https://dev.sozu.capital"

const POPUP_NAME = "sozu-connect"
const POPUP_FEATURES = "popup,width=420,height=720"
const MESSAGE_TYPE = "sozu-connect"

export type SozuLoginResult = {
  username: string
  accountId: string
}

export type SozuLoginOptions = {
  /** Defaults to https://dev.sozu.capital. */
  origin?: string
}

function connectOrigin(origin?: string): string {
  const value = (origin ?? SOZU_CONNECT_ORIGIN).trim().replace(/\/$/, "")
  const url = new URL(value)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Sozu Connect origin must be http or https")
  }
  return url.origin
}

function isLoginResult(
  data: unknown,
): data is { type: typeof MESSAGE_TYPE; username: string; accountId: string } {
  if (!data || typeof data !== "object") return false
  const message = data as Record<string, unknown>
  return (
    message.type === MESSAGE_TYPE &&
    typeof message.username === "string" &&
    message.username.trim() !== "" &&
    typeof message.accountId === "string" &&
    /^C[A-Z0-9]{55}$/.test(message.accountId.trim().toUpperCase())
  )
}

/**
 * Opens the Sozu auth page in a popup. Resolves with the username and C account
 * the popup posts back. The merchant page stays put.
 */
export function login(options: SozuLoginOptions = {}): Promise<SozuLoginResult> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Sozu Connect login runs in the browser"))
  }

  const origin = connectOrigin(options.origin)
  const popup = window.open(`${origin}/auth?connect=1`, POPUP_NAME, POPUP_FEATURES)
  if (!popup) {
    return Promise.reject(new Error("Sozu Connect popup was blocked"))
  }

  return new Promise((resolve) => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== origin || event.source !== popup) return
      if (!isLoginResult(event.data)) return
      window.removeEventListener("message", onMessage)
      resolve({
        username: event.data.username.trim(),
        accountId: event.data.accountId.trim().toUpperCase(),
      })
    }

    window.addEventListener("message", onMessage)
  })
}
