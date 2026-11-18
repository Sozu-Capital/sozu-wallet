import { buildExternalSignerKeyData } from "@/lib/stellar/smartAccounts/passkeyPublicKey"

/** Default rule installed at deploy. Transfers sign against this rule. */
export const DEFAULT_CONTEXT_RULE_ID = 0

/**
 * Not installed at registration. The recovery ticket adds this second context
 * rule later; deploy leaves the policies map empty so that call can land.
 */
export const RECOVERY_CONTEXT_RULE_ID = 1

export type PasskeyNativeDeploySigner = {
  tag: "External"
  values: [string, Buffer]
}

/** The only signer a new smart account gets: the passkey's secp256r1 key. */
export function passkeyNativeDeploySigners(params: {
  webauthnVerifierAddress: string
  publicKey65: Uint8Array
  credentialIdBytes: Buffer
}): PasskeyNativeDeploySigner[] {
  return [
    {
      tag: "External",
      values: [
        params.webauthnVerifierAddress,
        buildExternalSignerKeyData(params.publicKey65, params.credentialIdBytes),
      ],
    },
  ]
}

export type DefaultSignerSummary = {
  signerCount: number
  onlyPasskeyExternal: boolean
  verifier: string | null
  publicKey65: Uint8Array | null
}

type SignerParts = { tag: string; verifier: string | null; keyData: Uint8Array | null }

function bytesOf(raw: unknown): Uint8Array | null {
  if (!raw) return null
  if (raw instanceof Uint8Array) return raw
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) return new Uint8Array(raw)
  if (typeof raw === "object" && raw && "data" in raw && Array.isArray((raw as { data: unknown }).data)) {
    return Uint8Array.from((raw as { data: number[] }).data)
  }
  return null
}

function signerParts(signer: unknown): SignerParts | null {
  if (Array.isArray(signer)) {
    return {
      tag: String(signer[0] ?? ""),
      verifier: typeof signer[1] === "string" ? signer[1] : null,
      keyData: bytesOf(signer[2]),
    }
  }
  if (signer && typeof signer === "object" && "tag" in signer) {
    const values = (signer as { values?: unknown }).values
    if (Array.isArray(values)) {
      return {
        tag: String((signer as { tag: unknown }).tag),
        verifier: typeof values[0] === "string" ? values[0] : null,
        keyData: bytesOf(values[1]),
      }
    }
  }
  return null
}

export function summarizeDefaultRule(rule: unknown): DefaultSignerSummary {
  const signers = rule && typeof rule === "object" ? (rule as { signers?: unknown }).signers : null
  const list = Array.isArray(signers) ? signers : []
  const parts = list.map(signerParts).filter((part): part is SignerParts => part !== null)
  const only =
    parts.length === 1 && parts[0].tag === "External" && parts[0].keyData !== null && parts[0].keyData.length >= 65
  return {
    signerCount: list.length,
    onlyPasskeyExternal: only,
    verifier: only ? parts[0].verifier : null,
    publicKey65: only && parts[0].keyData ? parts[0].keyData.slice(0, 65) : null,
  }
}

/** Rule 0 must be exactly one External secp256r1 signer. Other rule ids are not rejected. */
export function assertOnlyPasskeyDefaultSigner(
  rule: unknown,
  expected: { verifier: string; publicKey65: Uint8Array },
): void {
  if (!rule || typeof rule !== "object") {
    throw new Error("Default context rule is missing.")
  }
  const id = (rule as { id?: unknown }).id
  if (id !== undefined && id !== DEFAULT_CONTEXT_RULE_ID) {
    throw new Error("Expected the default context rule.")
  }
  const summary = summarizeDefaultRule(rule)
  if (summary.signerCount !== 1 || !summary.onlyPasskeyExternal) {
    throw new Error("Default context rule must have exactly one passkey signer.")
  }
  if (summary.verifier !== expected.verifier) {
    throw new Error("Default signer verifier does not match the WebAuthn verifier.")
  }
  const pk = summary.publicKey65
  if (!pk || pk.length !== expected.publicKey65.length) {
    throw new Error("On-chain passkey public key does not match this passkey.")
  }
  for (let i = 0; i < pk.length; i++) {
    if (pk[i] !== expected.publicKey65[i]) {
      throw new Error("On-chain passkey public key does not match this passkey.")
    }
  }
}

const SECRET_FIELD = /(?:^|_)(secret|seed|private_?key|encrypted_?seed|hkdf)(?:$|_)/i
const STELLAR_SECRET = /^S[A-Z2-7]{55}$/

export type WalletMaterialExport = {
  tables: Record<string, Array<Record<string, unknown>>>
  responses: unknown[]
}

function walk(value: unknown, onField: (key: string | null, value: unknown) => void, key: string | null = null): void {
  onField(key, value)
  if (Array.isArray(value)) {
    for (const item of value) walk(item, onField, key)
    return
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) walk(child, onField, childKey)
  }
}

/**
 * True when a database export plus API payloads contain a Stellar secret or a
 * field that holds key material. A secp256r1 public key and a credential id do not.
 */
export function exportCanRebuildSigningCapability(snapshot: WalletMaterialExport): boolean {
  let found = false
  const visit = (root: unknown) => {
    walk(root, (key, value) => {
      if (key && SECRET_FIELD.test(key) && value != null && value !== "") found = true
      if (typeof value === "string" && STELLAR_SECRET.test(value.trim())) found = true
    })
  }
  visit(snapshot.tables)
  for (const response of snapshot.responses) visit(response)
  return found
}
