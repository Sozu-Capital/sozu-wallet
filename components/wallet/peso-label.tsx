"use client"

import type { ArsQuoteState } from "@/hooks/use-ars-quote"
import {
  formatArsRate,
  formatArsWhole,
  formatFetchedTime,
  formatRateDate,
} from "@/lib/fx/ars-label"
import { maskBalance } from "@/lib/wallet-utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import { formatWalletText } from "@/lib/wallet-texts"
import { cn } from "@/lib/utils"

interface PesoLabelProps {
  balanceUsdc: number
  quoteState: ArsQuoteState
  isBalanceVisible: boolean
  className?: string
}

/** Peso value of the USDC balance with the BCRA rate, source and date. Never a guessed rate. */
export function PesoLabel({ balanceUsdc, quoteState, isBalanceVisible, className }: PesoLabelProps) {
  const { t } = useWalletLanguage()

  if (quoteState.status !== "ok") {
    return (
      <p
        className={cn("mt-2 text-sm text-white/55 sm:text-base", className)}
        role="status"
        data-testid="peso-label"
      >
        {quoteState.status === "loading" ? t.arsQuoteLoading : t.arsQuoteUnavailable}
      </p>
    )
  }

  const { quote } = quoteState
  const ars = formatArsWhole(balanceUsdc * quote.rate)

  return (
    <div className={cn("mt-2 space-y-0.5", className)} data-testid="peso-label">
      <p className="text-lg font-semibold tabular-nums text-white/85 sm:text-xl">
        ≈ {isBalanceVisible ? ars : maskBalance(ars)} ARS
      </p>
      <p className="text-sm tabular-nums text-white/55">
        {formatWalletText(t.arsQuoteRate, { rate: formatArsRate(quote.rate) })}
      </p>
      <p className="text-xs tabular-nums text-white/45">
        {formatWalletText(t.arsQuoteAsOf, {
          date: formatRateDate(quote.rateDate),
          time: formatFetchedTime(quote.fetchedAt),
        })}
      </p>
    </div>
  )
}
