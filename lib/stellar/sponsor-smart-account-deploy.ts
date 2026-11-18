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

function assertUserConstructor(
  constructorArgs: xdr.ScVal[],
  publicKey: Buffer,
  verifierContractId: string,
): void {
  if (constructorArgs.length !== 2) {
    throw new SponsoredDeployRejected("Deploy constructor must install this account's passkey.")
  }
  const signerList = constructorArgs[0]?.switch().name === "scvVec" ? constructorArgs[0].vec() : null
  const signer = signerList?.length === 1 ? signerList[0] : null
  const signerParts = signer?.switch().name === "scvVec" ? signer.vec() : null
  if (!signerParts || signerParts.length !== 3) {
    throw new SponsoredDeployRejected("Deploy constructor must install exactly one signer.")
  }
  const [tag, verifier, keyData] = signerParts
  const tagName = tag?.switch().name === "scvSymbol" ? tag.sym()?.toString() : null
  if (tagName !== "External") {
    throw new SponsoredDeployRejected("Deploy constructor must install an External passkey signer.")
  }
  if (verifier?.switch().name !== "scvAddress") {
    throw new SponsoredDeployRejected("Deploy constructor must use the WebAuthn verifier.")
  }
  const verifierAddress = Address.fromScVal(verifier).toString().trim().toUpperCase()
  if (verifierAddress !== verifierContractId.trim().toUpperCase()) {
    throw new SponsoredDeployRejected("Deploy constructor must use the WebAuthn verifier.")
  }
  const rawKey = keyData?.switch().name === "scvBytes" ? keyData.bytes() : null
  const keyBytes = rawKey ? Buffer.from(rawKey) : Buffer.alloc(0)
  if (keyBytes.length < 66 || !keyBytes.subarray(0, 65).equals(publicKey)) {
    throw new SponsoredDeployRejected("Deploy constructor signer is not this account's passkey.")
  }
  const policies = constructorArgs[1]?.switch().name === "scvMap" ? constructorArgs[1].map() : null
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
  const func = (op as { func?: xdr.HostFunction }).func
  if (!func) {
    throw new SponsoredDeployRejected("Deploy envelope must create a smart account.")
  }
  if (func.switch().name !== "hostFunctionTypeCreateContractV2") {
    throw new SponsoredDeployRejected("Deploy envelope must create a smart account.")
  }
  const args = func.createContractV2()
  const preimage = args.contractIdPreimage()
  if (preimage.switch().name !== "contractIdPreimageFromAddress") {
    throw new SponsoredDeployRejected("Deploy envelope must create an address-salted contract.")
  }
  const fromAddress = preimage.fromAddress()
  const address = fromAddress.address()
  if (address.switch().name !== "scAddressTypeAccount") {
    throw new SponsoredDeployRejected("Deploy transaction must be sourced by the OpenZeppelin deployer.")
  }
  const accountId = address.accountId()
  if (accountId.switch().name !== "publicKeyTypeEd25519") {
    throw new SponsoredDeployRejected("Deploy transaction must be sourced by the OpenZeppelin deployer.")
  }
  const deployerBytes = Buffer.from(accountId.ed25519())
  const expected = Buffer.from(StrKey.decodeEd25519PublicKey(ozKitDeployerPublicKey()))
  if (!deployerBytes.equals(expected)) {
    throw new SponsoredDeployRejected("Deploy transaction must be sourced by the OpenZeppelin deployer.")
  }
  const executable = args.executable()
  if (executable.switch().name !== "contractExecutableWasm") {
    throw new SponsoredDeployRejected("Deploy envelope must use the smart-account WASM.")
  }
  return {
    salt: Buffer.from(fromAddress.salt()),
    wasmHashHex: Buffer.from(executable.wasmHash()).toString("hex"),
    constructorArgs: args.constructorArgs(),
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
