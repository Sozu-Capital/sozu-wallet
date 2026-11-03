import { createHash } from "crypto"
import { p256 } from "@noble/curves/p256"
import { parsePasskeyPublicKey65 } from "@/lib/stellar/smartAccounts/passkeyPublicKey"
import { verifySignedChallenge } from "@/lib/webauthn/signed-challenge"

export type LoginAssertion = {
  response?: {
    clientDataJSON?: string
    authenticatorData?: string
    signature?: string
  }
}

export type AssertionCheck = { ok: true } | { ok: false; reason: string }

const FLAG_USER_PRESENT = 0x01
const FLAG_USER_VERIFIED = 0x04

function sha256(data: Uint8Array | string): Buffer {
  return createHash("sha256").update(data).digest()
}

/**
 * Server-side WebAuthn assertion check: signed challenge, origin, rpId hash, UP/UV flags,
 * and the P-256 signature against the passkey public key stored at registration.
 */
export function verifyLoginAssertion(params: {
  assertion: LoginAssertion
  storedPublicKey: string
  /** Hostname the request was served on (from the Host header). */
  expectedHostname: string
  /** Optional configured rpId (NEXT_PUBLIC_RP_ID) that may be a parent domain of the host. */
  configuredRpId?: string | null
  nowMs?: number
}): AssertionCheck {
  const { assertion, storedPublicKey, expectedHostname, configuredRpId, nowMs } = params
  const r = assertion.response
  if (!r?.clientDataJSON || !r.authenticatorData || !r.signature) {
    return { ok: false, reason: "incomplete assertion" }
  }

  const clientDataBytes = Buffer.from(r.clientDataJSON, "base64url")
  let clientData: { type?: string; challenge?: string; origin?: string }
  try {
    clientData = JSON.parse(clientDataBytes.toString("utf-8"))
  } catch {
    return { ok: false, reason: "malformed clientDataJSON" }
  }
  if (clientData.type !== "webauthn.get") return { ok: false, reason: "wrong ceremony type" }
  if (!verifySignedChallenge(clientData.challenge, nowMs)) {
    return { ok: false, reason: "challenge invalid or expired" }
  }

  let originHost: string
  try {
    originHost = new URL(clientData.origin ?? "").hostname
  } catch {
    return { ok: false, reason: "malformed origin" }
  }
  if (originHost !== expectedHostname) return { ok: false, reason: "origin mismatch" }

  const authData = Buffer.from(r.authenticatorData, "base64url")
  if (authData.length < 37) return { ok: false, reason: "short authenticatorData" }
  const rpIdHash = authData.subarray(0, 32)
  const allowedRpIds = new Set([originHost])
  const rp = configuredRpId?.trim()
  if (rp && (originHost === rp || originHost.endsWith(`.${rp}`))) allowedRpIds.add(rp)
  if (![...allowedRpIds].some((id) => sha256(id).equals(rpIdHash))) {
    return { ok: false, reason: "rpId mismatch" }
  }
  const flags = authData[32]
  if (!(flags & FLAG_USER_PRESENT) || !(flags & FLAG_USER_VERIFIED)) {
    return { ok: false, reason: "user not verified" }
  }

  let publicKey: Uint8Array
  try {
    publicKey = parsePasskeyPublicKey65(storedPublicKey)
  } catch {
    return { ok: false, reason: "stored public key unreadable" }
  }

  const digest = sha256(Buffer.concat([authData, sha256(clientDataBytes)]))
  try {
    const sig = p256.Signature.fromDER(Buffer.from(r.signature, "base64url").toString("hex"))
    if (!p256.verify(sig, digest, publicKey, { lowS: false })) {
      return { ok: false, reason: "bad signature" }
    }
  } catch {
    return { ok: false, reason: "bad signature" }
  }
  return { ok: true }
}
