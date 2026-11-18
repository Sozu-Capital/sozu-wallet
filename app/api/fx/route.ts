import { NextResponse } from "next/server"
import { localFiatPerUsdc, parseReferenceFiat } from "@/lib/fx/local-per-usdc"
import { fetchFxRateToUsd } from "@/lib/ledger/fx-fetch"

/**
 * Quote local fiat ↔ USDC (USD proxy).
 * `localPerUsdc` is the live cash-out number the withdraw sheet shows.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = (searchParams.get("from") ?? "CLP").toUpperCase()
  const to = (searchParams.get("to") ?? "USDC").toUpperCase()

  try {
    if (to !== "USDC" && to !== "USD") {
      return NextResponse.json({ error: "Only to=USDC or to=USD supported in MVP" }, { status: 400 })
    }

    const fiat = parseReferenceFiat(from)
    if (fiat) {
      const quote = await localFiatPerUsdc(fiat)
      return NextResponse.json({
        from: fiat,
        to: "USDC",
        rateToUsd: 1 / quote.localPerUsdc,
        localPerUsdc: quote.localPerUsdc,
        proxyNote: "USDC priced as USD (spot proxy).",
        source: quote.source,
      })
    }

    const { rate, source } = await fetchFxRateToUsd(from)
    return NextResponse.json({
      from,
      to: "USDC",
      rateToUsd: rate,
      localPerUsdc: rate > 0 ? 1 / rate : null,
      proxyNote: "USDC priced as USD (spot proxy).",
      source,
    })
  } catch (e) {
    console.error("[fx]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "FX fetch failed" },
      { status: 502 },
    )
  }
}
