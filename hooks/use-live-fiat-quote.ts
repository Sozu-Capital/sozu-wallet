"use client"

import { useEffect, useState } from "react"
import { isLiveFxQuote } from "@/lib/fx/quote-display"
import type { ReferenceFiat } from "@/lib/treasury/types"

export type LiveFiatQuoteState =
  | { status: "loading" }
  | { status: "ok"; localPerUsdc: number; fiat: ReferenceFiat }
  | { status: "unavailable" }

const REFRESH_MS = 5 * 60 * 1000

/** Live local-fiat units per 1 USDC from `/api/fx`. */
export function useLiveFiatQuote(enabled: boolean, fiat: ReferenceFiat): LiveFiatQuoteState {
  const [state, setState] = useState<LiveFiatQuoteState>({ status: "loading" })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`/api/fx?from=${encodeURIComponent(fiat)}`, { cache: "no-store" })
        const body: unknown = await res.json().catch(() => null)
        if (cancelled) return
        setState(
          res.ok && isLiveFxQuote(body)
            ? { status: "ok", localPerUsdc: body.localPerUsdc, fiat }
            : { status: "unavailable" },
        )
      } catch {
        if (!cancelled) setState({ status: "unavailable" })
      }
    }

    setState({ status: "loading" })
    void load()
    const id = window.setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [enabled, fiat])

  return state
}
