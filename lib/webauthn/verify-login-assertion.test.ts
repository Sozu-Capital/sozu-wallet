import { createHash } from "crypto"
import { p256 } from "@noble/curves/p256"
import { beforeAll, describe, expect, it } from "vitest"
import { issueSignedChallenge, verifySignedChallenge } from "@/lib/webauthn/signed-challenge"
import { verifyLoginAssertion } from "@/lib/webauthn/verify-login-assertion"

const HOST = "dev.sozu.capital"
const sha256 = (d: Uint8Array | string) => createHash("sha256").update(d).digest()

const privateKey = p256.utils.randomPrivateKey()
const publicKey65 = Buffer.from(p256.getPublicKey(privateKey, false)).toString("base64url")

function makeAssertion(opts: {
  challenge?: string
  origin?: string
  rpId?: string
  flags?: number
  type?: string
} = {}) {
  const clientData = Buffer.from(
    JSON.stringify({
      type: opts.type ?? "webauthn.get",
      challenge: opts.challenge ?? issueSignedChallenge(),
      origin: opts.origin ?? `https://${HOST}`,
    }),
  )
  const authData = Buffer.concat([sha256(opts.rpId ?? HOST), Buffer.from([opts.flags ?? 0x05]), Buffer.alloc(4)])
  const digest = sha256(Buffer.concat([authData, sha256(clientData)]))
  const sig = p256.sign(digest, privateKey, { prehash: false, lowS: false })
  return {
    response: {
      clientDataJSON: clientData.toString("base64url"),
      authenticatorData: authData.toString("base64url"),
      signature: Buffer.from(sig.toDERRawBytes()).toString("base64url"),
    },
  }
}

describe("signed WebAuthn challenge", () => {
  beforeAll(() => {
    process.env.WALLET_SESSION_SECRET = "test-secret"
  })

  it("accepts a fresh challenge and rejects old or forged ones", () => {
    const now = Date.now()
    const c = issueSignedChallenge(now)
    expect(verifySignedChallenge(c, now + 1000)).toBe(true)
    expect(verifySignedChallenge(c, now + 6 * 60 * 1000)).toBe(false)
    expect(verifySignedChallenge(Buffer.alloc(40).toString("base64url"), now)).toBe(false)
    expect(verifySignedChallenge(issueSignedChallenge(now, "other-secret"), now)).toBe(false)
  })
})

describe("verifyLoginAssertion", () => {
  beforeAll(() => {
    process.env.WALLET_SESSION_SECRET = "test-secret"
  })

  const verify = (assertion: ReturnType<typeof makeAssertion>, key = publicKey65) =>
    verifyLoginAssertion({ assertion, storedPublicKey: key, expectedHostname: HOST })

  it("accepts a valid assertion", () => {
    expect(verify(makeAssertion())).toEqual({ ok: true })
  })

  it("rejects a client-invented challenge", () => {
    const res = verify(makeAssertion({ challenge: Buffer.alloc(32, 7).toString("base64url") }))
    expect(res.ok).toBe(false)
  })

  it("rejects another origin", () => {
    expect(verify(makeAssertion({ origin: "https://evil.example" })).ok).toBe(false)
  })

  it("rejects a mismatched rpId hash", () => {
    expect(verify(makeAssertion({ rpId: "evil.example" })).ok).toBe(false)
  })

  it("rejects without user verification", () => {
    expect(verify(makeAssertion({ flags: 0x01 })).ok).toBe(false)
  })

  it("rejects a registration ceremony", () => {
    expect(verify(makeAssertion({ type: "webauthn.create" })).ok).toBe(false)
  })

  it("rejects a signature from a different passkey", () => {
    const otherKey = Buffer.from(p256.getPublicKey(p256.utils.randomPrivateKey(), false)).toString("base64url")
    expect(verify(makeAssertion(), otherKey).ok).toBe(false)
  })

  it("rejects a tampered signature", () => {
    const a = makeAssertion()
    const sig = Buffer.from(a.response.signature, "base64url")
    sig[sig.length - 1] ^= 0xff
    a.response.signature = sig.toString("base64url")
    expect(verify(a).ok).toBe(false)
  })
})
