import "server-only"

import { Address, Contract, TransactionBuilder, rpc, scValToNative, xdr } from "@stellar/stellar-sdk"
import { Api } from "@stellar/stellar-sdk/rpc"
import type { StellarNetwork } from "@/lib/stellar/asset-types"
import { extractSorobanDataXdr } from "@/lib/stellar/soroban-prepared-envelope"
import { minorToI128ScVal } from "@/lib/withdraw/amount"
import { networkPassphraseFor } from "@/lib/withdraw/usdc-asset"

/**
 * SAC transfer builder for an exact i128 amount. `sendToken` in send-token.ts converts the amount
 * through parseFloat, which can't represent every 7-decimal balance; a full-balance withdraw must
 * move the exact on-chain value, so it is built here from a bigint.
 */

function getSorobanRpcServer(network: StellarNetwork): rpc.Server {
  const url =
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (network === "testnet" ? "https://soroban-testnet.stellar.org" : "https://soroban.stellar.org")
  return new rpc.Server(url, { allowHttp: network === "testnet" })
}

/** Reads `balance(holder)` by simulation. Throws instead of guessing 0 when the read fails. */
export async function readExactTokenBalance(params: {
  contractId: string
  holder: string
  sourceAccount: string
  network: StellarNetwork
}): Promise<bigint> {
  const server = getSorobanRpcServer(params.network)
  const account = await server.getAccount(params.sourceAccount)
  const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: networkPassphraseFor(params.network) })
    .addOperation(new Contract(params.contractId).call("balance", Address.fromString(params.holder).toScVal()))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (!Api.isSimulationSuccess(sim) || !sim.result?.retval) {
    const detail = Api.isSimulationError(sim) ? sim.error : "no result"
    throw new Error(`balance() simulation failed: ${String(detail).slice(0, 300)}`)
  }
  const value = scValToNative(sim.result.retval as xdr.ScVal)
  if (typeof value !== "bigint" || value < BigInt(0)) throw new Error("balance() returned a non-i128 value")
  return value
}

/** Builds and prepares `transfer(from, to, amountMinor)`; `to` may be G…, M… or C…. */
export async function buildExactTokenTransfer(params: {
  contractId: string
  from: string
  to: string
  amountMinor: bigint
  feePayer: string
  network: StellarNetwork
}): Promise<{ unsignedXdr: string; sorobanDataXdr: string | null }> {
  if (!/^G[A-Z2-7]{55}$/.test(params.feePayer)) throw new Error("feePayer must be a classic G address.")
  const server = getSorobanRpcServer(params.network)
  const networkPassphrase = networkPassphraseFor(params.network)
  const account = await server.getAccount(params.feePayer)
  const rawTx = new TransactionBuilder(account, { fee: "100", networkPassphrase })
    .addOperation(
      new Contract(params.contractId).call(
        "transfer",
        Address.fromString(params.from).toScVal(),
        Address.fromString(params.to).toScVal(),
        minorToI128ScVal(params.amountMinor),
      ),
    )
    .setTimeout(30)
    .build()
  const prepared = await server.prepareTransaction(rawTx)
  const unsignedXdr = prepared.toEnvelope().toXDR("base64")
  return { unsignedXdr, sorobanDataXdr: extractSorobanDataXdr(unsignedXdr, networkPassphrase) }
}

/** True when a contract instance exists at `contractId` (a C destination that was never deployed would strand funds). */
export async function contractInstanceExists(contractId: string, network: StellarNetwork): Promise<boolean> {
  const server = getSorobanRpcServer(network)
  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: Address.fromString(contractId).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  )
  const res = await server.getLedgerEntries(key)
  return res.entries.length > 0
}
