import { fiatDecimals } from "@/lib/payment/send-amount-currency"
import type { ReferenceFiat } from "@/lib/treasury/types"

export function localAmountFromUsdc(
  usdc: number,
  localPerUsdc: number,
  fiat: ReferenceFiat,
): number {
  const raw = usdc * localPerUsdc
  const decimals = fiatDecimals(fiat)
  const factor = 10 ** decimals
  return Math.round(raw * factor) / factor
}

export function isLiveFxQuote(value: unknown): value is { localPerUsdc: number; from: string } {
  if (!value || typeof value !== "object") return false
  const row = value as { localPerUsdc?: unknown; from?: unknown }
  return typeof row.localPerUsdc === "number" && Number.isFinite(row.localPerUsdc) && row.localPerUsdc > 0
}
