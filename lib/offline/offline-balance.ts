/**
 * Last USDC figure the wallet showed, kept on the phone so a lost connection
 * can still open the offline balance window. The live ledger is not available then.
 */

export const OFFLINE_BALANCE_KEY = "sozu_offline_balance:v1"

export type OfflineBalanceRecord = {
  wallet: string
  usdc: number
  savedAt: number
}

export type OfflineBalanceStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const ADDRESS = /^[CG][A-Z2-7]{55}$/

/** Same USDC total the home card shows: wallet + Circle SAC + strategy. */
export function offlineCardUsdc(balance: {
  walletBalance?: number
  sorobanSacBalance?: number
  strategyBalance?: number
  displayBalance?: number
  totalBalance?: number
}): number | null {
  const parts =
    (balance.walletBalance ?? 0) +
    (balance.sorobanSacBalance ?? 0) +
    (balance.strategyBalance ?? 0)
  const usdc = parts > 0 ? parts : (balance.displayBalance ?? balance.totalBalance ?? 0)
  if (!Number.isFinite(usdc) || usdc < 0) return null
  return usdc
}

export function saveOfflineBalance(
  store: OfflineBalanceStore,
  input: { wallet: string; usdc: number },
  now = Date.now(),
): boolean {
  const wallet = input.wallet.trim().toUpperCase()
  if (!ADDRESS.test(wallet)) return false
  if (!Number.isFinite(input.usdc) || input.usdc < 0) return false
  const record: OfflineBalanceRecord = { wallet, usdc: input.usdc, savedAt: now }
  store.setItem(OFFLINE_BALANCE_KEY, JSON.stringify(record))
  return true
}

export function readOfflineBalance(store: OfflineBalanceStore): OfflineBalanceRecord | null {
  const raw = store.getItem(OFFLINE_BALANCE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<OfflineBalanceRecord>
    if (typeof parsed.wallet !== "string" || !ADDRESS.test(parsed.wallet)) return null
    if (typeof parsed.usdc !== "number" || !Number.isFinite(parsed.usdc) || parsed.usdc < 0) return null
    if (typeof parsed.savedAt !== "number" || !Number.isFinite(parsed.savedAt)) return null
    return { wallet: parsed.wallet, usdc: parsed.usdc, savedAt: parsed.savedAt }
  } catch {
    return null
  }
}

export function saveOfflineBalanceLocal(input: { wallet: string; usdc: number }): void {
  if (typeof window === "undefined") return
  try {
    saveOfflineBalance(localStorage, input)
  } catch {
    /* private mode or quota */
  }
}

export function readOfflineBalanceLocal(): OfflineBalanceRecord | null {
  if (typeof window === "undefined") return null
  try {
    return readOfflineBalance(localStorage)
  } catch {
    return null
  }
}
