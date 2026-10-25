import { StrKey } from "@stellar/stellar-sdk"

const CHEQUE_SIGNATURE_BYTES = 64

export type DepositRecord = {
  owner: Uint8Array
  caller: Uint8Array
  deviceKey: Uint8Array
  signature: Uint8Array | null
}

export function deposit(input: {
  classicAccount: string
  deviceKey: Uint8Array
  deviceKeySignature?: Uint8Array | null
  passkeyAssertion?: Uint8Array | null
}): DepositRecord {
  const owner = Uint8Array.from(StrKey.decodeEd25519PublicKey(input.classicAccount))
  const deviceKeySignature = input.deviceKeySignature
  const signature =
    deviceKeySignature?.length === CHEQUE_SIGNATURE_BYTES
      ? Uint8Array.from(deviceKeySignature)
      : null
  return {
    owner,
    caller: owner.slice(),
    deviceKey: Uint8Array.from(input.deviceKey),
    signature,
  }
}
