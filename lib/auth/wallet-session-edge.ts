/**
 * Edge-safe check for the wallet session cookie. Middleware cannot import
 * `lib/auth/session-cookie.ts` because that module uses Node `crypto`.
 * The signed shape matches `buildSessionCookieValue`.
 */

export const WALLET_SESSION_COOKIE = "sozu_wallet_session"

const DEV_FALLBACK_SECRET = "sozu-wallet-dev-session-secret"

function sessionSecret(): string | null {
  const secret = process.env.WALLET_SESSION_SECRET?.trim()
  if (secret) return secret
  if (process.env.NODE_ENV === "production") return null
  return DEV_FALLBACK_SECRET
}

function base64UrlToString(encoded: string): string {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  return atob(padded + pad)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ""
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i]
  return diff === 0
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  return bytesToBase64Url(new Uint8Array(mac))
}

export async function hasValidWalletSessionCookie(
  raw: string | undefined | null,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const secret = sessionSecret()
  if (!secret || !raw) return false
  const dot = raw.lastIndexOf(".")
  if (dot <= 0) return false
  const encoded = raw.slice(0, dot)
  const expected = await sign(encoded, secret)
  if (!timingSafeEqual(raw.slice(dot + 1), expected)) return false
  try {
    const payload = JSON.parse(base64UrlToString(encoded)) as {
      uid?: string
      exp?: number
    }
    if (typeof payload.uid !== "string" || !payload.uid) return false
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= nowMs) return false
    return true
  } catch {
    return false
  }
}
