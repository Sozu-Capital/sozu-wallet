import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { getSessionSecret } from "@/lib/auth/session-cookie"

/**
 * Stateless WebAuthn challenge: nonce(16) || issuedAtMs(8, big-endian) || HMAC(16), base64url.
 * Verifiable on any serverless instance, so login never trusts a client-echoed challenge.
 */

const NONCE_BYTES = 16
const TS_BYTES = 8
const MAC_BYTES = 16
const TOTAL_BYTES = NONCE_BYTES + TS_BYTES + MAC_BYTES
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000
const CLOCK_SKEW_MS = 30 * 1000

function mac(body: Buffer, secret: string): Buffer {
  return createHmac("sha256", secret)
    .update("sozu-wallet:webauthn-challenge:")
    .update(body)
    .digest()
    .subarray(0, MAC_BYTES)
}

export function issueSignedChallenge(nowMs: number = Date.now(), secret: string = getSessionSecret()): string {
  const body = Buffer.alloc(NONCE_BYTES + TS_BYTES)
  randomBytes(NONCE_BYTES).copy(body, 0)
  body.writeBigUInt64BE(BigInt(nowMs), NONCE_BYTES)
  return Buffer.concat([body, mac(body, secret)]).toString("base64url")
}

export function verifySignedChallenge(
  challenge: string | undefined | null,
  nowMs: number = Date.now(),
  secret: string = getSessionSecret(),
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): boolean {
  if (typeof challenge !== "string" || !challenge) return false
  let bytes: Buffer
  try {
    bytes = Buffer.from(challenge, "base64url")
  } catch {
    return false
  }
  if (bytes.length !== TOTAL_BYTES) return false
  const body = bytes.subarray(0, NONCE_BYTES + TS_BYTES)
  const given = bytes.subarray(NONCE_BYTES + TS_BYTES)
  if (!timingSafeEqual(given, mac(body, secret))) return false
  const issuedAt = Number(body.readBigUInt64BE(NONCE_BYTES))
  if (issuedAt > nowMs + CLOCK_SKEW_MS) return false
  return nowMs - issuedAt <= maxAgeMs
}
