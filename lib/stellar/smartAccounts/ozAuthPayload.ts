import { hash, xdr } from "@stellar/stellar-sdk"
import base64url from "base64url"

function addressCredentials(entry: xdr.SorobanAuthorizationEntry): xdr.SorobanAddressCredentials {
  const credentials = entry.credentials
  if (credentials.type === "sorobanCredentialsAddress") return credentials.address
  if (credentials.type === "sorobanCredentialsAddressV2") return credentials.addressV2
  throw new Error("Soroban auth entry is not address credentials")
}

/** XDR-encode Vec<u32> the same way Soroban `ToXdr` does for context_rule_ids. */
export function contextRuleIdsToXdr(ruleIds: number[]): Buffer {
  return Buffer.from(xdr.ScVal.scvVec(ruleIds.map((id) => xdr.ScVal.scvU32(id))).toXdr())
}

/**
 * OZ smart-account WASM (3e51f5b2…) binds rule selection into the signed digest:
 * auth_digest = sha256(signature_payload || context_rule_ids.to_xdr())
 */
export function computeOzAuthDigest(
  signaturePayload32: Buffer,
  contextRuleIds: number[],
): Buffer {
  const preimage = Buffer.concat([signaturePayload32, contextRuleIdsToXdr(contextRuleIds)])
  return Buffer.from(hash(preimage))
}

/**
 * Soroban host signature_payload for a SorobanAuthorizationEntry (32-byte hash).
 * Address v2 credentials bind the account address into the preimage. Signing the
 * v1 preimage makes __check_auth reject a passkey that is otherwise valid.
 */
export function sorobanSignaturePayloadFromEntry(params: {
  networkPassphrase: string
  entry: xdr.SorobanAuthorizationEntry
}): Buffer {
  const credentials = params.entry.credentials
  const isV2 = credentials.type === "sorobanCredentialsAddressV2"
  const addressCreds = isV2 ? credentials.addressV2 : addressCredentials(params.entry)
  const networkId = hash(Buffer.from(params.networkPassphrase))
  const preimage = isV2
    ? xdr.HashIdPreimage.envelopeTypeSorobanAuthorizationWithAddress(
        new xdr.HashIdPreimageSorobanAuthorizationWithAddress({
          networkId,
          nonce: addressCreds.nonce,
          signatureExpirationLedger: addressCreds.signatureExpirationLedger,
          address: addressCreds.address,
          invocation: params.entry.rootInvocation,
        }),
      )
    : xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
        new xdr.HashIdPreimageSorobanAuthorization({
          networkId,
          nonce: addressCreds.nonce,
          signatureExpirationLedger: addressCreds.signatureExpirationLedger,
          invocation: params.entry.rootInvocation,
        }),
      )
  return Buffer.from(hash(preimage.toXdr()))
}

/** WebAuthn challenge (base64url) for OZ passkey signing on new smart-account WASM. */
export function ozWebAuthnChallengeFromEntry(params: {
  networkPassphrase: string
  entry: xdr.SorobanAuthorizationEntry
  contextRuleIds: number[]
}): string {
  const signaturePayload = sorobanSignaturePayloadFromEntry({
    networkPassphrase: params.networkPassphrase,
    entry: params.entry,
  })
  const authDigest = computeOzAuthDigest(signaturePayload, params.contextRuleIds)
  return base64url(authDigest)
}

/**
 * New OZ AuthPayload: map { context_rule_ids, signers } on credentials.signature.
 */
export function buildOzAuthPayloadScVal(
  signerEntries: xdr.ScMapEntry[],
  contextRuleIds: number[],
): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("context_rule_ids"),
      val: xdr.ScVal.scvVec(contextRuleIds.map((id) => xdr.ScVal.scvU32(id))),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signers"),
      val: xdr.ScVal.scvMap(signerEntries),
    }),
  ])
}

function authContextCount(invocation: xdr.SorobanAuthorizedInvocation): number {
  let count = 1
  for (const sub of invocation.subInvocations) {
    count += authContextCount(sub)
  }
  return count
}

/**
 * Rule IDs for wallets deployed via deployOzSmartAccountForUser (Default rule id 0).
 * OZ requires one id per auth context. A plain USDC transfer is one context → [0].
 */
export function defaultContextRuleIdsForEntry(
  entry: xdr.SorobanAuthorizationEntry,
): number[] {
  const count = Math.max(1, authContextCount(entry.rootInvocation))
  return Array.from({ length: count }, () => 0)
}
