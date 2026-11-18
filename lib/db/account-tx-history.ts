import "server-only"

import { createClient as createServiceClient } from "@supabase/supabase-js"
import {
  ACCOUNT_HISTORY_STORE_LIMIT,
  clampHistoryLimit,
  faucetClaimToHistory,
  mergeAccountHistory,
  normalizeWalletAddress,
  type AccountHistoryTx,
} from "@/lib/wallet/account-tx-history"

type HistoryRow = {
  tx_hash: string
  created_at: string
  successful: boolean
  memo: string | null
  operations: AccountHistoryTx["operations"]
}

type ClaimRow = {
  id: string
  wallet_address: string
  amount: number | string
  tx_hash: string | null
  claimed_at: string
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

function rowToTx(row: HistoryRow): AccountHistoryTx | null {
  if (!row?.tx_hash || !Array.isArray(row.operations)) return null
  return {
    id: row.tx_hash,
    hash: row.tx_hash,
    createdAt: row.created_at,
    successful: row.successful !== false,
    memo: row.memo ?? null,
    operations: row.operations,
  }
}

export async function loadRememberedHistory(walletAddress: string): Promise<AccountHistoryTx[]> {
  const wallet = normalizeWalletAddress(walletAddress)
  const db = getServiceClient()
  if (!db) return []
  const { data, error } = await db
    .from("account_tx_history")
    .select("tx_hash, created_at, successful, memo, operations")
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: false })
    .limit(ACCOUNT_HISTORY_STORE_LIMIT)
  if (error) {
    console.warn("[account-tx-history] read failed:", error.message)
    return []
  }
  return (data as HistoryRow[] | null)?.flatMap((row) => {
    const tx = rowToTx(row)
    return tx ? [tx] : []
  }) ?? []
}

export async function loadFaucetClaimHistory(walletAddress: string): Promise<AccountHistoryTx[]> {
  const wallet = normalizeWalletAddress(walletAddress)
  const db = getServiceClient()
  if (!db) return []
  const { data, error } = await db
    .from("faucet_claims")
    .select("id, wallet_address, amount, tx_hash, claimed_at")
    .ilike("wallet_address", wallet)
    .eq("status", "success")
    .order("claimed_at", { ascending: false })
    .limit(ACCOUNT_HISTORY_STORE_LIMIT)
  if (error) {
    console.warn("[account-tx-history] faucet claims failed:", error.message)
    return []
  }
  return (data as ClaimRow[] | null)?.flatMap((row) => {
    const tx = faucetClaimToHistory({
      id: row.id,
      walletAddress: row.wallet_address,
      amount: row.amount,
      txHash: row.tx_hash,
      claimedAt: row.claimed_at,
    })
    return tx ? [tx] : []
  }) ?? []
}

export async function rememberAccountHistory(
  walletAddress: string,
  transactions: readonly AccountHistoryTx[],
): Promise<void> {
  const wallet = normalizeWalletAddress(walletAddress)
  const db = getServiceClient()
  if (!db || transactions.length === 0) return
  const rows = transactions.flatMap((tx) => {
    if (!tx.hash || Number.isNaN(Date.parse(tx.createdAt))) return []
    return [
      {
        wallet_address: wallet,
        tx_hash: tx.hash,
        created_at: tx.createdAt,
        successful: tx.successful,
        memo: tx.memo,
        operations: tx.operations,
      },
    ]
  })
  const chunkSize = 80
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await db.from("account_tx_history").upsert(chunk, {
      onConflict: "wallet_address,tx_hash",
    })
    if (error) {
      console.warn("[account-tx-history] remember failed:", error.message)
      return
    }
  }
}

/**
 * History this account keeps: stored rows, the latest chain scan, and every
 * successful faucet claim to this address. Stored rows are never deleted.
 */
export async function assembleAccountHistory(params: {
  walletAddress: string
  chain: readonly AccountHistoryTx[]
  limit: number
  remembered?: readonly AccountHistoryTx[] | null
}): Promise<AccountHistoryTx[]> {
  const wallet = normalizeWalletAddress(params.walletAddress)
  const limit = clampHistoryLimit(params.limit)
  const remembered = params.remembered ?? (await loadRememberedHistory(wallet))
  const faucet = await loadFaucetClaimHistory(wallet)
  const merged = mergeAccountHistory({
    walletAddress: wallet,
    remembered,
    chain: params.chain,
    faucet,
    limit: ACCOUNT_HISTORY_STORE_LIMIT,
  })
  await rememberAccountHistory(wallet, merged)
  return merged.slice(0, limit)
}
