/**
 * Last USDC balance painted for a smart account, so the home card can show it
 * before the Soroban read returns. The live fetch still replaces it.
 */

const VERSION = "v1"

export type CachedUsdcBalance = {
  walletBalance: number
  sorobanSacBalance: number
  spendableOnC: number
  strategyBalance: number
  totalBalance: number
  displayBalance: number
  classicOnSigner: number
  legacyUsdcOnSigner: number
}

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function storageKey(publicKey: string): string {
  return `sozu.usdcBalance:${VERSION}:${publicKey.trim().toUpperCase()}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function parseCached(raw: unknown): CachedUsdcBalance | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const fields = [
    "walletBalance",
    "sorobanSacBalance",
    "spendableOnC",
    "strategyBalance",
    "totalBalance",
    "displayBalance",
    "classicOnSigner",
    "legacyUsdcOnSigner",
  ] as const
  const out = {} as CachedUsdcBalance
  for (const field of fields) {
    if (!isFiniteNumber(row[field])) return null
    out[field] = row[field]
  }
  return out
}

export function readCachedUsdcBalance(publicKey: string, storage?: StorageLike | null): CachedUsdcBalance | null {
  const pk = publicKey.trim().toUpperCase()
  if (!pk.startsWith("C") || pk.length !== 56) return null
  const store = storage ?? (typeof window === "undefined" ? null : window.localStorage)
  if (!store) return null
  try {
    const raw = store.getItem(storageKey(pk))
    if (!raw) return null
    return parseCached(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeCachedUsdcBalance(
  publicKey: string,
  balance: CachedUsdcBalance,
  storage?: StorageLike | null,
): void {
  const pk = publicKey.trim().toUpperCase()
  if (!pk.startsWith("C") || pk.length !== 56) return
  if (!parseCached(balance)) return
  const store = storage ?? (typeof window === "undefined" ? null : window.localStorage)
  if (!store) return
  try {
    store.setItem(storageKey(pk), JSON.stringify(balance))
  } catch {
    // Private mode, quota, or storage disabled.
  }
}
