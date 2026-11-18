import "server-only"

import {
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

function saltMatches(salt: Uint8Array, allowedSalts: Uint8Array[]): boolean {
  return allowedSalts.some(
    (allowed) => allowed.length === salt.length && Buffer.compare(Buffer.from(allowed), Buffer.from(salt)) === 0,
  )
}

function readCreateContract(tx: Transaction): { salt: Buffer; wasmHashHex: string } {
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
  const kind = func.switch().name
  const args =
    kind === "hostFunctionTypeCreateContractV2"
      ? func.createContractV2()
      : kind === "hostFunctionTypeCreateContract"
        ? func.createContract()
        : null
  if (!args) {
    throw new SponsoredDeployRejected("Deploy envelope must create a smart account.")
  }
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
  }
}

export function validatedSponsoredCreate(
  signedInnerXdr: string,
  allowedSalts: Buffer[],
  expectedWasm: string,
  passphrase: string,
): { contractId: string; transaction: Transaction } {
  if (allowedSalts.length === 0) {
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
  if (!saltMatches(created.salt, allowedSalts)) {
    throw new SponsoredDeployRejected("Deploy salt does not match this account.")
  }
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
  allowedSalts: Buffer[],
): Promise<{ hash: string | null; alreadyDeployed: boolean; contractId: string }> {
  const passphrase = stellarNetworkPassphrase()
  const { transaction: parsed, contractId } = validatedSponsoredCreate(
    signedInnerXdr,
    allowedSalts,
    getOzSmartAccountConfig().accountWasmHash,
    passphrase,
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
