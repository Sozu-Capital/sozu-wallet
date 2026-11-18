import "server-only"

import {
  Address,
  Keypair,
  StrKey,
  Transaction,
  TransactionBuilder,
  hash,
  rpc,
  xdr,
} from "@stellar/stellar-sdk"
import { getFunderKeypair } from "@/lib/stellar/soroban-fee-payer"
import {
  deploymentStellarNetwork,
  resolveSorobanRpcUrlForNetwork,
  stellarNetworkPassphrase,
} from "@/lib/stellar/network-env"
import { getOzSmartAccountConfig } from "@/lib/stellar/smartAccounts/ozConfig"
import { contractIdForDeploySalt } from "@/lib/stellar/smartAccounts/oz-deploy-id"
import { xdrBytes, xdrField, xdrType } from "@/lib/stellar/xdr-access"

/** Above this, the fee payer refuses to sponsor one account create. 5 XLM. */
const MAX_SPONSORED_FEE_STROOPS = BigInt(50_000_000)

/**
 * The kit deployer is a public, deterministic key. It holds no spendable XLM on
 * mainnet, so the Sozu fee payer has to wrap the create.
 */
export function ozKitDeployerPublicKey(): string {
  return Keypair.fromRawEd25519Seed(hash(Buffer.from("openzeppelin-smart-account-kit"))).publicKey()
}

export class SponsoredDeployRejected extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SponsoredDeployRejected"
  }
}

export type SponsoredPasskey = {
  salt: Buffer
  publicKey: Buffer
}

function saltMatches(salt: Uint8Array, allowedSalts: Uint8Array[]): boolean {
  return allowedSalts.some(
    (allowed) => allowed.length === salt.length && Buffer.compare(Buffer.from(allowed), Buffer.from(salt)) === 0,
  )
}

function scVec(value: xdr.ScVal | undefined): xdr.ScVal[] | null {
  if (!value || xdrType(value) !== "scvVec") return null
  const items = xdrField<xdr.ScVal[] | null>(value, "vec")
  return items ? [...items] : null
}

function assertUserConstructor(
  constructorArgs: xdr.ScVal[],
  publicKey: Buffer,
  verifierContractId: string,
): void {
  if (constructorArgs.length !== 2) {
    throw new SponsoredDeployRejected("Deploy constructor must install this account's passkey.")
  }
  const signerList = scVec(constructorArgs[0])
  const signerParts = signerList?.length === 1 ? scVec(signerList[0]) : null
  if (!signerParts || signerParts.length !== 3) {
    throw new SponsoredDeployRejected("Deploy constructor must install exactly one signer.")
  }
  const [tag, verifier, keyData] = signerParts
  const tagName = tag && xdrType(tag) === "scvSymbol" ? xdrField<{ toString(): string }>(tag, "sym").toString() : null
  if (tagName !== "External") {
    throw new SponsoredDeployRejected("Deploy constructor must install an External passkey signer.")
  }
  if (!verifier || xdrType(verifier) !== "scvAddress") {
    throw new SponsoredDeployRejected("Deploy constructor must use the WebAuthn verifier.")
  }
  const verifierAddress = Address.fromScVal(verifier).toString().trim().toUpperCase()
  if (verifierAddress !== verifierContractId.trim().toUpperCase()) {
    throw new SponsoredDeployRejected("Deploy constructor must use the WebAuthn verifier.")
  }
  const rawKey = keyData && xdrType(keyData) === "scvBytes" ? xdrBytes(xdrField(keyData, "bytes")) : null
  if (!rawKey || rawKey.length < 66 || !rawKey.subarray(0, 65).equals(publicKey)) {
    throw new SponsoredDeployRejected("Deploy constructor signer is not this account's passkey.")
  }
  const policies = constructorArgs[1] && xdrType(constructorArgs[1]) === "scvMap"
    ? xdrField<unknown[] | null>(constructorArgs[1], "map")
    : null
  if (!policies || policies.length !== 0) {
    throw new SponsoredDeployRejected("Deploy constructor must not install extra policies.")
  }
}

function readCreateContract(tx: Transaction): {
  salt: Buffer
  wasmHashHex: string
  constructorArgs: xdr.ScVal[]
} {
  if (tx.operations.length !== 1) {
    throw new SponsoredDeployRejected("Deploy envelope must contain one operation.")
  }
  const op = tx.operations[0]
  if (op.type !== "invokeHostFunction") {
    throw new SponsoredDeployRejected("Deploy envelope must create a smart account.")
  }
  const func = xdrField<object | undefined>(op, "func")
  if (!func || xdrType(func) !== "hostFunctionTypeCreateContractV2") {
    throw new SponsoredDeployRejected("Deploy envelope must create a smart account.")
  }
  const args = xdrField<object>(func, "createContractV2")
  const preimage = xdrField<object>(args, "contractIdPreimage")
  if (xdrType(preimage) !== "contractIdPreimageFromAddress") {
    throw new SponsoredDeployRejected("Deploy envelope must create an address-salted contract.")
  }
  const fromAddress = xdrField<object>(preimage, "fromAddress")
  const address = xdrField<object>(fromAddress, "address")
  if (xdrType(address) !== "scAddressTypeAccount") {
    throw new SponsoredDeployRejected("Deploy transaction must be sourced by the OpenZeppelin deployer.")
  }
  const accountId = xdrField<object>(address, "accountId")
  if (xdrType(accountId) !== "publicKeyTypeEd25519") {
    throw new SponsoredDeployRejected("Deploy transaction must be sourced by the OpenZeppelin deployer.")
  }
  const deployerBytes = xdrBytes(xdrField(accountId, "ed25519"))
  const expected = Buffer.from(StrKey.decodeEd25519PublicKey(ozKitDeployerPublicKey()))
  if (!deployerBytes.equals(expected)) {
    throw new SponsoredDeployRejected("Deploy transaction must be sourced by the OpenZeppelin deployer.")
  }
  const executable = xdrField<object>(args, "executable")
  if (xdrType(executable) !== "contractExecutableWasm") {
    throw new SponsoredDeployRejected("Deploy envelope must use the smart-account WASM.")
  }
  return {
    salt: xdrBytes(xdrField(fromAddress, "salt")),
    wasmHashHex: xdrBytes(xdrField(executable, "wasmHash")).toString("hex"),
    constructorArgs: xdrField<xdr.ScVal[]>(args, "constructorArgs"),
  }
}

