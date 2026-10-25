import { p256 } from "@noble/curves/p256"
import { StrKey } from "@stellar/stellar-sdk"

const CHEQUE_BODY_BYTES = 179
const CHEQUE_SIGNATURE_BYTES = 64
const DEVICE_KEY_BYTES = 33
const OWNER_BYTES = 32
const VAULT_BYTES = 32
const NOTE_ID_BYTES = 16
const PAYEE_BYTES = 32
const U64_MAX = BigInt("0xffffffffffffffff")
const U32_MASK = BigInt("0xffffffff")
const SHIFT_32 = BigInt(32)

export type DepositRecord = {
  owner: Uint8Array
  caller: Uint8Array
  deviceKey: Uint8Array
  signature: Uint8Array | null
}

export type ChequeFields = {
  network: number
  vault: Uint8Array
  noteId: Uint8Array
  amount: bigint
  fee: bigint
  cap: bigint
  expiry: bigint
  payee: Uint8Array
}

export function deposit(input: {
  classicAccount: string | null
  deviceKey: Uint8Array
  deviceKeySignature?: Uint8Array | null
  chequeBody?: Uint8Array | null
}): DepositRecord | null {
  if (!input.classicAccount || !StrKey.isValidEd25519PublicKey(input.classicAccount)) {
    return null
  }
  const owner = Uint8Array.from(StrKey.decodeEd25519PublicKey(input.classicAccount))
  const deviceKey = Uint8Array.from(input.deviceKey)
  const compressed = deviceKey.length === DEVICE_KEY_BYTES ? deviceKey : null
  return {
    owner,
    caller: owner.slice(),
    deviceKey,
    signature: verifiedSignature(compressed, input.deviceKeySignature, input.chequeBody),
  }
}

export function pendingCheque(
  stored: DepositRecord | null,
  fields: ChequeFields,
): { frame: string; status: "pending" } | null {
  if (!stored) return null
  const body = encodeChequeBody(stored, fields)
  if (!body) return null
  const signature = verifiedSignature(
    stored.deviceKey.length === DEVICE_KEY_BYTES ? stored.deviceKey : null,
    stored.signature,
    body,
  )
  if (!signature) return null
  const wire = new Uint8Array(CHEQUE_BODY_BYTES + CHEQUE_SIGNATURE_BYTES)
  wire.set(body, 0)
  wire.set(signature, CHEQUE_BODY_BYTES)
  return { frame: `SOZU1:${base64url(wire)}`, status: "pending" }
}

function encodeChequeBody(stored: DepositRecord, fields: ChequeFields): Uint8Array | null {
  const body = new Uint8Array(CHEQUE_BODY_BYTES)
  body[0] = 1
  if (!writeByte(body, 1, fields.network)) return null
  if (!writeFixed(body, 2, fields.vault, VAULT_BYTES)) return null
  if (!writeFixed(body, 34, fields.noteId, NOTE_ID_BYTES)) return null
  if (!writeU64(body, 50, fields.amount)) return null
  if (!writeU64(body, 58, fields.fee)) return null
  if (!writeU64(body, 66, fields.cap)) return null
  if (!writeU64(body, 74, fields.expiry)) return null
  if (!writeFixed(body, 82, fields.payee, PAYEE_BYTES)) return null
  if (!writeFixed(body, 114, stored.owner, OWNER_BYTES)) return null
  if (!writeFixed(body, 146, stored.deviceKey, DEVICE_KEY_BYTES)) return null
  return body
}

function writeByte(body: Uint8Array, offset: number, value: number): boolean {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) return false
  body[offset] = value
  return true
}

function writeFixed(body: Uint8Array, offset: number, bytes: Uint8Array, length: number): boolean {
  if (bytes.length !== length) return false
  body.set(bytes, offset)
  return true
}

function writeU64(body: Uint8Array, offset: number, value: bigint): boolean {
  if (value < BigInt(0) || value > U64_MAX) return false
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
  view.setUint32(offset, Number(value & U32_MASK), true)
  view.setUint32(offset + 4, Number(value >> SHIFT_32), true)
  return true
}

function base64url(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

function verifiedSignature(
  deviceKey: Uint8Array | null,
  signature: Uint8Array | null | undefined,
  chequeBody: Uint8Array | null | undefined,
): Uint8Array | null {
  if (!deviceKey || !chequeBody || signature?.length !== CHEQUE_SIGNATURE_BYTES) return null
  try {
    const ok = p256.verify(signature, chequeBody, deviceKey, { prehash: true, lowS: true })
    return ok ? Uint8Array.from(signature) : null
  } catch {
    return null
  }
}
