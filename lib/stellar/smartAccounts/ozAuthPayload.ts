import { buildAuthorizationEntryPreimage, hash, xdr } from "@stellar/stellar-sdk"
import base64url from "base64url"
import { xdrField, xdrType } from "@/lib/stellar/xdr-access"

/**
 * CAP-71: RPC simulation now returns ADDRESS_V2 (the address is inside the
 * signed preimage). ADDRESS is the pre-CAP-71 arm. Both carry SorobanAddressCredentials.
 */
export function readAddressCredentials(entry: xdr.SorobanAuthorizationEntry): xdr.SorobanAddressCredentials {
  const credentials = xdrField<xdr.SorobanCredentials>(entry, "credentials")
  const type = xdrType(credentials)
  if (type === "sorobanCredentialsAddress") {
    return xdrField<xdr.SorobanAddressCredentials>(credentials, "address")
  }
  if (type === "sorobanCredentialsAddressV2") {
    return xdrField<xdr.SorobanAddressCredentials>(credentials, "addressV2")
  }
  if (type === "sorobanCredentialsAddressWithDelegates") {
    const wrapped = xdrField<object>(credentials, "addressWithDelegates")
    return xdrField<xdr.SorobanAddressCredentials>(wrapped, "addressCredentials")
  }
  throw new Error(`Soroban auth entry is not address credentials (${type ?? "unknown"})`)
}

/** Write updated address credentials back without dropping the CAP-71 arm. */
export function replaceAddressCredentials(
  entry: xdr.SorobanAuthorizationEntry,
  next: xdr.SorobanAddressCredentials,
): xdr.SorobanAuthorizationEntry {
  const credentials = xdrField<xdr.SorobanCredentials>(entry, "credentials")
  const type = xdrType(credentials)
  let nextCredentials: xdr.SorobanCredentials
  if (type === "sorobanCredentialsAddress") {
    nextCredentials = xdr.SorobanCredentials.sorobanCredentialsAddress(next)
  } else if (type === "sorobanCredentialsAddressV2") {
    nextCredentials = xdr.SorobanCredentials.sorobanCredentialsAddressV2(next)
  } else if (type === "sorobanCredentialsAddressWithDelegates") {
    const wrapped = xdrField<object>(credentials, "addressWithDelegates")
    nextCredentials = xdr.SorobanCredentials.sorobanCredentialsAddressWithDelegates(
      new xdr.SorobanAddressCredentialsWithDelegates({
        addressCredentials: next,
        delegates: xdrField<xdr.SorobanDelegateSignature[]>(wrapped, "delegates"),
      }),
    )
  } else {
    throw new Error(`Soroban auth entry is not address credentials (${type ?? "unknown"})`)
  }
  return new xdr.SorobanAuthorizationEntry({
    credentials: nextCredentials,
    rootInvocation: xdrField(entry, "rootInvocation"),
  })
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
 * ADDRESS_V2 binds the signer address into the preimage (CAP-71). ADDRESS does not.
 */
export function sorobanSignaturePayloadFromEntry(params: {
  networkPassphrase: string
  entry: xdr.SorobanAuthorizationEntry
}): Buffer {
  const addressCreds = readAddressCredentials(params.entry)
  const expiration = Number(xdrField(addressCreds, "signatureExpirationLedger"))
  const preimage = buildAuthorizationEntryPreimage(
    params.entry,
    expiration,
    params.networkPassphrase,
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
