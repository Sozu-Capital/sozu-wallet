/**
 * Last history painted for one account, so a refresh cannot replace it with
 * another account's list or with an empty chain scan.
 */

import {
  mergeAccountHistory,
  type AccountHistoryTx,
} from "@/lib/wallet/account-tx-history"

const VERSION = "v1"

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function storageKey(publicKey: string): string {
  return `sozu.txHistory:${VERSION}:${publicKey.trim().toUpperCase()}`
}

function parseTx(raw: unknown): AccountHistoryTx | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  if (typeof row.hash !== "string" || typeof row.createdAt !== "string") return null
  if (!Array.isArray(row.operations)) return null
  const operations = row.operations.flatMap((op) => {
    if (!op || typeof op !== "object") return []
    const item = op as Record<string, unknown>
    if (typeof item.from !== "string" || typeof item.to !== "string") return []
    const amount = typeof item.amount === "number" ? item.amount : Number(item.amount)
    if (!Number.isFinite(amount)) return []
    return [
      {
        type: typeof item.type === "string" ? item.type : "payment",
        from: item.from,
        to: item.to,
        amount,
        asset: typeof item.asset === "string" ? item.asset : "USDC",
      },
    ]
  })
  if (operations.length === 0) return null
  return {
    id: typeof row.id === "string" ? row.id : row.hash,
    hash: row.hash,
    createdAt: row.createdAt,
    successful: row.successful !== false,
    memo: typeof row.memo === "string" ? row.memo : null,
    operations,
  }
}

export function readCachedTxHistory(
  publicKey: string,
  storage?: StorageLike | null,
): AccountHistoryTx[] | null {
  const pk = publicKey.trim().toUpperCase()
  if (!/^[GC][A-Z0-9]{55}$/.test(pk)) return null
  const store = storage ?? (typeof window === "undefined" ? null : window.localStorage)
  if (!store) return null
  try {
    const raw = store.getItem(storageKey(pk))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const txs = parsed.flatMap((row) => {
      const tx = parseTx(row)
      return tx ? [tx] : []
    })
    return txs.length > 0 ? txs : null
  } catch {
    return null
  }
}

export function writeCachedTxHistory(
  publicKey: string,
  transactions: readonly AccountHistoryTx[],
  storage?: StorageLike | null,
): void {
  const pk = publicKey.trim().toUpperCase()
  if (!/^[GC][A-Z0-9]{55}$/.test(pk)) return
  const store = storage ?? (typeof window === "undefined" ? null : window.localStorage)
  if (!store) return
  const merged = mergeAccountHistory({
    walletAddress: pk,
    remembered: transactions,
    chain: [],
    faucet: [],
  })
  if (merged.length === 0) return
  try {
    store.setItem(storageKey(pk), JSON.stringify(merged))
  } catch {
    // Private mode, quota, or storage disabled.
  }
}
