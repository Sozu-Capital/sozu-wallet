import {
  Account,
  Address,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk"
import { describe, expect, it } from "vitest"
import { ozDeploySalt } from "@/lib/stellar/smartAccounts/oz-deploy-id"
import {
  ozKitDeployerPublicKey,
  SponsoredDeployRejected,
  validatedSponsoredCreate,
} from "@/lib/stellar/sponsor-smart-account-deploy"

const credentialId = "dGVzdC1jcmVkZW50aWFs"
const userId = "11111111-1111-1111-1111-111111111111"
const wasm = Buffer.alloc(32, 4)

function createContractXdr(salt: Buffer, wasmHash: Buffer): string {
  const deployer = ozKitDeployerPublicKey()
  return new TransactionBuilder(new Account(deployer, "0"), {
    fee: "1846530",
    networkPassphrase: Networks.PUBLIC,
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
            executable: xdr.ContractExecutable.contractExecutableWasm(wasmHash),
            constructorArgs: [],
          }),
        ),
        auth: [],
      }),
    )
    .setTimeout(30)
    .build()
    .toXDR()
}

describe("sponsored smart account deploy", () => {
  const salt = ozDeploySalt(credentialId, userId)

  it("accepts this user's create and rejects a different salt or wasm", () => {
    expect(ozKitDeployerPublicKey()).toBe("GAAH4OT36RRCCAGKARGPN2HLHT2NOBVFHO4GUHA6CF7UKQ4MMV24WQ4N")
    const accepted = validatedSponsoredCreate(
      createContractXdr(salt, wasm),
      [salt],
      wasm.toString("hex"),
      Networks.PUBLIC,
    )
    expect(accepted.contractId.startsWith("C")).toBe(true)

    const bump = TransactionBuilder.buildFeeBumpTransaction(
      Keypair.random().publicKey(),
      accepted.transaction.fee,
      accepted.transaction,
      Networks.PUBLIC,
    )
    expect(BigInt(bump.fee) >= BigInt(accepted.transaction.fee)).toBe(true)

    expect(() =>
      validatedSponsoredCreate(
        createContractXdr(Buffer.alloc(32, 7), wasm),
        [salt],
        wasm.toString("hex"),
        Networks.PUBLIC,
      ),
    ).toThrow(SponsoredDeployRejected)

    expect(() =>
      validatedSponsoredCreate(
        createContractXdr(salt, Buffer.alloc(32, 9)),
        [salt],
        wasm.toString("hex"),
        Networks.PUBLIC,
      ),
    ).toThrow(/WASM/)
  })
})
