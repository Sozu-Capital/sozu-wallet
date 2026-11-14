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

export type SozuPayResult = {
  txHash: string
  username: string
  accountId: string
}

export type SozuPayParams = {
  amount: string
  to: string
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

function messageRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null
  const message = data as Record<string, unknown>
  if (message.type !== MESSAGE_TYPE) return null
  return message
}

function isLoginResult(
  data: unknown,
): data is { type: typeof MESSAGE_TYPE; username: string; accountId: string } {
  const message = messageRecord(data)
  if (!message || typeof message.txHash === "string") return false
  return (
    typeof message.username === "string" &&
    message.username.trim() !== "" &&
    typeof message.accountId === "string" &&
    /^C[A-Z0-9]{55}$/.test(message.accountId.trim().toUpperCase())
  )
}

function isPayResult(
  data: unknown,
): data is { type: typeof MESSAGE_TYPE; username: string; accountId: string; txHash: string } {
  const message = messageRecord(data)
  if (!message) return false
  return (
    typeof message.username === "string" &&
    message.username.trim() !== "" &&
    typeof message.accountId === "string" &&
    /^C[A-Z0-9]{55}$/.test(message.accountId.trim().toUpperCase()) &&
    typeof message.txHash === "string" &&
    /^[a-f0-9]{64}$/i.test(message.txHash)
  )
}

function isSignupFailed(data: unknown): boolean {
  const message = messageRecord(data)
  return message?.error === "signup_failed"
}

/**
 * Opens the Sozu auth page in a popup. Resolves with the username and C account
 * the popup posts back. Rejects when the popup closes or signup fails.
 * The merchant page stays put.
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

  return new Promise((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setInterval> | undefined

    function stop() {
      if (settled) return false
      settled = true
      window.removeEventListener("message", onMessage)
      clearInterval(timer)
      return true
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin || event.source !== popup) return
      if (isSignupFailed(event.data)) {
        if (stop()) reject(new Error("Sozu Connect signup failed"))
        return
      }
      if (!isLoginResult(event.data)) return
      if (!stop()) return
      resolve({
        username: event.data.username.trim(),
        accountId: event.data.accountId.trim().toUpperCase(),
      })
    }

    timer = setInterval(() => {
      if (!popup.closed) return
      if (stop()) reject(new Error("Sozu Connect popup was closed"))
    }, 300)

    window.addEventListener("message", onMessage)
  })
}

/**
 * Opens the Sozu popup for a Circle testnet USDC send.
 * Resolves with the transaction, username, and C account after the user signs.
 */
export function pay(params: SozuPayParams): Promise<SozuPayResult> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Sozu Connect pay runs in the browser"))
  }

  const origin = connectOrigin(params.origin)
  const url = new URL("/auth", origin)
  url.searchParams.set("connect", "1")
  url.searchParams.set("amount", params.amount.trim())
  url.searchParams.set("to", params.to.trim())
  const popup = window.open(url.toString(), POPUP_NAME, POPUP_FEATURES)
  if (!popup) {
    return Promise.reject(new Error("Sozu Connect popup was blocked"))
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setInterval> | undefined

    function stop() {
      if (settled) return false
      settled = true
      window.removeEventListener("message", onMessage)
      clearInterval(timer)
      return true
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin || event.source !== popup) return
      if (isSignupFailed(event.data)) {
        if (stop()) reject(new Error("Sozu Connect signup failed"))
        return
      }
      if (!isPayResult(event.data)) return
      if (!stop()) return
      resolve({
        txHash: event.data.txHash.trim().toLowerCase(),
        username: event.data.username.trim(),
        accountId: event.data.accountId.trim().toUpperCase(),
      })
    }

    timer = setInterval(() => {
      if (!popup.closed) return
      if (stop()) reject(new Error("Sozu Connect popup was closed"))
    }, 300)

    window.addEventListener("message", onMessage)
  })
}
