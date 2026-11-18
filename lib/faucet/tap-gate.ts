import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { FAUCET_TAP_PATH } from "@/lib/faucet/tap-path"

export { FAUCET_TAP_PATH }

export const FAUCET_TAP_COOKIE = "sozu_faucet_tap"
/** Long enough to create a passkey and claim. Forwarding the address bar does not copy it. */
export const FAUCET_TAP_MAX_AGE_SECONDS = 60 * 60 * 2
export const DEFAULT_TAP_SLUG = "test-orb-001"

const SLUG_RE = /^[a-z0-9-]{1,64}$/

export function expectedTapSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env.FAUCET_TAP_SECRET?.trim() ?? ""
  if (secret.length < 32 || secret.length > 128) return null
  return secret
}

export function tapSlug(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.FAUCET_TAP_SLUG?.trim().toLowerCase() ?? ""
  return SLUG_RE.test(raw) ? raw : DEFAULT_TAP_SLUG
}

/** Hash both sides so a short guess doesn't return early on length. */
export function tapSecretMatches(presented: string, expected: string): boolean {
  if (!presented || presented.length < 32 || presented.length > 128) return false
  if (!expected || expected.length < 32 || expected.length > 128) return false
  const a = createHash("sha256").update(presented).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`faucet-tap:${payload}`).digest("base64url")
}

export function buildTapCookieValue(
  slug: string,
  nowMs: number = Date.now(),
  secret: string,
): string {
  const exp = Math.floor(nowMs / 1000) + FAUCET_TAP_MAX_AGE_SECONDS
  const body = Buffer.from(JSON.stringify({ slug, exp })).toString("base64url")
  return `${body}.${sign(body, secret)}`
}

export function openTapSlug(
  raw: string | null | undefined,
  nowMs: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const secret = expectedTapSecret(env)
  if (!secret || !raw) return null
  const dot = raw.lastIndexOf(".")
  if (dot <= 0) return null
  const body = raw.slice(0, dot)
  const sig = Buffer.from(raw.slice(dot + 1))
  const expected = Buffer.from(sign(body, secret))
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      slug?: unknown
      exp?: unknown
    }
    if (typeof payload.slug !== "string" || !SLUG_RE.test(payload.slug)) return null
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= nowMs) return null
    if (payload.slug !== tapSlug(env)) return null
    return payload.slug
  } catch {
    return null
  }
}

export function tapCookieAllowsSlug(
  cookieHeader: string | null,
  slug: string,
  nowMs: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const opened = openTapSlug(readCookieValue(cookieHeader, FAUCET_TAP_COOKIE), nowMs, env)
  return opened !== null && opened === slug.trim().toLowerCase()
}

function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== name) continue
    return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return null
}

export function tapCookieOptions(maxAge: number = FAUCET_TAP_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}
