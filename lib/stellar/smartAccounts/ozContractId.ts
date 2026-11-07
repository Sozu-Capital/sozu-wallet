import { Address, hash, StrKey, xdr } from "@stellar/stellar-sdk"
import base64url from "base64url"

/** Per-user deploy salt so a new account does not reuse another user's C for the same passkey. */
export function ozDeploySalt(credentialId: string, userId: string): Buffer {
  const credBuf = base64url.toBuffer(credentialId)
  return hash(Buffer.concat([credBuf, Buffer.from(userId.trim(), "utf8")]))
}

export function deriveOzContractIdForUser(params: {
  credentialId: string
  userId: string
  networkPassphrase: string
  deployerPublicKey: string
}): string {
  const salt = ozDeploySalt(params.credentialId, params.userId)
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: hash(Buffer.from(params.networkPassphrase)),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: Address.fromString(params.deployerPublicKey).toScAddress(),
          salt,
        }),
      ),
    }),
  )
  return StrKey.encodeContract(hash(preimage.toXDR()))
}

export function contractIdForDeploySalt(params: {
  salt: Buffer
  networkPassphrase: string
  deployerPublicKey: string
}): string {
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: hash(Buffer.from(params.networkPassphrase)),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: Address.fromString(params.deployerPublicKey).toScAddress(),
          salt: params.salt,
        }),
      ),
    }),
  )
  return StrKey.encodeContract(hash(preimage.toXDR()))
}
