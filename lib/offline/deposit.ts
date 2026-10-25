import { p256 } from "@noble/curves/p256"
import { StrKey } from "@stellar/stellar-sdk"

const CHEQUE_SIGNATURE_BYTES = 64
const DEVICE_KEY_BYTES = 33

export type DepositRecord = {
  owner: Uint8Array
  caller: Uint8Array
  deviceKey: Uint8Array
  signature: Uint8Array | null
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