export function validatedSponsoredCreate(
  signedInnerXdr: string,
  allowedPasskeys: SponsoredPasskey[],
  expectedWasm: string,
  passphrase: string,
  verifierContractId: string,
): { contractId: string; transaction: Transaction } {
  if (allowedPasskeys.length === 0) {
    throw new SponsoredDeployRejected("No passkey on this account can be sponsored.")
  }
  const parsed = TransactionBuilder.fromXDR(signedInnerXdr, passphrase)
  if (!(parsed instanceof Transaction)) {
    throw new SponsoredDeployRejected("Deploy envelope must be an inner transaction.")
  }
  if (parsed.source !== ozKitDeployerPublicKey()) {
    throw new SponsoredDeployRejected("Deploy transaction must be sourced by the OpenZeppelin deployer.")
  }
  const created = readCreateContract(parsed)
  if (created.wasmHashHex.toLowerCase() !== expectedWasm.trim().toLowerCase()) {
    throw new SponsoredDeployRejected("Deploy WASM does not match the pinned smart-account hash.")
  }
  const passkey = allowedPasskeys.find((allowed) => saltMatches(created.salt, [allowed.salt]))
  if (!passkey) {
    throw new SponsoredDeployRejected("Deploy salt does not match this account.")
  }
  assertUserConstructor(created.constructorArgs, passkey.publicKey, verifierContractId)
  return {
    transaction: parsed,
    contractId: contractIdForDeploySalt({
      salt: created.salt,
      networkPassphrase: passphrase,
      deployerPublicKey: ozKitDeployerPublicKey(),
    }),
  }
}

export async function submitSponsoredDeploy(
  signedInnerXdr: string,
  allowedPasskeys: SponsoredPasskey[],
): Promise<{ hash: string | null; alreadyDeployed: boolean; contractId: string }> {
  const passphrase = stellarNetworkPassphrase()
  const oz = getOzSmartAccountConfig()
  const { transaction: parsed, contractId } = validatedSponsoredCreate(
    signedInnerXdr,
    allowedPasskeys,
    oz.accountWasmHash,
    passphrase,
    oz.webauthnVerifierContractId,
  )

  const network = deploymentStellarNetwork()
  const rpcUrl = resolveSorobanRpcUrlForNetwork(network)
  const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
  try {
    await server.getContractData(contractId, xdr.ScVal.scvLedgerKeyContractInstance())
    return { hash: null, alreadyDeployed: true, contractId }
  } catch {
    /* not deployed yet */
  }

  const funder = getFunderKeypair(network)
  if (!funder) {
    throw new Error("A funded fee-payer secret is required to create a mainnet smart account.")
  }
  const innerFee = BigInt(parsed.fee)
  if (innerFee > MAX_SPONSORED_FEE_STROOPS) {
    throw new SponsoredDeployRejected("Deploy fee is above what the fee payer will sponsor.")
  }
  const bump = TransactionBuilder.buildFeeBumpTransaction(
    funder.publicKey(),
    parsed.fee,
    parsed,
    passphrase,
  )
  bump.sign(funder)
  const bumpFee = BigInt(bump.fee)
  if (bumpFee > MAX_SPONSORED_FEE_STROOPS) {
    throw new SponsoredDeployRejected("Deploy fee is above what the fee payer will sponsor.")
  }

  const sent = await server.sendTransaction(bump)
  if (sent.status === "ERROR") {
    const detail = "errorResult" in sent ? JSON.stringify(sent.errorResult) : sent.status
    throw new Error(`Deploy submit failed: ${detail}`)
  }
  if (!sent.hash) throw new Error("No transaction hash from Soroban RPC")

  for (let attempt = 0; attempt < 45; attempt++) {
    try {
      const tx = await server.getTransaction(sent.hash)
      if (tx.status === "SUCCESS") return { hash: sent.hash, alreadyDeployed: false, contractId }
      if (tx.status === "FAILED") {
        throw new Error(`Smart account deploy was included and failed. Tx ${sent.hash}.`)
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Smart account deploy")) throw err
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return { hash: sent.hash, alreadyDeployed: false, contractId }
}
