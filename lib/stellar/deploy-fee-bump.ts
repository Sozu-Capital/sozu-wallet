import "server-only"

import { Networks, Transaction, TransactionBuilder, rpc } from "@stellar/stellar-sdk"
import { getStellarConfig } from "@/lib/turnkey/config"
import { resolveSorobanRpcUrl } from "@/lib/stellar/soroban-env"
import { getFunderKeypair } from "@/lib/stellar/soroban-fee-payer"
import { ozKitDeployerKeypair } from "@/lib/stellar/smartAccounts/ozPin"

/** Deploy envelopes must be sourced by the kit deployer, never a user G. */
export function assertSponsoredDeploySource(source: string): void {
  const deployer = ozKitDeployerKeypair().publicKey()
  if (source.trim() !== deployer) {
    throw new Error("Deploy transaction must be sourced by the OpenZeppelin deployer, not a user key.")
  }
}

/**
 * Fee-bump a deployer-signed smart-account deploy so the Sozu funder pays.
 * The user account is not the source and holds no XLM.
 */
export async function submitSponsoredDeploy(signedInnerXdr: string): Promise<{ hash: string; feePayer: string }> {
  const cfg = getStellarConfig()
  const passphrase = cfg.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
  const parsed = TransactionBuilder.fromXDR(signedInnerXdr, passphrase)
  if (!(parsed instanceof Transaction)) {
    throw new Error("Deploy envelope must be an inner transaction.")
  }
  assertSponsoredDeploySource(parsed.source)
  const funder = getFunderKeypair()
  if (!funder) {
    throw new Error("STELLAR_FUNDER_SECRET is required to sponsor smart account deploy.")
  }
  const bump = TransactionBuilder.buildFeeBumpTransaction(funder, "500000", parsed, passphrase)
  bump.sign(funder)
  const rpcUrl = resolveSorobanRpcUrl()
  const server = new rpc.Server(rpcUrl, { allowHttp: cfg.network !== "mainnet" })
  const result = await server.sendTransaction(bump)
  if (result.status === "ERROR") {
    const detail = "errorResult" in result ? JSON.stringify(result.errorResult) : result.status
    throw new Error(`Deploy submit failed: ${detail}`)
  }
  if (!result.hash) throw new Error("No transaction hash from Soroban RPC")
  return { hash: result.hash, feePayer: funder.publicKey() }
}
