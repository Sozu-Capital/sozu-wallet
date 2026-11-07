"use client"

import { useEffect, useState } from "react"
import { isArsQuoteDto, type ArsQuoteDto } from "@/lib/fx/ars-label"

export type ArsQuoteState =
  | { status: "loading" }
  | { status: "ok"; quote: ArsQuoteDto }
  | { status: "unavailable" }

const REFRESH_MS = 15 * 60 * 1000

/** BCRA USD → ARS quote from `/api/fx/ars`. A failed refresh drops the old quote instead of showing it stale. */
export function useArsQuote(enabled: boolean): ArsQuoteState {
  const [state, setState] = useState<ArsQuoteState>({ status: "loading" })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch("/api/fx/ars", { cache: "no-store" })
        const body: unknown = await res.json().catch(() => null)
        if (cancelled) return
        setState(res.ok && isArsQuoteDto(body) ? { status: "ok", quote: body } : { status: "unavailable" })
      } catch {
        if (!cancelled) setState({ status: "unavailable" })
      }
    }

    void load()
    const id = window.setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [enabled])

  return state
}
