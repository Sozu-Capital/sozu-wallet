/**
 * Stop limit for the deposit-screen Sozu Faucet claim.
 * Product intent is one 100 USDC grant for the life of a wallet.
 * Until that lands, a wallet (and the account that owns it) can claim once per 24 hours.
 */

export const WALLET_FAUCET_CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000

/** Amount recorded on the pending row. The faucet response overwrites it on success. */
export const WALLET_FAUCET_CLAIM_AMOUNT = 100

export const WALLET_DEPOSIT_FAUCET_SLUG = "wallet-deposit"

export type WalletFaucetClaimStamp = {
  id: string
  claimedAtMs: number
  status: "pending" | "success" | "failed"
}

/** Earliest pending or successful claim still inside the window, if any. */
export function earliestBlockingClaim<T extends WalletFaucetClaimStamp>(
  claims: T[],
  nowMs: number,
  windowMs = WALLET_FAUCET_CLAIM_WINDOW_MS,
): T | null {
  let winner: T | null = null
  for (const claim of claims) {
    if (claim.status === "failed") continue
    if (nowMs - claim.claimedAtMs >= windowMs) continue
    if (!winner) {
      winner = claim
      continue
    }
    if (claim.claimedAtMs < winner.claimedAtMs) {
      winner = claim
      continue
    }
    if (claim.claimedAtMs === winner.claimedAtMs && claim.id < winner.id) {
      winner = claim
    }
  }
  return winner
}

export function nextClaimAvailableAt(claimedAtMs: number, windowMs = WALLET_FAUCET_CLAIM_WINDOW_MS): string {
  return new Date(claimedAtMs + windowMs).toISOString()
}

/**
 * A faucet rejection that means "this wallet already got USDC" consumes the daily slot.
 * Transport and config failures do not, so the person can retry.
 */
export function faucetFailureConsumesDailyClaim(reason: string | undefined, status: number): boolean {
  if (status === 429) return true
  const normalized = (reason ?? "").toLowerCase()
  return /cooldown|daily|limit|already|quota/.test(normalized)
}
