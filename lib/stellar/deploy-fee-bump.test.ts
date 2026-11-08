import { Account, Address, Keypair, Networks, Operation, TransactionBuilder, xdr } from "@stellar/stellar-sdk"
import { describe, expect, it } from "vitest"
import {
  assertSponsoredCreateContract,
  buildSignedSponsoredFeeBump,
  SPONSORED_DEPLOY_FEE,
  sponsoredDeployNetworkPassphrase,
} from "@/lib/stellar/deploy-fee-bump"
import { resequenceOnFeePayer } from "@/lib/stellar/soroban-fee-payer"
import { ozDeploySalt } from "@/lib/stellar/smartAccounts/ozContractId"
import {
  OZ_SMART_ACCOUNT_WASM_HASH_TESTNET,
  ozKitDeployerKeypair,
} from "@/lib/stellar/smartAccounts/ozPin"

const credentialId = "dGVzdC1jcmVkZW50aWFs"
const userId = "11111111-1111-1111-1111-111111111111"

function createContractTx(salt: Buffer, wasmHex: string) {
  const deployer = ozKitDeployerKeypair().publicKey()
  const wasm = Buffer.from(wasmHex, "hex")
  return new TransactionBuilder(new Account(deployer, "0"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeCreateContractV2(
          new xdr.CreateContractArgsV2({
            contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
              new xdr.ContractIdPreimageFromAddress({
                address: Address.fromString(deployer).toScAddress(),
                salt,
              }),
            ),
            executable: xdr.ContractExecutable.contractExecutableWasm(wasm),
            constructorArgs: [],
          }),
        ),
        auth: [],
      }),
    )
    .setTimeout(30)
    .build()
}

describe("sponsored deploy envelope", () => {
  const salt = ozDeploySalt(credentialId, userId)
  const wasm = OZ_SMART_ACCOUNT_WASM_HASH_TESTNET

  it("accepts this user's create-contract and rejects anything else", () => {
    const tx = createContractTx(salt, wasm)
    const accepted = assertSponsoredCreateContract(tx, {
      allowedSalts: [salt],
      wasmHashHex: wasm,
      networkPassphrase: Networks.TESTNET,
    })
    expect(accepted.contractId.startsWith("C")).toBe(true)
    expect(accepted.wasmHashHex).toBe(wasm)

    const otherSalt = Buffer.alloc(32, 7)
    expect(() =>
      assertSponsoredCreateContract(createContractTx(otherSalt, wasm), {
        allowedSalts: [salt],
        wasmHashHex: wasm,
        networkPassphrase: Networks.TESTNET,
      }),
    ).toThrow(/salt/)

    const otherWasm = "ab".repeat(32)
    expect(() =>
      assertSponsoredCreateContract(createContractTx(salt, otherWasm), {
        allowedSalts: [salt],
        wasmHashHex: wasm,
        networkPassphrase: Networks.TESTNET,
      }),
    ).toThrow(/WASM/)
  })

  it("uses the public passphrase when STELLAR_NETWORK is public", () => {
    const previous = process.env.STELLAR_NETWORK
    process.env.STELLAR_NETWORK = "public"
    try {
      expect(sponsoredDeployNetworkPassphrase()).toBe(Networks.PUBLIC)
    } finally {
      if (previous === undefined) delete process.env.STELLAR_NETWORK
      else process.env.STELLAR_NETWORK = previous
    }
    expect(SPONSORED_DEPLOY_FEE).toBe("500000")
  })

  it("rebuilds the deployer sequence before the funder fee-bumps the deploy", async () => {
    const stale = createContractTx(salt, wasm)
    stale.sign(ozKitDeployerKeypair())
    const server = { getAccount: async (id: string) => new Account(id, "40") }
    const fresh = await resequenceOnFeePayer(server as never, stale, Networks.TESTNET)
    fresh.sign(ozKitDeployerKeypair())
    const funder = Keypair.random()
    const bump = buildSignedSponsoredFeeBump({
      inner: fresh,
      funder,
      networkPassphrase: Networks.TESTNET,
    })

    expect(fresh.sequence).toBe("41")
    expect(fresh.signatures).toHaveLength(1)
    expect(bump.innerTransaction.sequence).toBe("41")
    expect(bump.feeSource).toBe(funder.publicKey())
    expect(bump.signatures).toHaveLength(1)
  })
})
