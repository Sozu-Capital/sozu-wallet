"use client"

import { circleSacBalance, circleSacCoversAmount, type CircleBalancePayload } from "@/lib/connect/pay-request"

export type CircleCover = "yes" | "no" | "unknown"

/** Reads Circle SAC only. Blend and Sozu Test balances do not cover a pay. */
export async function circleSacCover(accountId: string, amount: string): Promise<CircleCover> {
  try {
    const response = await fetch(
      `/api/wallet/stellar/balance?publicKey=${encodeURIComponent(accountId)}`,
      { cache: "no-store" },
    )
    if (!response.ok) return "unknown"
    const payload = (await response.json()) as CircleBalancePayload
    return circleSacCoversAmount(circleSacBalance(payload), amount) ? "yes" : "no"
  } catch {
    return "unknown"
  }
}
