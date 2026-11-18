import "server-only"

import { getClpOracleQuote } from "@/lib/deposits/clp-oracle"
import { getArsQuote } from "@/lib/fx/bcra"
import { fetchFxRateToUsd } from "@/lib/ledger/fx-fetch"
import { REFERENCE_FIAT_OPTIONS, type ReferenceFiat } from "@/lib/treasury/types"

export function parseReferenceFiat(raw: string): ReferenceFiat | null {
  const value = raw.trim().toUpperCase()
  return (REFERENCE_FIAT_OPTIONS as readonly string[]).includes(value)
    ? (value as ReferenceFiat)
    : null
}

/** Live local units for 1 USDC (priced as USD). */
export async function localFiatPerUsdc(
  fiat: ReferenceFiat,
): Promise<{ localPerUsdc: number; source: string }> {
  if (fiat === "USD") return { localPerUsdc: 1, source: "identity" }
  if (fiat === "ARS") {
    const quote = await getArsQuote()
    return { localPerUsdc: quote.rate, source: quote.source }
  }
  if (fiat === "CLP") {
    const quote = await getClpOracleQuote()
    return { localPerUsdc: quote.spotClpPerUsdc, source: quote.source }
  }
  const { rate, source } = await fetchFxRateToUsd(fiat)
  if (!(rate > 0)) throw new Error("FX rate unavailable")
  return { localPerUsdc: 1 / rate, source }
}
