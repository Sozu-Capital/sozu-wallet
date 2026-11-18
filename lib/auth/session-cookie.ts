import { createHmac, timingSafeEqual } from "crypto"

/**
 * Wallet session cookie: base64url(JSON payload) + "." + HMAC-SHA256.
 * Same shape as the SozuPay dashboard cookie, plus an expiry inside the signed payload.
 */

export const WALLET_SESSION_COOKIE = "sozu_wallet_session"
export const WALLET_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

const DEV_FALLBACK_SECRET = "sozu-wallet-dev-session-secret"

export type WalletSessionPayload = {
  uid: string
  iat: number
  exp: number
}

export function getSessionSecret(): string {
  const secret = process.env.WALLET_SESSION_SECRET?.trim()
  if (secret) return secret
  if (process.env.NODE_ENV === "production") {
    throw new Error("WALLET_SESSION_SECRET is not set")
  }
  return DEV_FALLBACK_SECRET
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

export function buildSessionCookieValue(
  userId: string,
  nowMs: number = Date.now(),
  secret: string = getSessionSecret(),
): string {
  const iat = Math.floor(nowMs / 1000)
  const payload: WalletSessionPayload = { uid: userId, iat, exp: iat + WALLET_SESSION_MAX_AGE_SECONDS }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${encoded}.${sign(encoded, secret)}`
}

export function parseSessionCookieValue(
  raw: string | undefined | null,
  nowMs: number = Date.now(),
  secret: string = getSessionSecret(),
): WalletSessionPayload | null {
  if (!raw) return null
  const dot = raw.lastIndexOf(".")
  if (dot <= 0) return null
  const encoded = raw.slice(0, dot)
  const sig = Buffer.from(raw.slice(dot + 1))
  const expected = Buffer.from(sign(encoded, secret))
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as WalletSessionPayload
    if (typeof payload.uid !== "string" || !payload.uid) return null
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= nowMs) return null
    return payload
  } catch {
    return null
  }
}

export function getSessionCookieOptions(maxAge: number = WALLET_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    // Dev phones on the LAN reach the app over plain http, where Secure cookies are dropped.
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  }
}

/** Read one cookie from a raw Cookie header (works for plain `Request`, not only `NextRequest`). */
export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim()
      try {
        return decodeURIComponent(value)
      } catch {
        return value
      }
    }
  }
  return null
}
