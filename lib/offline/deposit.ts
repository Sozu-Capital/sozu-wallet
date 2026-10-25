import { StrKey } from "@stellar/stellar-sdk"

export type DepositRecord = {
  owner: Uint8Array
  caller: Uint8Array
  deviceKey: Uint8Array
}

export function deposit(input: {
  classicAccount: string
  deviceKey: Uint8Array
}): DepositRecord {
  const owner = Uint8Array.from(StrKey.decodeEd25519PublicKey(input.classicAccount))
  return {
    owner,
    caller: owner.slice(),
    deviceKey: Uint8Array.from(input.deviceKey),
  }
}
