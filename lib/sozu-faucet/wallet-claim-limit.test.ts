import { describe, expect, it } from "vitest"
import {
  earliestBlockingClaim,
  faucetFailureConsumesDailyClaim,
  nextClaimAvailableAt,
  WALLET_FAUCET_CLAIM_WINDOW_MS,
  type WalletFaucetClaimStamp,
} from "./wallet-claim-limit"

const HOUR = 60 * 60 * 1000

function stamp(
  id: string,
  hoursAgo: number,
  status: WalletFaucetClaimStamp["status"] = "success",
  now = 1_000_000_000_000,
): WalletFaucetClaimStamp {
  return { id, claimedAtMs: now - hoursAgo * HOUR, status }
}

describe("earliestBlockingClaim", () => {
  const now = 1_000_000_000_000

  it("allows a claim when nothing is in the window", () => {
    expect(earliestBlockingClaim([], now)).toBeNull()
    expect(earliestBlockingClaim([stamp("old", 25, "success", now)], now)).toBeNull()
    expect(earliestBlockingClaim([stamp("failed", 1, "failed", now)], now)).toBeNull()
  })

  it("blocks a second claim inside 24 hours and names the earlier one", () => {
    const first = stamp("a", 2, "success", now)
    const second = stamp("b", 1, "pending", now)
    expect(earliestBlockingClaim([second, first], now)?.id).toBe("a")
  })

  it("treats a pending claim as already used", () => {
    expect(earliestBlockingClaim([stamp("pending", 0.1, "pending", now)], now)?.id).toBe("pending")
  })

  it("breaks timestamp ties by id so two racing inserts have one winner", () => {
    const claimedAtMs = now - HOUR
    const claims = [
      { id: "b", claimedAtMs, status: "pending" as const },
      { id: "a", claimedAtMs, status: "pending" as const },
    ]
    expect(earliestBlockingClaim(claims, now)?.id).toBe("a")
  })

  it("opens the window exactly 24 hours after the winning claim", () => {
    const claimedAtMs = now - WALLET_FAUCET_CLAIM_WINDOW_MS
    expect(earliestBlockingClaim([{ id: "edge", claimedAtMs, status: "success" }], now)).toBeNull()
    expect(nextClaimAvailableAt(now - HOUR)).toBe(new Date(now - HOUR + WALLET_FAUCET_CLAIM_WINDOW_MS).toISOString())
  })
})

describe("faucetFailureConsumesDailyClaim", () => {
  it("keeps the slot when the faucet already paid or is cooling down", () => {
    expect(faucetFailureConsumesDailyClaim("user_cooldown", 429)).toBe(true)
    expect(faucetFailureConsumesDailyClaim("daily_limit", 400)).toBe(true)
    expect(faucetFailureConsumesDailyClaim("already_claimed", 409)).toBe(true)
  })

  it("releases the slot when the faucet never paid", () => {
    expect(faucetFailureConsumesDailyClaim("payment_failed", 502)).toBe(false)
    expect(faucetFailureConsumesDailyClaim("misconfigured", 503)).toBe(false)
    expect(faucetFailureConsumesDailyClaim(undefined, 500)).toBe(false)
  })
})
