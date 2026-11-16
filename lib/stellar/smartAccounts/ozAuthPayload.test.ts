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

function entry(nonce: string): xdr.SorobanAuthorizationEntry {
  const credentials = new xdr.SorobanAddressCredentials({
    address: Address.fromString(Keypair.random().publicKey()).toScAddress(),
    nonce: xdr.Int64.fromString(nonce),
    signatureExpirationLedger: 100,
    signature: xdr.ScVal.scvVoid(),
  })
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(credentials),
    rootInvocation: invocation(),
  })
}

describe("sorobanSignaturePayloadFromEntry", () => {
  it("hashes address credentials into a 32-byte payload that changes with the nonce", () => {
    const first = sorobanSignaturePayloadFromEntry({
      networkPassphrase: Networks.TESTNET,
      entry: entry("1"),
    })
    const second = sorobanSignaturePayloadFromEntry({
      networkPassphrase: Networks.TESTNET,
      entry: entry("2"),
    })
    expect(first).toHaveLength(32)
    expect(second).toHaveLength(32)
    expect(Buffer.compare(first, second)).not.toBe(0)
  })
})
