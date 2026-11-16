import { hash, xdr } from "@stellar/stellar-sdk"
import base64url from "base64url"
import { xdrField, xdrType } from "@/lib/stellar/xdr-access"

function addressCredentials(entry: xdr.SorobanAuthorizationEntry): xdr.SorobanAddressCredentials {
  const credentials = xdrField<xdr.SorobanCredentials>(entry, "credentials")
  if (xdrType(credentials) !== "sorobanCredentialsAddress") {
    throw new Error("Soroban auth entry is not address credentials")
  }
  return xdrField<xdr.SorobanAddressCredentials>(credentials, "address")
}

/** XDR-encode Vec<u32> the same way Soroban `ToXdr` does for context_rule_ids. */
export function contextRuleIdsToXdr(ruleIds: number[]): Buffer {
  return Buffer.from(xdr.ScVal.scvVec(ruleIds.map((id) => xdr.ScVal.scvU32(id))).toXDR())
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
 * This SDK's address credentials use the single Soroban authorization preimage.
 */
export function sorobanSignaturePayloadFromEntry(params: {
  networkPassphrase: string
  entry: xdr.SorobanAuthorizationEntry
}): Buffer {
  const addressCreds = addressCredentials(params.entry)
  const networkId = hash(Buffer.from(params.networkPassphrase))
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId,
      nonce: xdrField(addressCreds, "nonce"),
      signatureExpirationLedger: xdrField(addressCreds, "signatureExpirationLedger"),
      invocation: xdrField(params.entry, "rootInvocation"),
    }),
  )
  return Buffer.from(hash(preimage.toXDR()))
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
  for (const sub of xdrField<xdr.SorobanAuthorizedInvocation[]>(invocation, "subInvocations")) {
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
  const count = Math.max(1, authContextCount(xdrField(entry, "rootInvocation")))
  return Array.from({ length: count }, () => 0)
}
