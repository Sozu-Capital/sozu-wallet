import type { MerchItemRecord, MerchNetwork } from "@/lib/merch/catalog"
import { tryGetSorobanTokenBalance } from "@/lib/stellar/soroban-token"

/** Collectible tokens use 0 decimals, same shape as the pizza token. */
const COLLECTIBLE_DECIMALS = 0

const CONTRACT_ID = /^C[A-Z2-7]{55}$/
const HOLDER_ID = /^[GC][A-Z2-7]{55}$/

export type BalanceReader = (
  contractId: string,
  holder: string,
  network: MerchNetwork,
) => Promise<number | null>

async function readDistributorBalance(
  contractId: string,
  holder: string,
  network: MerchNetwork,
): Promise<number | null> {
  return tryGetSorobanTokenBalance(contractId, holder, network, COLLECTIBLE_DECIMALS)
}

/**
 * Remaining supply is the distributor balance of the item token.
 * An unrecorded contract, or a failed read, is unknown — not sold out.
 * Zero is sold out.
 */
export async function remainingSupply(
  item: Pick<MerchItemRecord, "contractId" | "distributorAddress" | "network">,
  readBalance: BalanceReader = readDistributorBalance,
): Promise<number | null> {
  const contractId = item.contractId?.trim().toUpperCase() ?? ""
  const holder = item.distributorAddress?.trim().toUpperCase() ?? ""
  if (!CONTRACT_ID.test(contractId) || !HOLDER_ID.test(holder)) return null

  try {
    const balance = await readBalance(contractId, holder, item.network)
    if (balance == null || !Number.isFinite(balance) || balance < 0) return null
    return Math.floor(balance)
  } catch {
    return null
  }
}
