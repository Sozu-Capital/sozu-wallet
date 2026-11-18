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
const verifier = "CBLAYYWZ2PNEXNMZXTOPKYJJQNM3ZJ642DDNPX7MARI7ZNV53LANXJXU"
const publicKey = Buffer.alloc(65, 9)
publicKey[0] = 4

function constructorFor(key: Buffer): xdr.ScVal[] {
  return [
    xdr.ScVal.scvVec([
      xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol("External"),
        Address.fromString(verifier).toScVal(),
        xdr.ScVal.scvBytes(Buffer.concat([key, Buffer.from("cred")])),
      ]),
    ]),
    xdr.ScVal.scvMap([]),
  ]
}

function createContractXdr(salt: Buffer, wasmHash: Buffer, constructorArgs: xdr.ScVal[] = []): string {
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
            constructorArgs,
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
      createContractXdr(salt, wasm, constructorFor(publicKey)),
      [{ salt, publicKey }],
      wasm.toString("hex"),
      Networks.PUBLIC,
      verifier,
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
        createContractXdr(Buffer.alloc(32, 7), wasm, constructorFor(publicKey)),
        [{ salt, publicKey }],
        wasm.toString("hex"),
        Networks.PUBLIC,
        verifier,
      ),
    ).toThrow(SponsoredDeployRejected)

    expect(() =>
      validatedSponsoredCreate(
        createContractXdr(salt, Buffer.alloc(32, 9), constructorFor(publicKey)),
        [{ salt, publicKey }],
        wasm.toString("hex"),
        Networks.PUBLIC,
        verifier,
      ),
    ).toThrow(/WASM/)

    const otherKey = Buffer.alloc(65, 3)
    otherKey[0] = 4
    expect(() =>
      validatedSponsoredCreate(
        createContractXdr(salt, wasm, constructorFor(otherKey)),
        [{ salt, publicKey }],
        wasm.toString("hex"),
        Networks.PUBLIC,
        verifier,
      ),
    ).toThrow(/passkey/)
  })
})
