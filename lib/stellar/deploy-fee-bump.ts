import "server-only"

import { Address, Networks, Transaction, TransactionBuilder, rpc, xdr } from "@stellar/stellar-sdk"
import { resolveSorobanRpcUrl } from "@/lib/stellar/soroban-env"
import { getFunderKeypair } from "@/lib/stellar/soroban-fee-payer"
import { ozKitDeployerKeypair } from "@/lib/stellar/smartAccounts/ozPin"
import { contractIdForDeploySalt } from "@/lib/stellar/smartAccounts/ozContractId"
import { getOzSmartAccountConfig } from "@/lib/stellar/smartAccounts/ozConfig"

/** Cap on what the funder will pay for one deploy, in stroops (0.05 XLM). */
export const SPONSORED_DEPLOY_FEE = "500000"

/** Same passphrase the kit receives from `/api/smart-accounts/config`. */
export function sponsoredDeployNetworkPassphrase(): string {
  return process.env.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET
}

export class SponsoredDeployRejected extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SponsoredDeployRejected"
  }
}

/** Deploy envelopes must be sourced by the kit deployer, never a user G. */
export function assertSponsoredDeploySource(source: string): void {
  const deployer = ozKitDeployerKeypair().publicKey()
  if (source.trim() !== deployer) {
    throw new SponsoredDeployRejected("Deploy transaction must be sourced by the OpenZeppelin deployer, not a user key.")
  }
}

export type SponsoredCreateContract = {
  salt: Buffer
  wasmHashHex: string
  contractId: string
}

function saltMatches(salt: Buffer, allowedSalts: Buffer[]): boolean {
  return allowedSalts.some((allowed) => allowed.length === salt.length && allowed.equals(salt))
}

/**
 * The envelope must be one create-contract for this user's salt and the pinned WASM.
 * The deployer key is public, so a source check alone would let any session spend funder fees.
 */
export function assertSponsoredCreateContract(
  tx: Transaction,
  params: { allowedSalts: Buffer[]; wasmHashHex: string; networkPassphrase: string },
): SponsoredCreateContract {
  assertSponsoredDeploySource(tx.source)
  if (tx.operations.length !== 1) {
    throw new SponsoredDeployRejected("Deploy envelope must contain one operation.")
  }
  const op = tx.operations[0]
  if (op.type !== "invokeHostFunction" || !("func" in op) || !op.func) {
    throw new SponsoredDeployRejected("Deploy envelope must create a smart account.")
  }
  const func = op.func
  const switchName = func.switch().name
  const args =
    switchName === "hostFunctionTypeCreateContractV2"
      ? func.createContractV2()
      : switchName === "hostFunctionTypeCreateContract"
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
  const deployer = Address.fromScAddress(fromAddress.address()).toString()
  assertSponsoredDeploySource(deployer)
  const salt = Buffer.from(fromAddress.salt())
  if (!saltMatches(salt, params.allowedSalts)) {
    throw new SponsoredDeployRejected("Deploy salt does not match this account.")
  }
  const executable = args.executable()
  if (executable.switch().name !== "contractExecutableWasm") {
    throw new SponsoredDeployRejected("Deploy envelope must use the smart-account WASM.")
  }
  const wasmHashHex = Buffer.from(executable.wasmHash()).toString("hex")
  if (wasmHashHex.toLowerCase() !== params.wasmHashHex.trim().toLowerCase()) {
    throw new SponsoredDeployRejected("Deploy WASM does not match the pinned smart-account hash.")
  }
  const contractId = contractIdForDeploySalt({
    salt,
    networkPassphrase: params.networkPassphrase,
    deployerPublicKey: deployer,
  })
  return { salt, wasmHashHex, contractId }
}

async function contractAlreadyDeployed(rpcUrl: string, contractId: string, allowHttp: boolean): Promise<boolean> {
  try {
    await new rpc.Server(rpcUrl, { allowHttp }).getContractData(
      contractId,
      xdr.ScVal.scvLedgerKeyContractInstance(),
    )
    return true
  } catch {
    return false
  }
}

/**
 * Fee-bump a deployer-signed smart-account deploy so the Sozu funder pays.
 * The user account is not the source and holds no XLM.
 */
export async function submitSponsoredDeploy(
  signedInnerXdr: string,
  allowedSalts: Buffer[],
): Promise<{ hash: string | null; feePayer: string; alreadyDeployed: boolean; contractId: string }> {
  if (allowedSalts.length === 0) {
    throw new SponsoredDeployRejected("No passkey on this account can be sponsored.")
  }
  const passphrase = sponsoredDeployNetworkPassphrase()
  const parsed = TransactionBuilder.fromXDR(signedInnerXdr, passphrase)
  if (!(parsed instanceof Transaction)) {
    throw new SponsoredDeployRejected("Deploy envelope must be an inner transaction.")
  }
  const wasmHashHex = getOzSmartAccountConfig().accountWasmHash
  const deploy = assertSponsoredCreateContract(parsed, {
    allowedSalts,
    wasmHashHex,
    networkPassphrase: passphrase,
  })
  const funder = getFunderKeypair()
  if (!funder) {
    throw new Error("STELLAR_FUNDER_SECRET is required to sponsor smart account deploy.")
  }
  const allowHttp = process.env.STELLAR_NETWORK !== "public"
  const rpcUrl = resolveSorobanRpcUrl()
  if (await contractAlreadyDeployed(rpcUrl, deploy.contractId, allowHttp)) {
    return { hash: null, feePayer: funder.publicKey(), alreadyDeployed: true, contractId: deploy.contractId }
  }
  const bump = TransactionBuilder.buildFeeBumpTransaction(funder, SPONSORED_DEPLOY_FEE, parsed, passphrase)
  bump.sign(funder)
  const server = new rpc.Server(rpcUrl, { allowHttp })
  const result = await server.sendTransaction(bump)
  if (result.status === "ERROR") {
    const detail = "errorResult" in result ? JSON.stringify(result.errorResult) : result.status
    throw new Error(`Deploy submit failed: ${detail}`)
  }
  if (!result.hash) throw new Error("No transaction hash from Soroban RPC")
  return { hash: result.hash, feePayer: funder.publicKey(), alreadyDeployed: false, contractId: deploy.contractId }
}
