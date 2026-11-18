import { describe, expect, it } from "vitest"
import { Address, Asset, Contract, Keypair, Networks, xdr } from "@stellar/stellar-sdk"
import {
  replaceAddressCredentials,
  sorobanSignaturePayloadFromEntry,
} from "@/lib/stellar/smartAccounts/ozAuthPayload"
import { xdrField, xdrType } from "@/lib/stellar/xdr-access"

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

function credentials(nonce: string, address = Keypair.random().publicKey()): xdr.SorobanAddressCredentials {
  return new xdr.SorobanAddressCredentials({
    address: Address.fromString(address).toScAddress(),
    nonce: xdr.Int64.fromString(nonce),
    signatureExpirationLedger: 100,
    signature: xdr.ScVal.scvVoid(),
  })
}

function entry(nonce: string): xdr.SorobanAuthorizationEntry {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(credentials(nonce)),
    rootInvocation: invocation(),
  })
}

function entryV2(nonce: string, address: string, root: xdr.SorobanAuthorizedInvocation): xdr.SorobanAuthorizationEntry {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddressV2(credentials(nonce, address)),
    rootInvocation: root,
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

  it("hashes ADDRESS_V2 with the address bound in, distinct from the legacy preimage", () => {
    const address = Keypair.random().publicKey()
    const root = invocation()
    const legacy = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(credentials("7", address)),
      rootInvocation: root,
    })
    const current = entryV2("7", address, root)
    const legacyPayload = sorobanSignaturePayloadFromEntry({
      networkPassphrase: Networks.TESTNET,
      entry: legacy,
    })
    const currentPayload = sorobanSignaturePayloadFromEntry({
      networkPassphrase: Networks.TESTNET,
      entry: current,
    })
    expect(currentPayload).toHaveLength(32)
    expect(Buffer.compare(legacyPayload, currentPayload)).not.toBe(0)
  })

  it("writes the signature back onto ADDRESS_V2 instead of downgrading the arm", () => {
    const address = Keypair.random().publicKey()
    const original = entryV2("9", address, invocation())
    const next = new xdr.SorobanAddressCredentials({
      address: Address.fromString(address).toScAddress(),
      nonce: xdr.Int64.fromString("9"),
      signatureExpirationLedger: 100,
      signature: xdr.ScVal.scvU32(1),
    })
    const replaced = replaceAddressCredentials(original, next)
    const creds = xdrField<xdr.SorobanCredentials>(replaced, "credentials")
    expect(xdrType(creds)).toBe("sorobanCredentialsAddressV2")
    expect(xdrType(xdrField(xdrField(creds, "addressV2"), "signature"))).toBe("scvU32")
  })
})
