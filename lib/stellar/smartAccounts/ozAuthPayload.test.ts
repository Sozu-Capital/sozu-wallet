import { describe, expect, it } from "vitest"
import { Address, Asset, Contract, Keypair, Networks, xdr } from "@stellar/stellar-sdk"
import { sorobanSignaturePayloadFromEntry } from "@/lib/stellar/smartAccounts/ozAuthPayload"

function invocation(): xdr.SorobanAuthorizedInvocation {
  const contract = new Contract(new Asset("USDC", Keypair.random().publicKey()).contractId(Networks.TESTNET))
  return new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: contract.address().toScAddress(),
        functionName: "transfer",
        args: [],
      }),
    ),
    subInvocations: [],
  })
}

function entry(version: "v1" | "v2"): xdr.SorobanAuthorizationEntry {
  const credentials = new xdr.SorobanAddressCredentials({
    address: Address.fromString(Keypair.random().publicKey()).toScAddress(),
    nonce: xdr.Int64.fromString("1"),
    signatureExpirationLedger: 100,
    signature: xdr.ScVal.scvVoid(),
  })
  return new xdr.SorobanAuthorizationEntry({
    credentials:
      version === "v2"
        ? xdr.SorobanCredentials.sorobanCredentialsAddressV2(credentials)
        : xdr.SorobanCredentials.sorobanCredentialsAddress(credentials),
    rootInvocation: invocation(),
  })
}

describe("sorobanSignaturePayloadFromEntry", () => {
  it("binds the account address for v2 credentials", () => {
    const v2 = entry("v2")
    const v1 = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(v2.credentials.addressV2),
      rootInvocation: v2.rootInvocation,
    })
    const payloadV2 = sorobanSignaturePayloadFromEntry({
      networkPassphrase: Networks.TESTNET,
      entry: v2,
    })
    const payloadV1 = sorobanSignaturePayloadFromEntry({
      networkPassphrase: Networks.TESTNET,
      entry: v1,
    })
    expect(payloadV2).toHaveLength(32)
    expect(payloadV1).toHaveLength(32)
    expect(Buffer.compare(payloadV2, payloadV1)).not.toBe(0)
  })
})
